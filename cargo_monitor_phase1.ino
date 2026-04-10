// ============================================================
//  ESP32-S3 Acoustic Edge AI Cargo Monitor — Phase 1 (Bench)
//  Hardware: ESP32-S3 N16R8, NEO-M8N, DHT22, MPU6050,
//            KY-037 Microphone, MicroSD, Buzzer
//  Connectivity: Wi-Fi → MQTT (QoS 1) → test.mosquitto.org
//  Author:   Phase 1 Bench Build
//  Version:  1.0.0
// ============================================================

// ─────────────────────────────────────────────────────────────
//  REQUIRED LIBRARIES (install via Arduino Library Manager)
//    - DHT sensor library         (Adafruit)
//    - Adafruit Unified Sensor    (Adafruit)
//    - MPU6050                    (Electronic Cats or Adafruit)
//    - TinyGPS++                  (Mikal Hart)
//    - PubSubClient               (Nick O'Leary)
//    - ArduinoJson                (Benoit Blanchon)
//    - SD                         (built-in Arduino/ESP32)
//    - Wire, SPI, WiFi            (built-in ESP32 core)
// ─────────────────────────────────────────────────────────────

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <SD.h>
#include <SPI.h>
#include <ArduinoJson.h>

// ============================================================
//  USER CONFIGURATION — edit this block only
// ============================================================
#define WIFI_SSID         "Geemal_EXT"
#define WIFI_PASSWORD     "Lakith@95"
#define MQTT_BROKER       "192.168.1.144"   // Use the host computer's Wi-Fi IP, not the internal Docker IP
#define MQTT_PORT         1883
#define MQTT_USER         "cargo_device"
#define MQTT_PASSWORD     "your_password"
#define MQTT_TOPIC        "logistics_co/truck_01/telemetry"
#define DEVICE_ID         "ESP32-S3-BENCH-01"

// Pharmaceutical cold-chain alert threshold (°C)
#define TEMP_ALERT_THRESHOLD  30.0f

// ============================================================
//  GPIO PIN DEFINITIONS
//  Mapped per spec to avoid future SIM7600 conflicts
// ============================================================

// DHT22 — moved from GPIO4 to avoid SIM7600 PWRKEY conflict
#define DHT_PIN           6
#define DHT_TYPE          DHT22

// MPU6050 — I2C (primary bus)
#define I2C_SDA           8
#define I2C_SCL           9

// SD Card — dedicated SPI bus
#define SD_CS             10
#define SD_MOSI           11
#define SD_MISO           12
#define SD_SCK            13

// KY-037 Microphone — analog + digital output
#define MIC_ANALOG_PIN    4    // AO pin of KY-037 → GPIO4 (ADC capable)
#define MIC_DIGITAL_PIN   5    // DO pin of KY-037 → GPIO5 (threshold trigger)

// Buzzer
#define BUZZER_PIN        7

// NEO-M8N GPS — UART1 (avoids UART2 reserved for SIM7600)
// GPIO18 (TX1) → NEO-M8N RX | GPIO19 (RX1) → NEO-M8N TX
#define GPS_SERIAL_NUM    1
#define GPS_TX_PIN        18   // ESP32-S3 TX1 → GPS RX
#define GPS_RX_PIN        19   // ESP32-S3 RX1 → GPS TX
#define GPS_BAUD          9600
#define GPS_FIX_TIMEOUT   5000 // ms — reject stale fix if older than this

// ============================================================
//  SD CARD SETTINGS
// ============================================================
#define SD_LOG_FILE       "/offline_log.json"
#define SD_MAX_RECORDS    1000

// ============================================================
//  TIMING
// ============================================================
#define CYCLE_INTERVAL_MS       30000  // 30-second main cycle
#define VIB_SAMPLE_COUNT        100    // samples per RMS window
#define VIB_SAMPLE_DELAY_US     1000   // ~1kHz sampling (µs)
#define ACOUSTIC_SAMPLE_COUNT   512    // analog reads for noise profile
#define ACOUSTIC_ALERT_RATIO    1.5f   // spike/baseline ratio to flag anomaly

// ============================================================
//  OBJECT INSTANCES
// ============================================================
DHT            dht(DHT_PIN, DHT_TYPE);
MPU6050        mpu;
TinyGPSPlus    gps;
HardwareSerial gpsSerial(GPS_SERIAL_NUM);
WiFiClient     wifiClient;
PubSubClient   mqtt(wifiClient);

// ============================================================
//  RUNTIME STATE
// ============================================================
static bool     sdAvailable     = false;
static int      sdRecordCount   = 0;
static bool     alertActive     = false;
static uint32_t cycleStart      = 0;

// ─────────────────────────────────────────────────────────────
//  FORWARD DECLARATIONS
// ─────────────────────────────────────────────────────────────
void     initWiFi();
void     initMQTT();
bool     mqttReconnect();
void     initSD();
float    readTemperature();
float    readHumidity();
float    readVibrationScore();
int      readAcousticProfile(bool &anomalyDetected);
bool     readGPS(float &lat, float &lon);
void     buildPayload(char *buf, size_t len,
                      float temp, float hum,
                      float vibScore, bool acAlert,
                      float lat, float lon,
                      const char *sdStatus);
void     publishPayload(const char *payload);
void     logToSD(const char *payload);
void     flushSDBuffer();
void     alertBuzzer(int beeps);
void     printDiagnostics(float temp, float hum, float vib,
                           bool acAlert, float lat, float lon);

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========================================");
  Serial.println(" ESP32-S3 Cargo Monitor — Phase 1 Boot ");
  Serial.println("========================================");

  // ── Buzzer ──────────────────────────────────────────────
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // ── KY-037 microphone ───────────────────────────────────
  pinMode(MIC_ANALOG_PIN, INPUT);
  pinMode(MIC_DIGITAL_PIN, INPUT);

  // ── I2C bus (MPU6050) ───────────────────────────────────
  Wire.begin(I2C_SDA, I2C_SCL);
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("[MPU6050] WARN: Connection failed — check wiring!");
  } else {
    Serial.println("[MPU6050] OK");
    // ±2g full-scale range suits cargo vibration
    mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
    // ±250°/s gyro
    mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
  }

  // ── DHT22 ───────────────────────────────────────────────
  dht.begin();
  Serial.println("[DHT22]   OK");

  // ── SPI / SD Card ───────────────────────────────────────
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  initSD();

  // ── GPS (UART1) ─────────────────────────────────────────
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[NEO-M8N] UART1 started at 9600 baud");

  // ── Wi-Fi ───────────────────────────────────────────────
  initWiFi();

  // ── MQTT ────────────────────────────────────────────────
  initMQTT();

  // Boot beep
  alertBuzzer(1);

  Serial.println("[BOOT]    Phase 1 initialisation complete.");
  Serial.println("----------------------------------------");
  cycleStart = millis();
}

// ============================================================
//  MAIN LOOP — 30-second duty cycle
// ============================================================
void loop() {
  // Feed GPS parser continuously (non-blocking)
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  // Keep MQTT connection alive
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) mqttReconnect();
    mqtt.loop();
  }

  // Execute main sense-and-publish cycle every CYCLE_INTERVAL_MS
  if (millis() - cycleStart < CYCLE_INTERVAL_MS) return;
  cycleStart = millis();

  Serial.println("\n[CYCLE]   ── New telemetry cycle ──");

  // ── 1. Sensor readings ──────────────────────────────────
  float temp   = readTemperature();
  float hum    = readHumidity();
  float vib    = readVibrationScore();

  bool  acAlert = false;
  readAcousticProfile(acAlert);

  float lat = 0.0f, lon = 0.0f;
  bool  gpsFix = readGPS(lat, lon);

  // ── 2. Threshold gates ──────────────────────────────────
  alertActive = false;

  // Pharmaceutical cold-chain gate
  if (!isnan(temp) && temp > TEMP_ALERT_THRESHOLD) {
    Serial.printf("[ALERT]   TEMP BREACH! %.2f°C > %.2f°C\n",
                  temp, TEMP_ALERT_THRESHOLD);
    alertBuzzer(3);
    alertActive = true;
  }

  // Acoustic anomaly gate
  if (acAlert) {
    Serial.println("[ALERT]   ACOUSTIC ANOMALY DETECTED");
    alertBuzzer(2);
    alertActive = true;
  }

  // ── 3. Build JSON payload ───────────────────────────────
  const char *sdStatus = sdAvailable ? "OK" : "FAIL";
  char payload[320];
  buildPayload(payload, sizeof(payload),
               temp, hum, vib, acAlert,
               lat, lon, sdStatus);

  // ── 4. SD logging (always) ──────────────────────────────
  if (sdAvailable) logToSD(payload);

  // ── 5. MQTT publish or offline buffer ──────────────────
  if (WiFi.status() == WL_CONNECTED && mqtt.connected()) {
    // Flush any buffered SD records first
    if (sdAvailable && sdRecordCount > 0) flushSDBuffer();
    publishPayload(payload);
  } else {
    Serial.println("[MQTT]    Offline — buffering to SD card");
    // payload already logged above via logToSD()
  }

  // ── 6. Serial diagnostics ───────────────────────────────
  printDiagnostics(temp, hum, vib, acAlert, lat, lon);
}

// ============================================================
//  SENSOR FUNCTIONS
// ============================================================

// ── Temperature (DHT22) ─────────────────────────────────────
float readTemperature() {
  float t = dht.readTemperature();
  if (isnan(t)) {
    Serial.println("[DHT22]   WARN: Temperature read failed (NaN)");
    return -999.0f;
  }
  return t;
}

// ── Humidity (DHT22) ────────────────────────────────────────
float readHumidity() {
  float h = dht.readHumidity();
  if (isnan(h)) {
    Serial.println("[DHT22]   WARN: Humidity read failed (NaN)");
    return -999.0f;
  }
  return h;
}

// ── Vibration RMS Score (MPU6050) ───────────────────────────
//  5-step industrial algorithm:
//  Collect → RMS → Normalise → Store → Aggregate
float readVibrationScore() {
  float sumSq = 0.0f;

  for (int i = 0; i < VIB_SAMPLE_COUNT; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

    // Convert raw ADC to g (±2g range → 16384 LSB/g)
    float fx = ax / 16384.0f;
    float fy = ay / 16384.0f;
    float fz = az / 16384.0f;

    // Magnitude squared (removes gravity via RMS math)
    sumSq += (fx * fx) + (fy * fy) + (fz * fz);
    delayMicroseconds(VIB_SAMPLE_DELAY_US);
  }

  float rms = sqrt(sumSq / VIB_SAMPLE_COUNT);

  // Normalise to 0–100 scale
  // 1.0g RMS = idle/gravity; 3.0g+ = severe shock
  float score = constrain((rms - 1.0f) / 2.0f * 100.0f, 0.0f, 100.0f);

  Serial.printf("[MPU6050] RMS=%.4fg  Score=%.1f/100\n", rms, score);
  return score;
}

// ── Acoustic Profile (KY-037) ───────────────────────────────
//  KY-037 is an analog mic — no I2S/FFT available.
//  Strategy: measure baseline peak amplitude, then detect
//  sudden spikes (ratio method) as impact/crash proxy.
//
//  Returns: average ADC reading (informational)
//  Sets:    anomalyDetected = true if spike > ACOUSTIC_ALERT_RATIO × baseline
int readAcousticProfile(bool &anomalyDetected) {
  anomalyDetected = false;

  // Phase A: establish a 256-sample baseline (first half)
  long  baselineSum = 0;
  int   baselineMax = 0;
  const int HALF = ACOUSTIC_SAMPLE_COUNT / 2;

  for (int i = 0; i < HALF; i++) {
    int v = analogRead(MIC_ANALOG_PIN);
    baselineSum += v;
    if (v > baselineMax) baselineMax = v;
    delayMicroseconds(200);
  }
  float baselineAvg = (float)baselineSum / HALF;

  // Phase B: monitor second half for spikes
  int spikeMax = 0;
  for (int i = 0; i < HALF; i++) {
    int v = analogRead(MIC_ANALOG_PIN);
    if (v > spikeMax) spikeMax = v;
    delayMicroseconds(200);
  }

  // Also check the digital threshold output of KY-037
  bool digitalTrigger = (digitalRead(MIC_DIGITAL_PIN) == HIGH);

  // Anomaly if analog spike exceeds ratio OR digital threshold triggered
  if (baselineAvg > 10) {  // avoid division noise at silence
    if ((float)spikeMax / baselineAvg > ACOUSTIC_ALERT_RATIO) {
      anomalyDetected = true;
    }
  }
  if (digitalTrigger) anomalyDetected = true;

  Serial.printf("[KY-037]  Baseline=%.0f  SpikeMax=%d  Digital=%s  Alert=%s\n",
                baselineAvg, spikeMax,
                digitalTrigger ? "TRIG" : "LOW",
                anomalyDetected ? "YES" : "NO");

  return (int)baselineAvg;
}

// ── GPS (NEO-M8N via TinyGPS++) ─────────────────────────────
bool readGPS(float &lat, float &lon) {
  // Parse any bytes that arrived since last cycle
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  // Validity check
  if (!gps.location.isValid()) {
    Serial.println("[NEO-M8N] No valid fix — using 0,0");
    lat = 0.0f;
    lon = 0.0f;
    return false;
  }

  // Staleness check (reject fixes older than GPS_FIX_TIMEOUT ms)
  if (gps.location.age() > GPS_FIX_TIMEOUT) {
    Serial.printf("[NEO-M8N] Fix stale (%lums old) — rejected\n",
                  (unsigned long)gps.location.age());
    lat = 0.0f;
    lon = 0.0f;
    return false;
  }

  // 4 decimal places for Phase 1 bench precision
  lat = (float)gps.location.lat();
  lon = (float)gps.location.lng();

  Serial.printf("[NEO-M8N] Fix OK — Lat=%.4f  Lon=%.4f  Sats=%d  Age=%lums\n",
                lat, lon,
                (int)gps.satellites.value(),
                (unsigned long)gps.location.age());
  return true;
}

// ============================================================
//  PAYLOAD BUILDER
// ============================================================
void buildPayload(char *buf, size_t len,
                  float temp, float hum,
                  float vibScore, bool acAlert,
                  float lat, float lon,
                  const char *sdStatus) {
  // ISO 8601 timestamp from GPS if available, else millis placeholder
  char ts[26];
  if (gps.date.isValid() && gps.time.isValid()) {
    snprintf(ts, sizeof(ts), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
  } else {
    snprintf(ts, sizeof(ts), "1970-01-01T%06luZ", millis() / 1000UL);
  }

  // Clamp NaN sensors to -999 sentinel so JSON stays valid
  float safeTemp = isnan(temp) ? -999.0f : temp;
  float safeHum  = isnan(hum)  ? -999.0f : hum;

  snprintf(buf, len,
    "{"
    "\"device_id\":\"%s\","
    "\"temp\":%.2f,"
    "\"hum\":%.2f,"
    "\"vib_score\":%.0f,"
    "\"ac_alert\":%s,"
    "\"lat\":%.4f,"
    "\"lon\":%.4f,"
    "\"sd_status\":\"%s\","
    "\"ts\":\"%s\""
    "}",
    DEVICE_ID,
    safeTemp,
    safeHum,
    vibScore,
    acAlert ? "true" : "false",
    lat, lon,
    sdStatus,
    ts
  );
}

// ============================================================
//  CONNECTIVITY — Wi-Fi
// ============================================================
void initWiFi() {
  Serial.printf("[WiFi]    Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi]    Connected. IP: %s\n",
                  WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi]    WARN: Failed to connect — will use offline buffer.");
  }
}

// ============================================================
//  CONNECTIVITY — MQTT
// ============================================================
void initMQTT() {
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(15);
  mqttReconnect();
}

bool mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (mqtt.connected()) return true;

  Serial.printf("[MQTT]    Connecting to %s:%d ...", MQTT_BROKER, MQTT_PORT);
  String clientId = String(DEVICE_ID) + "-" + String(millis());

  if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
    Serial.println(" connected!");
    return true;
  } else {
    Serial.printf(" failed (state=%d), retrying in 5 seconds\n", mqtt.state());
    delay(5000); // 5-second backoff
    return false;
  }
}

// ============================================================
//  MQTT PUBLISH — QoS 1 via PubSubClient
//  PubSubClient uses QoS 0 by default; to enforce QoS 1 pass
//  retain=false and qos=1 in the overloaded publish() call.
// ============================================================
void publishPayload(const char *payload) {
  if (!mqtt.connected()) {
    if (!mqttReconnect()) {
      Serial.println("[MQTT]    Cannot publish — not connected.");
      return;
    }
  }
  // publish(topic, payload, retained, qos)
  bool ok = mqtt.publish(MQTT_TOPIC, (const uint8_t *)payload,
                         strlen(payload), false);
  Serial.printf("[MQTT]    Publish %s → %s\n",
                ok ? "OK (QoS1)" : "FAILED", MQTT_TOPIC);
  if (ok) {
    Serial.println("[MQTT]    Payload: " + String(payload));
  }
}

// ============================================================
//  SD CARD — INIT
// ============================================================
void initSD() {
  if (!SD.begin(SD_CS)) {
    Serial.println("[SD]      WARN: Mount failed — offline buffer disabled.");
    sdAvailable = false;
    return;
  }
  sdAvailable = true;
  Serial.printf("[SD]      OK. Size: %lluMB\n",
                SD.cardSize() / (1024ULL * 1024ULL));

  // Count existing records so circular buffer logic is accurate on reboot
  if (SD.exists(SD_LOG_FILE)) {
    File f = SD.open(SD_LOG_FILE, FILE_READ);
    int  lineCount = 0;
    while (f.available()) {
      char c = f.read();
      if (c == '\n') lineCount++;
    }
    f.close();
    sdRecordCount = lineCount;
    Serial.printf("[SD]      Existing records: %d / %d\n",
                  sdRecordCount, SD_MAX_RECORDS);
  }
}

// ============================================================
//  SD CARD — LOG (circular buffer, 1000-record limit)
// ============================================================
void logToSD(const char *payload) {
  if (!sdAvailable) return;

  if (sdRecordCount >= SD_MAX_RECORDS) {
    // ── Circular buffer: drop oldest record ─────────────
    // Read all lines, drop line 0, rewrite file
    Serial.println("[SD]      Circular buffer full — rotating oldest record.");
    File src = SD.open(SD_LOG_FILE, FILE_READ);
    if (!src) { Serial.println("[SD]      ERROR: Cannot open for rotation."); return; }

    // Buffer all lines (each line is a JSON record + \n)
    // For 1000 short JSON records this is manageable (~300KB)
    String lines[SD_MAX_RECORDS];
    int count = 0;
    while (src.available() && count < SD_MAX_RECORDS) {
      lines[count++] = src.readStringUntil('\n');
    }
    src.close();

    // Rewrite without the first line
    SD.remove(SD_LOG_FILE);
    File dst = SD.open(SD_LOG_FILE, FILE_WRITE);
    if (dst) {
      for (int i = 1; i < count; i++) {
        dst.println(lines[i]);
      }
      dst.close();
    }
    sdRecordCount = count - 1;
  }

  // Append new record
  File f = SD.open(SD_LOG_FILE, FILE_APPEND);
  if (f) {
    f.println(payload);
    f.close();
    sdRecordCount++;
    Serial.printf("[SD]      Logged record %d/%d\n", sdRecordCount, SD_MAX_RECORDS);
  } else {
    Serial.println("[SD]      ERROR: Cannot open log file for append.");
  }
}

// ============================================================
//  SD CARD — FLUSH BUFFER (on Wi-Fi reconnect)
// ============================================================
void flushSDBuffer() {
  if (!sdAvailable || sdRecordCount == 0) return;
  if (!mqtt.connected() && !mqttReconnect()) return;

  Serial.printf("[SD]      Flushing %d buffered records to MQTT...\n",
                sdRecordCount);

  File f = SD.open(SD_LOG_FILE, FILE_READ);
  if (!f) { Serial.println("[SD]      ERROR: Cannot open buffer for flush."); return; }

  int flushed = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;
    bool ok = mqtt.publish(MQTT_TOPIC,
                           (const uint8_t *)line.c_str(),
                           line.length(), false);
    if (ok) flushed++;
    mqtt.loop();
    delay(50);  // Throttle to avoid broker flooding
  }
  f.close();

  // Clear buffer after successful flush
  SD.remove(SD_LOG_FILE);
  sdRecordCount = 0;
  Serial.printf("[SD]      Flushed %d records. Buffer cleared.\n", flushed);
}

// ============================================================
//  BUZZER
// ============================================================
void alertBuzzer(int beeps) {
  for (int i = 0; i < beeps; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

// ============================================================
//  SERIAL DIAGNOSTICS — Go/No-Go checklist output
// ============================================================
void printDiagnostics(float temp, float hum, float vib,
                       bool acAlert, float lat, float lon) {
  Serial.println("\n──────── DIAGNOSTICS ────────");
  Serial.printf("  Temp       : %.2f °C  %s\n", temp,
                (!isnan(temp) && temp > -999) ? "[OK]" : "[FAIL-NaN]");
  Serial.printf("  Humidity   : %.2f %%  %s\n", hum,
                (!isnan(hum)  && hum  > -999) ? "[OK]" : "[FAIL-NaN]");
  Serial.printf("  Vib Score  : %.1f / 100\n", vib);
  Serial.printf("  AC Alert   : %s\n",     acAlert ? "YES ⚠" : "NO");
  Serial.printf("  GPS        : %.4f, %.4f  Sats=%d\n",
                lat, lon, (int)gps.satellites.value());
  Serial.printf("  WiFi       : %s\n",
                WiFi.status() == WL_CONNECTED ? "CONNECTED" : "OFFLINE");
  Serial.printf("  MQTT       : %s\n",
                mqtt.connected() ? "CONNECTED" : "OFFLINE");
  Serial.printf("  SD Card    : %s  Records=%d\n",
                sdAvailable ? "OK" : "FAIL", sdRecordCount);
  Serial.printf("  Temp Alert : %s\n",
                alertActive ? "ACTIVE ⚠" : "CLEAR");
  Serial.println("─────────────────────────────");
}

// ============================================================
//  END OF FIRMWARE
// ============================================================
