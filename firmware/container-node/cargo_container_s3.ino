#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_idf_version.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP085.h>
#include <Adafruit_MPU6050.h>
#include "CargoPacket.h"
#include "TimeSyncPacket.h"

// -----------------------------------------------------------------------------
// Configuration constants
// -----------------------------------------------------------------------------

static const uint32_t SERIAL_BAUD           = 115200;
static const uint32_t TELEMETRY_INTERVAL_MS = 2500;
static const uint32_t SD_RETRY_INTERVAL_MS  = 15000;

// Shock threshold in g units (acceleration magnitude)
static const float SHOCK_THRESHOLD_G = 1.80f;

// Canonical pin plan (ESP32-S3 container node)
static const int PIN_I2C_SDA  = 8;
static const int PIN_I2C_SCL  = 9;
static const int PIN_MQ2_AO   = 4;
static const int PIN_SD_CS    = 10;
static const int PIN_SD_MOSI  = 11;
static const int PIN_SD_SCK   = 12;
static const int PIN_SD_MISO  = 13;

// Optional INMP441 placeholders (deferred for MVP)
static const int PIN_I2S_WS   = 14;
static const int PIN_I2S_BCLK = 15;
static const int PIN_I2S_SD   = 16;

// Fixed ESP-NOW MAC identities
static const uint8_t SENSOR_NODE_MAC[6]  = {0xAC, 0xA7, 0x04, 0x27, 0xBD, 0x00};
static const uint8_t GATEWAY_NODE_MAC[6] = {0xEC, 0xE3, 0x34, 0x23, 0x43, 0x24};

static const char SD_LOG_FILE[] = "/telemetry.csv";

// -----------------------------------------------------------------------------
// Globals — sensors
// -----------------------------------------------------------------------------

Adafruit_AHTX0  aht;
Adafruit_BMP085 bmp;
Adafruit_MPU6050 mpu;

bool ahtReady    = false;
bool bmpReady    = false;
bool mpuReady    = false;
bool espNowReady = false;
bool sdReady     = false;

uint32_t      sequenceNo    = 1;
unsigned long lastCycleMs   = 0;
unsigned long lastSdRetryMs = 0;

float lastTempC        = 0.0f;
float lastHumidity     = 0.0f;
float lastPressureHpa  = 0.0f;
float lastTiltDeg      = 0.0f;
bool  lastShock        = false;

// -----------------------------------------------------------------------------
// Globals — time sync
// -----------------------------------------------------------------------------

portMUX_TYPE timeMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t syncedUnixTs = 0;  // UTC unix time received from gateway
volatile uint32_t syncedAtMs   = 0;  // millis() at the moment of that sync

// Returns best available UTC unix timestamp.
// Falls back to seconds-since-boot if not yet synced (logged as unsynced in CSV).
uint32_t getRealTime(bool &isSynced) {
  uint32_t ts, atMs;
  portENTER_CRITICAL(&timeMux);
  ts   = syncedUnixTs;
  atMs = syncedAtMs;
  portEXIT_CRITICAL(&timeMux);

  if (ts == 0) {
    isSynced = false;
    return (uint32_t)(millis() / 1000UL);  // uptime fallback
  }

  isSynced = true;
  return ts + (uint32_t)((millis() - atMs) / 1000UL);
}

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
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C] Found device at 0x%02X\n", addr);
      found++;
    }
  }
  Serial.printf("[I2C] Scan complete. Devices found: %u\n", found);
}

float computeTiltDeg(float ax, float ay, float az) {
  const float denom = sqrtf((ax * ax) + (az * az));
  if (denom < 0.0001f) return 0.0f;
  return atan2f(ay, denom) * 57.2957795f;
}

bool computeShockFlag(float ax, float ay, float az) {
  const float accMag = sqrtf((ax * ax) + (ay * ay) + (az * az));
  return (accMag / 9.80665f) >= SHOCK_THRESHOLD_G;
}

// -----------------------------------------------------------------------------
// SD card
// -----------------------------------------------------------------------------

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
    // real_time=1 means ts is a genuine UTC unix timestamp from gateway sync.
    // real_time=0 means ts is seconds-since-boot (no sync received yet).
    f.println("seq,ts,real_time,tempC,humidity,pressure,tilt,gasRaw,shock,sdOk");
  }
  f.close();

  Serial.println("[SD] Ready.");
  return true;
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

// -----------------------------------------------------------------------------
// ESP-NOW
// -----------------------------------------------------------------------------

void handleIncoming(const uint8_t *mac, const uint8_t *data, int len) {
  if (!mac || !data) return;

  if (len == (int)sizeof(TimeSyncPacket)) {
    TimeSyncPacket pkt;
    memcpy(&pkt, data, sizeof(TimeSyncPacket));
    if (pkt.magic == TIME_SYNC_MAGIC && pkt.unixTs > 1700000000UL) {
      portENTER_CRITICAL_ISR(&timeMux);
      syncedUnixTs = pkt.unixTs;
      syncedAtMs   = millis();
      portEXIT_CRITICAL_ISR(&timeMux);
      Serial.printf("[TIMESYNC] Received ts=%lu from %s\n",
                    (unsigned long)pkt.unixTs,
                    macToString(mac).c_str());
    } else {
      Serial.printf("[TIMESYNC] Rejected: magic=0x%08lX ts=%lu\n",
                    (unsigned long)pkt.magic,
                    (unsigned long)pkt.unixTs);
    }
    return;
  }

  // Unknown packet size — log and ignore
  Serial.printf("[ESP-NOW] Unexpected packet len=%d from %s, ignored\n",
                len, macToString(mac).c_str());
}

#if defined(ESP_IDF_VERSION_MAJOR) && (ESP_IDF_VERSION_MAJOR >= 5)
void onEspNowReceive(const esp_now_recv_info_t *recvInfo, const uint8_t *data, int len) {
  if (!recvInfo) return;
  handleIncoming(recvInfo->src_addr, data, len);
}
#else
void onEspNowReceive(const uint8_t *mac, const uint8_t *data, int len) {
  handleIncoming(mac, data, len);
}
#endif

void onEspNowSent(const uint8_t *mac, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[ESP-NOW] TX to %s FAILED\n", macToString(mac).c_str());
  }
}

void initEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

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
  esp_now_register_recv_cb(onEspNowReceive);  // receive time sync from gateway

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, GATEWAY_NODE_MAC, 6);
  peerInfo.channel = 0;
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

// -----------------------------------------------------------------------------
// Sensor reading
// -----------------------------------------------------------------------------

void readSensors(CargoPacket &pkt) {
  if (ahtReady) {
    sensors_event_t humEvt, tempEvt;
    aht.getEvent(&humEvt, &tempEvt);
    if (!isnan(tempEvt.temperature))          lastTempC    = tempEvt.temperature;
    if (!isnan(humEvt.relative_humidity))     lastHumidity = humEvt.relative_humidity;
  }

  if (bmpReady) {
    const int32_t pressurePa = bmp.readPressure();
    if (pressurePa > 0) lastPressureHpa = (float)pressurePa / 100.0f;
  }

  if (mpuReady) {
    sensors_event_t accelEvt, gyroEvt, tempEvt;
    mpu.getEvent(&accelEvt, &gyroEvt, &tempEvt);
    lastTiltDeg = computeTiltDeg(
      accelEvt.acceleration.x,
      accelEvt.acceleration.y,
      accelEvt.acceleration.z);
    lastShock = computeShockFlag(
      accelEvt.acceleration.x,
      accelEvt.acceleration.y,
      accelEvt.acceleration.z);
  }

  pkt.gasRaw   = (uint16_t)constrain(analogRead(PIN_MQ2_AO), 0, 4095);
  pkt.tempC    = lastTempC;
  pkt.humidity = lastHumidity;
  pkt.pressure = lastPressureHpa;
  pkt.tilt     = lastTiltDeg;
  pkt.shock    = lastShock;
}

void printCycleDebug(const CargoPacket &pkt, bool realTime) {
  Serial.printf("[DATA] seq=%lu ts=%lu realTime=%u temp=%.2fC hum=%.2f%% pressure=%.2fhPa tilt=%.2fdeg gas=%u shock=%u sdOk=%u\n",
                (unsigned long)pkt.seq,
                (unsigned long)pkt.ts,
                realTime ? 1 : 0,
                pkt.tempC,
                pkt.humidity,
                pkt.pressure,
                pkt.tilt,
                (unsigned int)pkt.gasRaw,
                pkt.shock ? 1 : 0,
                pkt.sdOk ? 1 : 0);
}

// -----------------------------------------------------------------------------
// Setup / loop
// -----------------------------------------------------------------------------

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(200);
  Serial.println("\n=== Smart Cargo Container Node Boot ===");

  Serial.printf("[PIN] I2C SDA=%d SCL=%d\n", PIN_I2C_SDA, PIN_I2C_SCL);
  Serial.printf("[PIN] MQ2 AO=%d\n", PIN_MQ2_AO);
  Serial.printf("[PIN] SD CS=%d MOSI=%d SCK=%d MISO=%d\n",
                PIN_SD_CS, PIN_SD_MOSI, PIN_SD_SCK, PIN_SD_MISO);
  Serial.printf("[PIN] INMP441 placeholders WS=%d BCLK=%d SD=%d (deferred)\n",
                PIN_I2S_WS, PIN_I2S_BCLK, PIN_I2S_SD);

  pinMode(PIN_MQ2_AO, INPUT);
  analogReadResolution(12);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  scanI2CBus();

  ahtReady = aht.begin();
  Serial.printf("[AHT10]   %s\n", ahtReady ? "Ready" : "Init failed");

  bmpReady = bmp.begin();
  Serial.printf("[BMP180]  %s\n", bmpReady ? "Ready" : "Init failed");

  mpuReady = mpu.begin();
  Serial.printf("[MPU6050] %s\n", mpuReady ? "Ready" : "Init failed");

  if (mpuReady) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  SPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  sdReady       = initSDCard();
  lastSdRetryMs = millis();

  initEspNow();

  Serial.println("[BOOT] Setup complete. Waiting for time sync from gateway...");
}

void loop() {
  const unsigned long now = millis();

  if (now - lastCycleMs < TELEMETRY_INTERVAL_MS) return;
  lastCycleMs = now;

  // Resolve timestamp
  bool realTime = false;
  uint32_t ts   = getRealTime(realTime);

  CargoPacket pkt{};
  pkt.seq = sequenceNo++;
  pkt.ts  = ts;

  readSensors(pkt);

  // SD write with retry
  bool sdWriteOk = false;
  if (!sdReady && (now - lastSdRetryMs >= SD_RETRY_INTERVAL_MS)) {
    Serial.println("[SD] Retry init...");
    lastSdRetryMs = now;
    sdReady = initSDCard();
  }
  if (sdReady) {
    sdWriteOk = appendLogCsv(pkt, true, realTime);
    if (!sdWriteOk) sdReady = false;
  }
  pkt.sdOk = sdWriteOk;

  // Transmit to gateway
  if (espNowReady) {
    esp_err_t sendErr = esp_now_send(
      GATEWAY_NODE_MAC,
      reinterpret_cast<const uint8_t *>(&pkt),
      sizeof(pkt));
    if (sendErr != ESP_OK) {
      Serial.printf("[ESP-NOW] Send enqueue failed: %d\n", (int)sendErr);
    }
  } else {
    Serial.println("[ESP-NOW] Not ready. Packet not sent.");
  }

  printCycleDebug(pkt, realTime);
}
