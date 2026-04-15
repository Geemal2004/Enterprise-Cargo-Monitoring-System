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
    f.println("seq,ts,tempC,humidity,pressure,tilt,gasRaw,shock,sdOk");
  }
  f.close();

  Serial.println("[SD] Ready.");
  return true;
}

bool appendLogCsv(const CargoPacket &pkt, bool sdFlagValue) {
  File f = SD.open(SD_LOG_FILE, FILE_APPEND);
  if (!f) {
    Serial.println("[SD] Open failed for append.");
    return false;
  }

  int written = f.printf("%lu,%lu,%.2f,%.2f,%.2f,%.2f,%u,%u,%u\n",
                         (unsigned long)pkt.seq,
                         (unsigned long)pkt.ts,
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

#if defined(ESP_IDF_VERSION_MAJOR) && (ESP_IDF_VERSION_MAJOR >= 5)
void onEspNowSent(const wifi_tx_info_t *txInfo, esp_now_send_status_t status) {
  (void)txInfo;
  Serial.printf("[ESP-NOW] Send => %s\n",
                status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}
#else
void onEspNowSent(const uint8_t *macAddr, esp_now_send_status_t status) {
  Serial.printf("[ESP-NOW] Send to %s => %s\n",
                macToString(macAddr).c_str(),
                status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}
#endif

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

  SPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
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
  pkt.ts = (uint32_t)(now / 1000UL);

  readSensors(pkt);

  // SD handling and retry strategy
  bool sdWriteOk = false;
  if (!sdReady && (now - lastSdRetryMs >= SD_RETRY_INTERVAL_MS)) {
    Serial.println("[SD] Retry init...");
    lastSdRetryMs = now;
    sdReady = initSDCard();
  }
  if (sdReady) {
    sdWriteOk = appendLogCsv(pkt, true);
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
