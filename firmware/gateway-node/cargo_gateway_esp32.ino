// 1. DEFINES MUST COME BEFORE TinyGSM INCLUDE
#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024
#define TINY_GSM_DEBUG Serial
#define MQTT_MAX_PACKET_SIZE 1024

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_idf_version.h>
#include <TinyGsmClient.h>
#include <TinyGPSPlus.h>
#include <PubSubClient.h>
#include <SSLClient.h>
#include <ArduinoJson.h>
#include "trust_anchors.h"
#include "CargoPacket.h"
#include "TimeSyncPacket.h"

// -----------------------------------------------------------------------------
// Configuration (TODO: move credentials to secure secrets storage)
// -----------------------------------------------------------------------------

// Pin map (ESP32-WROOM-32 / N4 gateway)
static const int PIN_GPS_RX = 27;
static const int PIN_GPS_TX = 26;
static const int PIN_GSM_RX = 16;
static const int PIN_GSM_TX = 17;

// Fixed identities
static const char    GATEWAY_MAC_STR[]   = "EC:E3:34:23:43:24";
static const char    SENSOR_MAC_STR[]    = "AC:A7:04:27:BD:00";
static const uint8_t SENSOR_MAC_BYTES[6] = {0xAC, 0xA7, 0x04, 0x27, 0xBD, 0x00};

// APN (Mobitel)
static const char APN[]      = "mobitel";
static const char APN_USER[] = "";
static const char APN_PASS[] = "";

// EMQX Serverless endpoint and credentials
static const char     MQTT_BROKER_HOST[] = "i8e0f149.ala.asia-southeast1.emqxsl.com";
static const uint16_t MQTT_BROKER_PORT   = 8883;
static const char     MQTT_USERNAME[]    = "cabin_node";
static const char     MQTT_PASSWORD[]    = "6HYUvbJEkeFr9m4";

// GhostProxy transport endpoint (optional)
static const bool     GHOSTPROXY_ENABLED = false;
static const char     GHOSTPROXY_HOST[]  = "198.51.100.10";
static const uint16_t GHOSTPROXY_PORT    = 443;

// Canonical routing
static const char TENANT_ID[]    = "demo";
static const char FLEET_ID[]     = "fleet-01";
static const char TRUCK_ID[]     = "TRUCK01";
static const char CONTAINER_ID[] = "CONT01";
static const char MQTT_TOPIC[]   = "tenant/demo/truck/TRUCK01/container/CONT01/telemetry";

// Serial and modem
static const uint32_t DEBUG_BAUD              = 115200;
static const uint32_t MODEM_BAUD              = 9600;
static const uint32_t GPS_BAUD                = 9600;
static const size_t   SERIAL_AT_RX_BUFFER_BYTES = 4096;
static const uint32_t GPS_BAUD_SCAN_INTERVAL_MS = 15000;
static const uint32_t GPS_STREAM_STALE_MS       = 3000;
static const uint32_t GPS_WARMUP_MS             = 90000;
static const uint32_t GPS_BAUD_CANDIDATES[]     = {9600, 38400, 19200, 57600, 115200};
static const int      GPS_UART_PIN_CANDIDATES[][2] = {
  {PIN_GPS_RX, PIN_GPS_TX},
  {PIN_GPS_TX, PIN_GPS_RX},
};

// Non-blocking timing
static const uint32_t RECONNECT_INTERVAL_MS  = 5000;
static const uint32_t STATUS_LOG_INTERVAL_MS = 5000;
static const uint32_t MIN_PUBLISH_GAP_MS     = 800;
static const uint16_t MQTT_BUFFER_BYTES      = 1024;

// Time sync to container node
static const uint32_t TIME_SYNC_INTERVAL_MS = 30000;  // every 30 s

// Minimum plausible unix timestamp (2024-01-01 00:00:00 UTC)
static const uint32_t MIN_VALID_UNIX_TS = 1704067200UL;

// -----------------------------------------------------------------------------
// GhostProxy transport wrapper for SSLClient
// -----------------------------------------------------------------------------

class GhostProxyClient : public Client {
public:
  explicit GhostProxyClient(Client &inner) : inner_(inner) {}

  void configure(bool enabled, const char *proxyHost, uint16_t proxyPort) {
    enabled_   = enabled;
    proxyHost_ = proxyHost;
    proxyPort_ = proxyPort;
  }

  int connect(IPAddress ip, uint16_t port) override {
    if (enabled_ && proxyHost_ && proxyHost_[0] != '\0')
      return inner_.connect(proxyHost_, proxyPort_);
    return inner_.connect(ip, port);
  }

  int connect(const char *host, uint16_t port) override {
    requestedHost_ = host;
    requestedPort_ = port;
    if (enabled_ && proxyHost_ && proxyHost_[0] != '\0')
      return inner_.connect(proxyHost_, proxyPort_);
    return inner_.connect(host, port);
  }

  size_t  write(uint8_t b)                          override { return inner_.write(b); }
  size_t  write(const uint8_t *buf, size_t size)    override { return inner_.write(buf, size); }
  int     available()                               override { return inner_.available(); }
  int     read()                                    override { return inner_.read(); }
  int     read(uint8_t *buf, size_t size)           override { return inner_.read(buf, size); }
  int     peek()                                    override { return inner_.peek(); }
  void    flush()                                   override { inner_.flush(); }
  void    stop()                                    override { inner_.stop(); }
  uint8_t connected()                               override { return inner_.connected(); }
  operator bool()                                   override { return static_cast<bool>(inner_); }

  const char *requestedHost() const { return requestedHost_; }
  uint16_t    requestedPort() const { return requestedPort_; }

private:
  Client     &inner_;
  bool        enabled_       = false;
  const char *proxyHost_     = nullptr;
  uint16_t    proxyPort_     = 0;
  const char *requestedHost_ = nullptr;
  uint16_t    requestedPort_ = 0;
};

// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------

HardwareSerial SerialAT(1);   // GSM UART1
HardwareSerial SerialGPS(2);  // GPS UART2

TinyGsm         modem(SerialAT);
TinyGsmClient   raw_tcp_transport(modem);
GhostProxyClient base_client(raw_tcp_transport);
SSLClient        secure_client(base_client, TAs, (size_t)TAs_NUM, 34);
PubSubClient     mqtt_client(secure_client);

TinyGPSPlus gps;

portMUX_TYPE         packetMux         = portMUX_INITIALIZER_UNLOCKED;
volatile bool        packetReady       = false;
volatile uint32_t    rejectedMacCount  = 0;
volatile uint32_t    rejectedLenCount  = 0;
CargoPacket          rxPacket{};

bool        publishPending    = false;
CargoPacket publishPacketData{};

unsigned long lastReconnectAttemptMs = 0;
unsigned long lastStatusLogMs        = 0;
unsigned long lastPublishMs          = 0;
unsigned long lastTimeSyncMs         = 0;
unsigned long bootMs                 = 0;

unsigned long gpsLastByteMs        = 0;
unsigned long gpsLastBaudScanMs    = 0;
uint32_t      gpsActiveBaud        = GPS_BAUD;
uint32_t      gpsRawByteCount      = 0;
size_t        gpsBaudCandidateIndex = 0;
size_t        gpsPinCandidateIndex  = 0;
int           gpsActiveRxPin       = PIN_GPS_RX;
int           gpsActiveTxPin       = PIN_GPS_TX;

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

bool macEquals(const uint8_t *a, const uint8_t *b) {
  for (int i = 0; i < 6; ++i) if (a[i] != b[i]) return false;
  return true;
}

String macToString(const uint8_t *mac) {
  char s[18];
  snprintf(s, sizeof(s), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(s);
}

void beginGpsUart(uint32_t baud, int rxPin, int txPin) {
  SerialGPS.end();
  SerialGPS.begin(baud, SERIAL_8N1, rxPin, txPin);
  gpsActiveBaud   = baud;
  gpsActiveRxPin  = rxPin;
  gpsActiveTxPin  = txPin;
  gpsLastBaudScanMs = millis();
  Serial.printf("[GPS] UART configured rx=%d tx=%d baud=%lu\n",
                gpsActiveRxPin, gpsActiveTxPin, (unsigned long)baud);
}

void gpsPump() {
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
    gpsRawByteCount++;
    gpsLastByteMs = millis();
  }
}

void gpsMaybeScanBaud(unsigned long nowMs) {
  if (gps.location.isValid()) return;
  if (nowMs - gpsLastBaudScanMs < GPS_BAUD_SCAN_INTERVAL_MS) return;

  const bool hasRecentGpsBytes =
    (gpsRawByteCount > 0) && ((nowMs - gpsLastByteMs) <= GPS_STREAM_STALE_MS);
  const bool hasParsedNmea   = (gps.passedChecksum() > 0) || (gps.failedChecksum() > 0);
  const bool warmupElapsed   = (nowMs - bootMs) >= GPS_WARMUP_MS;

  if (hasParsedNmea || (hasRecentGpsBytes && !warmupElapsed)) {
    gpsLastBaudScanMs = nowMs;
    return;
  }

  gpsBaudCandidateIndex =
    (gpsBaudCandidateIndex + 1) %
    (sizeof(GPS_BAUD_CANDIDATES) / sizeof(GPS_BAUD_CANDIDATES[0]));
  if (gpsBaudCandidateIndex == 0) {
    gpsPinCandidateIndex =
      (gpsPinCandidateIndex + 1) %
      (sizeof(GPS_UART_PIN_CANDIDATES) / sizeof(GPS_UART_PIN_CANDIDATES[0]));
  }

  beginGpsUart(
    GPS_BAUD_CANDIDATES[gpsBaudCandidateIndex],
    GPS_UART_PIN_CANDIDATES[gpsPinCandidateIndex][0],
    GPS_UART_PIN_CANDIDATES[gpsPinCandidateIndex][1]);
}

// Howard Hinnant's civil-calendar algorithm (no stdlib required)
int64_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int      era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<int>(doe) - 719468;
}

// Try GPS → GSM network time → fall back to packet ts (boot-relative, wrong)
uint32_t resolveTimestamp(const CargoPacket &pkt, bool &usedGpsTime, bool &usedGsmTime) {
  usedGpsTime = false;
  usedGsmTime = false;

  // 1. GPS time (most accurate)
  if (gps.date.isValid() && gps.time.isValid()) {
    const int      year  = gps.date.year();
    const unsigned month = gps.date.month();
    const unsigned day   = gps.date.day();
    const int64_t  days  = daysFromCivil(year, month, day);
    const int64_t  ts    = days * 86400LL
                           + (int64_t)gps.time.hour()   * 3600LL
                           + (int64_t)gps.time.minute() * 60LL
                           + (int64_t)gps.time.second();
    if (ts >= (int64_t)MIN_VALID_UNIX_TS && ts <= 0xFFFFFFFFLL) {
      usedGpsTime = true;
      return (uint32_t)ts;
    }
  }

  // 2. GSM network time (requires AT+CLTS=1 and a recent GPRS attach)
  int   year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
  float tz   = 0.0f;
  if (modem.getNetworkTime(&year, &month, &day, &hour, &minute, &second, &tz)) {
    if (year >= 2024) {
      const int64_t days = daysFromCivil(year, month, day);
      const int64_t ts   = days * 86400LL
                           + (int64_t)hour   * 3600LL
                           + (int64_t)minute * 60LL
                           + (int64_t)second;
      // tz from SIM800 is in quarter-hours; convert to seconds and subtract to get UTC
      const int64_t utcTs = ts - (int64_t)(tz * 3600.0f);
      if (utcTs >= (int64_t)MIN_VALID_UNIX_TS) {
        usedGsmTime = true;
        Serial.printf("[TIME] GSM time: %04d-%02d-%02d %02d:%02d:%02d tz=%.2f → utc=%lld\n",
                      year, month, day, hour, minute, second, tz, (long long)utcTs);
        return (uint32_t)utcTs;
      }
    }
  }

  // 3. Last resort: packet ts (seconds-since-boot — timestamps will be wrong)
  Serial.println("[TIME] WARN: No real time source. ts is seconds-since-boot!");
  return pkt.ts;
}

void readGpsSnapshot(float &lat, float &lon, float &speedKph, bool &gpsFix) {
  gpsPump();
  gpsFix = gps.location.isValid();
  if (gpsFix) {
    lat      = (float)gps.location.lat();
    lon      = (float)gps.location.lng();
    speedKph = gps.speed.isValid() ? (float)gps.speed.kmph() : 0.0f;
  } else {
    lat = lon = speedKph = 0.0f;
  }
}

// -----------------------------------------------------------------------------
// ESP-NOW receive (telemetry from container node)
// -----------------------------------------------------------------------------

void handleEspNowData(const uint8_t *senderMac, const uint8_t *data, int len) {
  if (!senderMac || !data) return;

  if (!macEquals(senderMac, SENSOR_MAC_BYTES)) {
    rejectedMacCount++;
    return;
  }
  if (len != (int)sizeof(CargoPacket)) {
    rejectedLenCount++;
    return;
  }

  portENTER_CRITICAL_ISR(&packetMux);
  memcpy(&rxPacket, data, sizeof(CargoPacket));
  packetReady = true;
  portEXIT_CRITICAL_ISR(&packetMux);
}

#if (defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)) || \
    (defined(ESP_IDF_VERSION_MAJOR)     && (ESP_IDF_VERSION_MAJOR     >= 5))
void onEspNowReceive(const esp_now_recv_info_t *recvInfo, const uint8_t *data, int len) {
  if (!recvInfo) return;
  handleEspNowData(recvInfo->src_addr, data, len);
}
#else
void onEspNowReceive(const uint8_t *senderMac, const uint8_t *data, int len) {
  handleEspNowData(senderMac, data, len);
}
#endif

void onEspNowSent(const uint8_t *mac, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[ESP-NOW] TX to %s FAILED\n", macToString(mac).c_str());
  }
}

bool consumePacket(CargoPacket &pkt) {
  bool has = false;
  portENTER_CRITICAL(&packetMux);
  if (packetReady) {
    pkt         = rxPacket;
    packetReady = false;
    has         = true;
  }
  portEXIT_CRITICAL(&packetMux);
  return has;
}

void initEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  String localMac = WiFi.macAddress();
  localMac.toUpperCase();
  Serial.printf("[ESP-NOW] Local MAC=%s\n", localMac.c_str());
  Serial.printf("[ESP-NOW] Expect sender MAC=%s\n", SENSOR_MAC_STR);
  Serial.printf("[ESP-NOW] Gateway MAC target=%s\n", GATEWAY_MAC_STR);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init failed");
    return;
  }

  esp_now_register_recv_cb(onEspNowReceive);
  esp_now_register_send_cb(onEspNowSent);

  // Pre-register container node as peer so we can send time sync packets
  if (!esp_now_is_peer_exist(SENSOR_MAC_BYTES)) {
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, SENSOR_MAC_BYTES, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
      Serial.println("[ESP-NOW] Failed to add container peer");
    }
  }

  Serial.println("[ESP-NOW] RX callback ready");
}

// -----------------------------------------------------------------------------
// Time sync broadcast to container node
// -----------------------------------------------------------------------------

void broadcastTimeSync(unsigned long nowMs) {
  if (nowMs - lastTimeSyncMs < TIME_SYNC_INTERVAL_MS) return;

  // Resolve current time using a dummy packet (only the timestamp matters here)
  bool usedGpsTime = false;
  bool usedGsmTime = false;
  CargoPacket dummy{};
  uint32_t ts = resolveTimestamp(dummy, usedGpsTime, usedGsmTime);

  if (ts < MIN_VALID_UNIX_TS) {
    Serial.println("[TIMESYNC] No valid time source yet, skipping sync broadcast");
    return;
  }

  lastTimeSyncMs = nowMs;

  TimeSyncPacket syncPkt{};
  syncPkt.magic  = TIME_SYNC_MAGIC;
  syncPkt.unixTs = ts;

  esp_err_t err = esp_now_send(
    SENSOR_MAC_BYTES,
    reinterpret_cast<const uint8_t *>(&syncPkt),
    sizeof(TimeSyncPacket));

  Serial.printf("[TIMESYNC] Broadcast ts=%lu gps=%u gsm=%u err=%d\n",
                (unsigned long)ts,
                usedGpsTime ? 1 : 0,
                usedGsmTime ? 1 : 0,
                (int)err);
}

// -----------------------------------------------------------------------------
// Connectivity
// -----------------------------------------------------------------------------

bool ensureModemReady() {
  if (modem.testAT()) return true;
  Serial.println("[GSM] testAT failed, restarting modem...");
  modem.restart();
  if (!modem.testAT()) {
    Serial.println("[GSM] Modem not responding after restart");
    return false;
  }
  Serial.println("[GSM] Modem AT OK");
  return true;
}

bool ensureNetworkAndGprs() {
  if (!ensureModemReady()) return false;

  if (!modem.isNetworkConnected()) {
    Serial.println("[GSM] Waiting for network registration...");
    if (!modem.waitForNetwork(60000L, true)) {
      Serial.println("[GSM] Network registration failed");
      return false;
    }
    Serial.println("[GSM] Network registered");
  }

  if (!modem.isGprsConnected()) {
    Serial.printf("[GPRS] Connecting APN=%s ...\n", APN);
    if (!modem.gprsConnect(APN, APN_USER, APN_PASS)) {
      Serial.println("[GPRS] Connect failed");
      return false;
    }
    Serial.println("[GPRS] Connected");

    // Enable network time sync (NITZ) so GSM time is available immediately.
    // AT+CLTS=1 must be followed by a re-attach or modem restart to take effect
    // on some SIM800 firmware — saving to NVRAM with &W handles this on next boot.
    modem.sendAT("+CLTS=1");
    modem.waitResponse(2000);
    modem.sendAT("&W");
    modem.waitResponse(2000);
    Serial.println("[GSM] AT+CLTS=1 sent (network time sync enabled)");
  }

  return true;
}

bool reconnectMqtt() {
  secure_client.stop();
  base_client.stop();
  Serial.println("[MQTT] Socket cleanup done");

  if (!ensureNetworkAndGprs()) return false;

  base_client.configure(GHOSTPROXY_ENABLED, GHOSTPROXY_HOST, GHOSTPROXY_PORT);

  if (GHOSTPROXY_ENABLED) {
    Serial.printf("[TLS] GhostProxy ON transport=%s:%u sni-host=%s:%u\n",
                  GHOSTPROXY_HOST, GHOSTPROXY_PORT, MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  } else {
    Serial.printf("[TLS] GhostProxy OFF direct host=%s:%u\n",
                  MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  }

  mqtt_client.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  if (!mqtt_client.setBufferSize(MQTT_BUFFER_BYTES)) {
    Serial.printf("[MQTT] WARN setBufferSize(%u) failed\n", (unsigned int)MQTT_BUFFER_BYTES);
  }
  mqtt_client.setKeepAlive(90);
  mqtt_client.setSocketTimeout(25);

  const uint64_t efuseMac = ESP.getEfuseMac();
  String clientId = String("gateway-") + TRUCK_ID + "-" +
                    String((uint32_t)(efuseMac & 0xFFFFFFFF), HEX);
  clientId.toLowerCase();

  Serial.printf("[MQTT] Connecting clientId=%s user=%s\n", clientId.c_str(), MQTT_USERNAME);
  if (!mqtt_client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.printf("[MQTT] Connect failed rc=%d\n", mqtt_client.state());
    return false;
  }

  Serial.println("[MQTT] Connected over TLS 1.2");
  return true;
}

void maintainConnectivity(unsigned long nowMs) {
  if (mqtt_client.connected()) return;
  if (nowMs - lastReconnectAttemptMs < RECONNECT_INTERVAL_MS) return;
  lastReconnectAttemptMs = nowMs;
  Serial.println("[NET] Reconnect attempt...");
  if (!reconnectMqtt()) Serial.println("[NET] Reconnect failed");
}

// -----------------------------------------------------------------------------
// Publish
// -----------------------------------------------------------------------------

bool publishTelemetry(const CargoPacket &pkt) {
  float lat = 0.0f, lon = 0.0f, speedKph = 0.0f;
  bool  gpsFix     = false;
  bool  usedGpsTime = false;
  bool  usedGsmTime = false;

  readGpsSnapshot(lat, lon, speedKph, gpsFix);
  uint32_t ts = resolveTimestamp(pkt, usedGpsTime, usedGsmTime);

  const char *timeSource = usedGpsTime ? "gps" : (usedGsmTime ? "gsm" : "none");

  StaticJsonDocument<640> doc;
  doc["tenantId"]    = TENANT_ID;
  doc["fleetId"]     = FLEET_ID;
  doc["truckId"]     = TRUCK_ID;
  doc["containerId"] = CONTAINER_ID;
  doc["gatewayMac"]  = GATEWAY_MAC_STR;
  doc["sensorNodeMac"] = SENSOR_MAC_STR;
  doc["seq"]         = pkt.seq;
  doc["ts"]          = ts;
  doc["timeSource"]  = timeSource;  // helpful for debugging on the broker side

  JsonObject gpsObj = doc.createNestedObject("gps");
  gpsObj["lat"]      = lat;
  gpsObj["lon"]      = lon;
  gpsObj["speedKph"] = speedKph;

  JsonObject envObj = doc.createNestedObject("env");
  envObj["temperatureC"] = pkt.tempC;
  envObj["humidityPct"]  = pkt.humidity;
  envObj["pressureHpa"]  = pkt.pressure;

  JsonObject motionObj = doc.createNestedObject("motion");
  motionObj["tiltDeg"] = pkt.tilt;
  motionObj["shock"]   = pkt.shock;

  JsonObject gasObj = doc.createNestedObject("gas");
  gasObj["mq2Raw"] = pkt.gasRaw;
  gasObj["alert"]  = pkt.gasRaw > 1500;

  JsonObject statusObj = doc.createNestedObject("status");
  statusObj["sdOk"]   = pkt.sdOk;
  statusObj["gpsFix"] = gpsFix;
  statusObj["uplink"] = "gsm";

  char   payload[640];
  size_t payloadLen = serializeJson(doc, payload, sizeof(payload));

  const size_t topicLen     = strlen(MQTT_TOPIC);
  const size_t estPacketLen = topicLen + payloadLen + 10;
  if (estPacketLen > MQTT_BUFFER_BYTES) {
    Serial.printf("[PUB] WARN packet too large: topic=%u payload=%u est=%u buffer=%u\n",
                  (unsigned int)topicLen, (unsigned int)payloadLen,
                  (unsigned int)estPacketLen, (unsigned int)MQTT_BUFFER_BYTES);
  }

  bool ok = mqtt_client.publish(MQTT_TOPIC, payload, payloadLen);
  Serial.printf("[PUB] ok=%u seq=%lu ts=%lu timeSource=%s gpsFix=%u lat=%.6f lon=%.6f speed=%.2f\n",
                ok ? 1 : 0,
                (unsigned long)pkt.seq,
                (unsigned long)ts,
                timeSource,
                gpsFix ? 1 : 0,
                lat, lon, speedKph);
  if (!ok) {
    Serial.printf("[PUB] Failed, mqtt_state=%d topicLen=%u payloadLen=%u estPacket=%u buffer=%u\n",
                  mqtt_client.state(),
                  (unsigned int)topicLen, (unsigned int)payloadLen,
                  (unsigned int)estPacketLen, (unsigned int)MQTT_BUFFER_BYTES);
  }
  return ok;
}

void servicePublish(unsigned long nowMs) {
  if (!publishPending)          return;
  if (!mqtt_client.connected()) return;
  if (nowMs - lastPublishMs < MIN_PUBLISH_GAP_MS) return;

  lastPublishMs = nowMs;
  if (publishTelemetry(publishPacketData)) publishPending = false;
}

// -----------------------------------------------------------------------------
// Setup / loop
// -----------------------------------------------------------------------------

void setup() {
  Serial.begin(DEBUG_BAUD);
  delay(400);
  bootMs = millis();

  Serial.println("\n=== Smart Cargo Gateway Boot ===");
  Serial.println("Design: ESP32 SSLClient/BearSSL TLS + SIM800L raw TCP transport");
  Serial.printf("[CFG] APN=%s\n", APN);
  Serial.printf("[CFG] Topic=%s\n", MQTT_TOPIC);
  Serial.printf("[CFG] Broker host=%s port=%u\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  Serial.printf("[CFG] Time sync interval=%lus\n", (unsigned long)(TIME_SYNC_INTERVAL_MS / 1000));

  SerialAT.setRxBufferSize(SERIAL_AT_RX_BUFFER_BYTES);
  SerialAT.begin(MODEM_BAUD, SERIAL_8N1, PIN_GSM_RX, PIN_GSM_TX);

  // Find starting indices for baud/pin candidates
  for (size_t i = 0; i < sizeof(GPS_BAUD_CANDIDATES) / sizeof(GPS_BAUD_CANDIDATES[0]); ++i) {
    if (GPS_BAUD_CANDIDATES[i] == GPS_BAUD) { gpsBaudCandidateIndex = i; break; }
  }
  for (size_t i = 0; i < sizeof(GPS_UART_PIN_CANDIDATES) / sizeof(GPS_UART_PIN_CANDIDATES[0]); ++i) {
    if (GPS_UART_PIN_CANDIDATES[i][0] == PIN_GPS_RX &&
        GPS_UART_PIN_CANDIDATES[i][1] == PIN_GPS_TX) { gpsPinCandidateIndex = i; break; }
  }
  beginGpsUart(GPS_BAUD, PIN_GPS_RX, PIN_GPS_TX);

  // Optional modem DNS override
  SerialAT.println("AT+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\"");

  initEspNow();

  if (!ensureModemReady()) {
    Serial.println("[GSM] Modem not ready at boot; loop will retry.");
  }
}

void loop() {
  const unsigned long nowMs = millis();

  gpsPump();
  gpsMaybeScanBaud(nowMs);
  mqtt_client.loop();

  CargoPacket pkt{};
  if (consumePacket(pkt)) {
    publishPacketData = pkt;
    publishPending    = true;
    Serial.printf("[ESP-NOW] RX seq=%lu temp=%.2f hum=%.2f pressure=%.2f tilt=%.2f gas=%u shock=%u sdOk=%u\n",
                  (unsigned long)pkt.seq,
                  pkt.tempC, pkt.humidity, pkt.pressure, pkt.tilt,
                  (unsigned int)pkt.gasRaw,
                  pkt.shock ? 1 : 0,
                  pkt.sdOk  ? 1 : 0);
  }

  maintainConnectivity(nowMs);
  servicePublish(nowMs);
  broadcastTimeSync(nowMs);  // send UTC time to container node every 30 s

  if (nowMs - lastStatusLogMs >= STATUS_LOG_INTERVAL_MS) {
    lastStatusLogMs = nowMs;
    Serial.printf("[STATUS] net=%u gprs=%u mqtt=%u gpsFix=%u sats=%lu gpsAgeMs=%lu gpsChars=%lu nmeaOk=%lu nmeaBad=%lu gpsBaud=%lu gpsRx=%d gpsTx=%d pending=%u dropMac=%lu dropLen=%lu\n",
                  modem.isNetworkConnected() ? 1 : 0,
                  modem.isGprsConnected()    ? 1 : 0,
                  mqtt_client.connected()    ? 1 : 0,
                  gps.location.isValid()     ? 1 : 0,
                  (unsigned long)(gps.satellites.isValid() ? gps.satellites.value() : 0),
                  (unsigned long)(gps.location.isValid()   ? gps.location.age()     : 0),
                  (unsigned long)gps.charsProcessed(),
                  (unsigned long)gps.passedChecksum(),
                  (unsigned long)gps.failedChecksum(),
                  (unsigned long)gpsActiveBaud,
                  gpsActiveRxPin,
                  gpsActiveTxPin,
                  publishPending ? 1 : 0,
                  (unsigned long)rejectedMacCount,
                  (unsigned long)rejectedLenCount);

    if (!gps.location.isValid() && (nowMs - bootMs) >= GPS_WARMUP_MS) {
      if (gps.charsProcessed() == 0) {
        Serial.println("[GPS] No UART bytes seen. Check GPS TX->ESP RX wiring and module baud/protocol.");
      } else if (gps.passedChecksum() == 0 && gps.failedChecksum() == 0) {
        Serial.println("[GPS] UART bytes seen but no NMEA frames parsed. Module may be UBX-only or wrong baud.");
      } else {
        Serial.println("[GPS] NMEA is parsing but no location fix yet. Move antenna to open sky and wait.");
      }
    }
  }
}
