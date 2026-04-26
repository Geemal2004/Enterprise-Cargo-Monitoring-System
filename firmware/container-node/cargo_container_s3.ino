#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP085.h>
#include <Adafruit_MPU6050.h>
#include <Update.h>
#include "CargoPacket.h"
#include "TimeSyncPacket.h"

// -----------------------------------------------------------------------------
// Configuration constants
// -----------------------------------------------------------------------------

static const uint32_t SERIAL_BAUD = 115200;
static const uint32_t TELEMETRY_INTERVAL_MS = 2500;
static const uint32_t SD_RETRY_INTERVAL_MS = 15000;

// Shock threshold based on acceleration magnitude in g units.
static const float SHOCK_THRESHOLD_G = 1.80f;

// Canonical pin plan (ESP32-S3 container node)
static const int PIN_I2C_SDA = 8;
static const int PIN_I2C_SCL = 9;
static const int PIN_MQ2_AO = 4;
static const int PIN_SD_CS = 10;
static const int PIN_SD_MOSI = 11;
static const int PIN_SD_SCK = 12;
static const int PIN_SD_MISO = 13;

// Optional INMP441 placeholders (deferred for MVP)
static const int PIN_I2S_WS = 14;
static const int PIN_I2S_BCLK = 15;
static const int PIN_I2S_SD = 16;

// Fixed ESP-NOW MAC identities
static const uint8_t SENSOR_NODE_MAC[6] = {0xAC, 0xA7, 0x04, 0x27, 0xBD, 0x00};
static const uint8_t GATEWAY_NODE_MAC[6] = {0xEC, 0xE3, 0x34, 0x23, 0x43, 0x24};

static const char SD_LOG_FILE[] = "/telemetry.csv";
static const size_t OTA_CHUNK_SIZE = 200;
static const uint32_t OTA_PKT_BEGIN = 0x4F544142UL;
static const uint32_t OTA_PKT_CHUNK = 0x4F54414EUL;
static const uint32_t OTA_PKT_END = 0x4F544145UL;
static const uint32_t ESP_NOW_CHANNEL_MAGIC = 0x4348414EUL; // "CHAN"
static const uint8_t ESP_NOW_BOOT_CHANNEL = 1;

struct OtaBeginPacket {
  uint32_t magic;
  uint32_t totalSize;
  char filename[64];
};

struct OtaChunkPacket {
  uint32_t magic;
  uint32_t totalSize;
  uint32_t offset;
  uint16_t chunkLen;
  uint8_t data[OTA_CHUNK_SIZE];
};

struct OtaEndPacket {
  uint32_t magic;
  uint32_t totalSize;
  uint32_t crc32;
};

struct EspNowChannelPacket {
  uint32_t magic;
  uint8_t channel;
};

// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------

Adafruit_AHTX0 aht;
Adafruit_BMP085 bmp;
Adafruit_MPU6050 mpu;

bool ahtReady = false;
bool bmpReady = false;
bool mpuReady = false;
bool espNowReady = false;
bool sdReady = false;
bool otaInProgress = false;
uint8_t espNowChannel = ESP_NOW_BOOT_CHANNEL;
uint32_t otaTotalSize = 0;
uint32_t otaBytesReceived = 0;
char otaFilename[64] = {};
portMUX_TYPE timeMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t syncedUnixTs = 0;
volatile uint32_t syncedAtMs = 0;

uint32_t sequenceNo = 1;
unsigned long lastCycleMs = 0;
unsigned long lastSdRetryMs = 0;

float lastTempC = 0.0f;
float lastHumidity = 0.0f;
float lastPressureHpa = 0.0f;
float lastTiltDeg = 0.0f;
bool lastShock = false;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

String macToString(const uint8_t *mac) {
  char s[18];
  snprintf(s, sizeof(s), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(s);
}

void scanI2CBus() {
  Serial.println("[I2C] Scanning bus...");
  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      Serial.printf("[I2C] Found device at 0x%02X\n", addr);
      found++;
    }
  }
  if (found == 0) {
    Serial.println("[I2C] No devices found.");
  } else {
    Serial.printf("[I2C] Scan complete. Devices found: %u\n", found);
  }
}

float computeTiltDeg(float ax, float ay, float az) {
  const float denom = sqrtf((ax * ax) + (az * az));
  if (denom < 0.0001f) return 0.0f;
  return atan2f(ay, denom) * 57.2957795f;
}

bool computeShockFlag(float ax, float ay, float az) {
  const float accMag = sqrtf((ax * ax) + (ay * ay) + (az * az));
  const float accG = accMag / 9.80665f;
  return accG >= SHOCK_THRESHOLD_G;
}

bool initSDCard() {
  Serial.println("[SD] Initializing...");
  if (!SD.begin(PIN_SD_CS)) {
    Serial.println("[SD] Init failed.");
    return false;
  }

  File f = SD.open(SD_LOG_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("[SD] Open failed during init.");
    return false;
  }

  if (f.size() == 0) {
    f.println("seq,ts,real_time,tempC,humidity,pressure,tilt,gasRaw,shock,sdOk");
  }
  f.close();

  Serial.println("[SD] Ready.");
  return true;
}

uint32_t getRealTime(bool &isSynced) {
  uint32_t baseUnixTs = 0;
  uint32_t baseMs = 0;

  portENTER_CRITICAL(&timeMux);
  baseUnixTs = syncedUnixTs;
  baseMs = syncedAtMs;
  portEXIT_CRITICAL(&timeMux);

  if (baseUnixTs > 1700000000UL && baseMs > 0) {
    isSynced = true;
    return baseUnixTs + ((millis() - baseMs) / 1000UL);
  }

  isSynced = false;
  return (uint32_t)(millis() / 1000UL);
}

bool appendLogCsv(const CargoPacket &pkt, bool sdFlagValue, bool realTime) {
  File f = SD.open(SD_LOG_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("[SD] Open failed for append.");
    return false;
  }

  int written = f.printf("%lu,%lu,%u,%.2f,%.2f,%.2f,%.2f,%u,%u,%u\n",
                         (unsigned long)pkt.seq,
                         (unsigned long)pkt.ts,
                         realTime ? 1 : 0,
                         pkt.tempC,
                         pkt.humidity,
                         pkt.pressure,
                         pkt.tilt,
                         (unsigned int)pkt.gasRaw,
                         pkt.shock ? 1 : 0,
                         sdFlagValue ? 1 : 0);
  f.close();

  if (written <= 0) {
    Serial.println("[SD] Write failed.");
    return false;
  }
  return true;
}

void handleOtaPacket(const uint8_t *data, int len) {
  if (data == nullptr || len < (int)sizeof(uint32_t)) {
    return;
  }

  uint32_t magic = 0;
  memcpy(&magic, data, sizeof(magic));

  if (magic == OTA_PKT_BEGIN && len >= (int)sizeof(OtaBeginPacket)) {
    OtaBeginPacket pkt{};
    memcpy(&pkt, data, sizeof(pkt));

    otaTotalSize = pkt.totalSize;
    otaBytesReceived = 0;
    memset(otaFilename, 0, sizeof(otaFilename));
    strncpy(otaFilename, pkt.filename, sizeof(otaFilename) - 1);

    Serial.printf("[OTA] Begin: filename=%s totalSize=%lu\n",
                  otaFilename,
                  (unsigned long)otaTotalSize);

    if (!Update.begin(otaTotalSize, U_FLASH)) {
      Serial.println("[OTA] Update.begin() failed:");
      Update.printError(Serial);
      otaInProgress = false;
      return;
    }

    otaInProgress = true;
    Serial.println("[OTA] Update.begin() OK, receiving chunks...");
    return;
  }

  if (magic == OTA_PKT_CHUNK && otaInProgress && len >= (int)sizeof(OtaChunkPacket)) {
    OtaChunkPacket pkt{};
    memcpy(&pkt, data, sizeof(pkt));

    if (pkt.offset != otaBytesReceived) {
      Serial.printf("[OTA] Offset mismatch! expected=%lu got=%lu - aborting\n",
                    (unsigned long)otaBytesReceived,
                    (unsigned long)pkt.offset);
      Update.abort();
      otaInProgress = false;
      return;
    }

    const size_t written = Update.write(pkt.data, pkt.chunkLen);
    if (written != pkt.chunkLen) {
      Serial.printf("[OTA] Write error: wrote %u of %u bytes\n",
                    (unsigned int)written,
                    (unsigned int)pkt.chunkLen);
      Update.abort();
      otaInProgress = false;
      return;
    }

    otaBytesReceived += pkt.chunkLen;
    const uint8_t progress = otaTotalSize > 0
                             ? (uint8_t)(((uint64_t)otaBytesReceived * 100) / otaTotalSize)
                             : 0;
    if (progress % 10 == 0) {
      Serial.printf("[OTA] Progress: %lu / %lu bytes (%u%%)\n",
                    (unsigned long)otaBytesReceived,
                    (unsigned long)otaTotalSize,
                    progress);
    }
    return;
  }

  if (magic == OTA_PKT_END && otaInProgress) {
    OtaEndPacket pkt{};
    memcpy(&pkt, data, sizeof(pkt));

    Serial.printf("[OTA] End received. Bytes received: %lu / %lu\n",
                  (unsigned long)otaBytesReceived,
                  (unsigned long)otaTotalSize);

    if (Update.end(true)) {
      Serial.println("[OTA] Update successful! Rebooting in 1s...");
      delay(1000);
      ESP.restart();
    } else {
      Serial.println("[OTA] Update.end() failed:");
      Update.printError(Serial);
      otaInProgress = false;
    }
    return;
  }
}

void handleIncoming(const uint8_t *mac, const uint8_t *data, int len) {
  if (data == nullptr || len < (int)sizeof(uint32_t)) {
    return;
  }

  uint32_t magic = 0;
  memcpy(&magic, data, sizeof(magic));
  if (magic == OTA_PKT_BEGIN || magic == OTA_PKT_CHUNK || magic == OTA_PKT_END) {
    handleOtaPacket(data, len);
    return;
  }

  if (magic == ESP_NOW_CHANNEL_MAGIC && len >= (int)sizeof(EspNowChannelPacket)) {
    EspNowChannelPacket pkt{};
    memcpy(&pkt, data, sizeof(pkt));
    if (pkt.channel >= 1 && pkt.channel <= 13) {
      espNowChannel = pkt.channel;
      esp_wifi_set_channel(espNowChannel, WIFI_SECOND_CHAN_NONE);

      esp_now_peer_info_t peerInfo = {};
      memcpy(peerInfo.peer_addr, GATEWAY_NODE_MAC, 6);
      peerInfo.channel = espNowChannel;
      peerInfo.encrypt = false;
      esp_err_t err = esp_now_is_peer_exist(GATEWAY_NODE_MAC)
                        ? esp_now_mod_peer(&peerInfo)
                        : esp_now_add_peer(&peerInfo);

      Serial.printf("[ESP-NOW] Channel switched to %u err=%d\n",
                    (unsigned int)espNowChannel,
                    (int)err);
      return;
    }
  }

  if (len == (int)sizeof(TimeSyncPacket)) {
    TimeSyncPacket pkt{};
    memcpy(&pkt, data, sizeof(pkt));
    if (pkt.magic == TIME_SYNC_MAGIC && pkt.unixTs > 1700000000UL) {
      portENTER_CRITICAL_ISR(&timeMux);
      syncedUnixTs = pkt.unixTs;
      syncedAtMs = millis();
      portEXIT_CRITICAL_ISR(&timeMux);
      Serial.printf("[TIMESYNC] Received ts=%lu from %s\n",
                    (unsigned long)pkt.unixTs,
                    mac ? macToString(mac).c_str() : "unknown");
      return;
    }
  }

  Serial.printf("[ESP-NOW] Unknown packet magic=0x%08lX len=%d from %s, ignored\n",
                (unsigned long)magic,
                len,
                mac ? macToString(mac).c_str() : "unknown");
}

#if defined(ESP_IDF_VERSION_MAJOR) && (ESP_IDF_VERSION_MAJOR >= 5)
void onEspNowSent(const wifi_tx_info_t *txInfo, esp_now_send_status_t status) {
  (void)txInfo;
  Serial.printf("[ESP-NOW] Send => %s\n",
                status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}
void onEspNowReceived(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  handleIncoming(info ? info->src_addr : nullptr, data, len);
}
#else
void onEspNowSent(const uint8_t *macAddr, esp_now_send_status_t status) {
  Serial.printf("[ESP-NOW] Send to %s => %s\n",
                macToString(macAddr).c_str(),
                status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}
void onEspNowReceived(const uint8_t *macAddr, const uint8_t *data, int len) {
  handleIncoming(macAddr, data, len);
}
#endif

void initEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  WiFi.setSleep(false);
  esp_wifi_set_channel(ESP_NOW_BOOT_CHANNEL, WIFI_SECOND_CHAN_NONE);
  espNowChannel = ESP_NOW_BOOT_CHANNEL;

  String localMac = WiFi.macAddress();
  localMac.toUpperCase();
  Serial.printf("[ESP-NOW] Local MAC: %s\n", localMac.c_str());
  Serial.printf("[ESP-NOW] Expected sensor MAC: %s\n", macToString(SENSOR_NODE_MAC).c_str());
  Serial.printf("[ESP-NOW] Gateway MAC peer: %s\n", macToString(GATEWAY_NODE_MAC).c_str());

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init failed.");
    espNowReady = false;
    return;
  }

  esp_now_register_send_cb(onEspNowSent);
  esp_now_register_recv_cb(onEspNowReceived);

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, GATEWAY_NODE_MAC, 6);
  peerInfo.channel = espNowChannel;
  peerInfo.encrypt = false;

  if (!esp_now_is_peer_exist(GATEWAY_NODE_MAC)) {
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
      Serial.println("[ESP-NOW] Failed to add gateway peer.");
      espNowReady = false;
      return;
    }
  }

  espNowReady = true;
  Serial.println("[ESP-NOW] Ready.");
}

void readSensors(CargoPacket &pkt) {
  // AHT10
  if (ahtReady) {
    sensors_event_t humidityEvt, tempEvt;
    aht.getEvent(&humidityEvt, &tempEvt);
    if (!isnan(tempEvt.temperature)) lastTempC = tempEvt.temperature;
    if (!isnan(humidityEvt.relative_humidity)) lastHumidity = humidityEvt.relative_humidity;
  }

  // BMP180
  if (bmpReady) {
    const int32_t pressurePa = bmp.readPressure();
    if (pressurePa > 0) {
      lastPressureHpa = ((float)pressurePa) / 100.0f;
    }
  }

  // MPU6050
  if (mpuReady) {
    sensors_event_t accelEvt, gyroEvt, tempEvt;
    mpu.getEvent(&accelEvt, &gyroEvt, &tempEvt);
    lastTiltDeg = computeTiltDeg(
      accelEvt.acceleration.x,
      accelEvt.acceleration.y,
      accelEvt.acceleration.z
    );
    lastShock = computeShockFlag(
      accelEvt.acceleration.x,
      accelEvt.acceleration.y,
      accelEvt.acceleration.z
    );
  }

  // MQ2 analog gas sensor
  const int raw = analogRead(PIN_MQ2_AO);
  pkt.gasRaw = (uint16_t)constrain(raw, 0, 4095);

  pkt.tempC = lastTempC;
  pkt.humidity = lastHumidity;
  pkt.pressure = lastPressureHpa;
  pkt.tilt = lastTiltDeg;
  pkt.shock = lastShock;
}

void printCycleDebug(const CargoPacket &pkt) {
  Serial.printf("[DATA] seq=%lu ts=%lu temp=%.2fC hum=%.2f%% pressure=%.2fhPa tilt=%.2fdeg gas=%u shock=%u sdOk=%u\n",
                (unsigned long)pkt.seq,
                (unsigned long)pkt.ts,
                pkt.tempC,
                pkt.humidity,
                pkt.pressure,
                pkt.tilt,
                (unsigned int)pkt.gasRaw,
                pkt.shock ? 1 : 0,
                pkt.sdOk ? 1 : 0);
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(200);
  Serial.println("\n=== Smart Cargo Container Node Boot ===");

  Serial.printf("[PIN] I2C SDA=%d SCL=%d\n", PIN_I2C_SDA, PIN_I2C_SCL);
  Serial.printf("[PIN] MQ2 AO=%d\n", PIN_MQ2_AO);
  Serial.printf("[PIN] SD CS=%d MOSI=%d SCK=%d MISO=%d\n", PIN_SD_CS, PIN_SD_MOSI, PIN_SD_SCK, PIN_SD_MISO);
  Serial.printf("[PIN] INMP441 placeholders WS=%d BCLK=%d SD=%d (deferred)\n", PIN_I2S_WS, PIN_I2S_BCLK, PIN_I2S_SD);

  pinMode(PIN_MQ2_AO, INPUT);
  analogReadResolution(12);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  scanI2CBus();

  ahtReady = aht.begin();
  Serial.printf("[AHT10] %s\n", ahtReady ? "Ready" : "Init failed");

  bmpReady = bmp.begin();
  Serial.printf("[BMP180] %s\n", bmpReady ? "Ready" : "Init failed");

  mpuReady = mpu.begin();
  Serial.printf("[MPU6050] %s\n", mpuReady ? "Ready" : "Init failed");

  if (mpuReady) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  SPI.begin(PIN_SD_SCK, PIN_SD_MISO,PIN_SD_MOSI, PIN_SD_CS);
  sdReady = initSDCard();
  lastSdRetryMs = millis();

  initEspNow();

  Serial.println("[BOOT] Setup complete.");
}

void loop() {
  const unsigned long now = millis();

  if (now - lastCycleMs < TELEMETRY_INTERVAL_MS) {
    return;
  }
  lastCycleMs = now;

  CargoPacket pkt{};
  pkt.seq = sequenceNo++;
  bool realTime = false;
  pkt.ts = getRealTime(realTime);

  readSensors(pkt);

  // SD handling and retry strategy
  bool sdWriteOk = false;
  if (!sdReady && (now - lastSdRetryMs >= SD_RETRY_INTERVAL_MS)) {
    Serial.println("[SD] Retry init...");
    lastSdRetryMs = now;
    sdReady = initSDCard();
  }
  if (sdReady) {
    sdWriteOk = appendLogCsv(pkt, true, realTime);
    if (!sdWriteOk) {
      sdReady = false;
    }
  }
  pkt.sdOk = sdWriteOk;

  // ESP-NOW send to gateway
  if (espNowReady) {
    esp_err_t sendErr = esp_now_send(GATEWAY_NODE_MAC, reinterpret_cast<const uint8_t *>(&pkt), sizeof(pkt));
    if (sendErr != ESP_OK) {
      Serial.printf("[ESP-NOW] Send enqueue failed: %d\n", (int)sendErr);
    }
  } else {
    Serial.println("[ESP-NOW] Not ready. Packet not sent.");
  }

  printCycleDebug(pkt);
}
