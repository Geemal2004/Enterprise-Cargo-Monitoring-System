// 1. DEFINES MUST COME BEFORE TinyGSM INCLUDE
#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024
#define TINY_GSM_DEBUG Serial
#define MQTT_MAX_PACKET_SIZE 1024
#define LED 2

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_idf_version.h>
#include <TinyGsmClient.h>
#include <TinyGPSPlus.h>
#include <PubSubClient.h>
#include <SSLClient.h>
#include <Update.h>
#include <ArduinoJson.h>
#include "trust_anchors.h"
#include "CargoPacket.h"

// -----------------------------------------------------------------------------
// Configuration (TODO: move credentials to secure secrets storage)
// -----------------------------------------------------------------------------

// Pin map (ESP32-WROOM-32 / N4 gateway)
static const int PIN_GPS_RX = 27;
static const int PIN_GPS_TX = 26;
static const int PIN_GSM_RX = 16;
static const int PIN_GSM_TX = 17;

// Fixed identities
static const char GATEWAY_MAC_STR[] = "EC:E3:34:23:43:24";
static const char SENSOR_MAC_STR[] = "AC:A7:04:27:BD:00";
static const uint8_t SENSOR_MAC_BYTES[6] = {0xAC, 0xA7, 0x04, 0x27, 0xBD, 0x00};

// APN (Mobitel)
static const char APN[] = "mobitel";
static const char APN_USER[] = "";
static const char APN_PASS[] = "";

// EMQX Serverless endpoint and credentials
static const char MQTT_BROKER_HOST[] = "i8e0f149.ala.asia-southeast1.emqxsl.com";
static const uint16_t MQTT_BROKER_PORT = 8883;
static const char MQTT_USERNAME[] = "cabin_node";
static const char MQTT_PASSWORD[] = "6HYUvbJEkeFr9m4";

static const char OTA_COMMAND_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/gateway/command";
static const char OTA_STATUS_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/gateway/status";
static const char OTA_CONTAINER_CMD_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/container/command";
static const char OTA_CONTAINER_STATUS_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/container/status";
static const size_t OTA_CHUNK_SIZE = 200;
static const uint32_t OTA_PKT_BEGIN = 0x4F544142UL;
static const uint32_t OTA_PKT_CHUNK = 0x4F54414EUL;
static const uint32_t OTA_PKT_END = 0x4F544145UL;

// GhostProxy transport endpoint (optional)
// - When enabled, modem TCP connects to GHOSTPROXY_HOST:GHOSTPROXY_PORT.
// - TLS layer still uses MQTT_BROKER_HOST for SNI/certificate validation.
// You can set this false if your direct hostname path is stable.
static const bool GHOSTPROXY_ENABLED = false;
static const char GHOSTPROXY_HOST[] = "198.51.100.10";  // proxy IP/host
static const uint16_t GHOSTPROXY_PORT = 443;

// Canonical routing
static const char TENANT_ID[] = "demo";
static const char FLEET_ID[] = "fleet-01";
static const char TRUCK_ID[] = "TRUCK01";
static const char CONTAINER_ID[] = "CONT01";
static const char MQTT_TOPIC[] = "tenant/demo/truck/TRUCK01/container/CONT01/telemetry";

// Serial and modem
static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t MODEM_BAUD = 9600;
static const uint32_t GPS_BAUD = 9600;
static const size_t SERIAL_AT_RX_BUFFER_BYTES = 4096;  // must be before SerialAT.begin()
static const uint32_t GPS_BAUD_SCAN_INTERVAL_MS = 15000;
static const uint32_t GPS_STREAM_STALE_MS = 3000;
static const uint32_t GPS_WARMUP_MS = 90000;
static const uint32_t GPS_BAUD_CANDIDATES[] = {9600, 38400, 19200, 57600, 115200};
static const int GPS_UART_PIN_CANDIDATES[][2] = {
  {PIN_GPS_RX, PIN_GPS_TX},
  {PIN_GPS_TX, PIN_GPS_RX},
};

// Non-blocking timing
static const uint32_t RECONNECT_INTERVAL_MS = 5000;
static const uint32_t STATUS_LOG_INTERVAL_MS = 5000;
static const uint32_t MIN_PUBLISH_GAP_MS = 800;
static const uint16_t MQTT_BUFFER_BYTES = 1024;
static const uint32_t TIME_SYNC_INTERVAL_MS = 30000;
static const uint32_t MIN_VALID_UNIX_TS = 1704067200UL;

// -----------------------------------------------------------------------------
// GhostProxy transport wrapper for SSLClient
// -----------------------------------------------------------------------------

class GhostProxyClient : public Client {
public:
  explicit GhostProxyClient(Client &inner) : inner_(inner) {}

  void configure(bool enabled, const char *proxyHost, uint16_t proxyPort) {
    enabled_ = enabled;
    proxyHost_ = proxyHost;
    proxyPort_ = proxyPort;
  }

  int connect(IPAddress ip, uint16_t port) override {
    if (enabled_ && proxyHost_ && proxyHost_[0] != '\0') {
      return inner_.connect(proxyHost_, proxyPort_);
    }
    return inner_.connect(ip, port);
  }

  int connect(const char *host, uint16_t port) override {
    requestedHost_ = host;
    requestedPort_ = port;
    if (enabled_ && proxyHost_ && proxyHost_[0] != '\0') {
      return inner_.connect(proxyHost_, proxyPort_);
    }
    return inner_.connect(host, port);
  }

  size_t write(uint8_t b) override { return inner_.write(b); }
  size_t write(const uint8_t *buf, size_t size) override { return inner_.write(buf, size); }
  int available() override { return inner_.available(); }
  int read() override { return inner_.read(); }
  int read(uint8_t *buf, size_t size) override { return inner_.read(buf, size); }
  int peek() override { return inner_.peek(); }
  void flush() override { inner_.flush(); }
  void stop() override { inner_.stop(); }
  uint8_t connected() override { return inner_.connected(); }
  operator bool() override { return static_cast<bool>(inner_); }

  const char *requestedHost() const { return requestedHost_; }
  uint16_t requestedPort() const { return requestedPort_; }

private:
  Client &inner_;
  bool enabled_ = false;
  const char *proxyHost_ = nullptr;
  uint16_t proxyPort_ = 0;
  const char *requestedHost_ = nullptr;
  uint16_t requestedPort_ = 0;
};

// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------

HardwareSerial SerialAT(1);   // GSM UART1
HardwareSerial SerialGPS(2);  // GPS UART2

TinyGsm modem(SerialAT);
TinyGsmClient raw_tcp_transport(modem, 0);   // SIM800L raw TCP for MQTT/TLS (MUX 0)
TinyGsmClient ota_http_client(modem, 1);     // SIM800L raw TCP for OTA HTTP (MUX 1)
GhostProxyClient base_client(raw_tcp_transport);
SSLClient secure_client(base_client, TAs, (size_t)TAs_NUM, 34);
PubSubClient mqtt_client(secure_client);

TinyGPSPlus gps;

portMUX_TYPE packetMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool packetReady = false;
volatile uint32_t rejectedMacCount = 0;
volatile uint32_t rejectedLengthCount = 0;
CargoPacket rxPacket{};

bool publishPending = false;
CargoPacket publishPacketData{};
unsigned long lastReconnectAttemptMs = 0;
unsigned long lastStatusLogMs = 0;
unsigned long lastPublishMs = 0;
unsigned long lastTimeSyncMs = 0;
unsigned long bootMs = 0;

bool otaPending = false;
bool otaIsForContainer = false;
char otaUrl[256] = {};
uint32_t otaExpectedSize = 0;
char otaFilename[64] = {};

unsigned long gpsLastByteMs = 0;
unsigned long gpsLastBaudScanMs = 0;
uint32_t gpsActiveBaud = GPS_BAUD;
uint32_t gpsRawByteCount = 0;
size_t gpsBaudCandidateIndex = 0;
size_t gpsPinCandidateIndex = 0;
int gpsActiveRxPin = PIN_GPS_RX;
int gpsActiveTxPin = PIN_GPS_TX;

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

bool macEquals(const uint8_t *a, const uint8_t *b) {
  for (int i = 0; i < 6; ++i) {
    if (a[i] != b[i]) return false;
  }
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
  gpsActiveBaud = baud;
  gpsActiveRxPin = rxPin;
  gpsActiveTxPin = txPin;
  gpsLastBaudScanMs = millis();
  Serial.printf("[GPS] UART configured rx=%d tx=%d baud=%lu\n",
                gpsActiveRxPin,
                gpsActiveTxPin,
                (unsigned long)baud);
}

struct OtaChunkPacket {
  uint32_t magic;
  uint32_t totalSize;
  uint32_t offset;
  uint16_t chunkLen;
  uint8_t data[OTA_CHUNK_SIZE];
};

struct OtaBeginPacket {
  uint32_t magic;
  uint32_t totalSize;
  char filename[64];
};

struct OtaEndPacket {
  uint32_t magic;
  uint32_t totalSize;
  uint32_t crc32;
};

static const uint32_t TIME_SYNC_MAGIC = 0x54494D45UL; // "TIME"
struct TimeSyncPacket {
  uint32_t magic;
  uint32_t unixTs;
};

struct ParsedHttpUrl {
  String host;
  uint16_t port;
  String path;
};

bool ensureNetworkAndGprs();
bool reconnectMqtt();
bool parseHttpUrl(const char *url, ParsedHttpUrl &parts);
bool openOtaHttpStream(const char *url, ParsedHttpUrl &parts, int32_t &contentLength);
uint32_t resolveTimestamp(const CargoPacket &pkt, bool &usedGpsTime, bool *usedGsmTime = nullptr);
void maintainConnectivity(unsigned long nowMs);
void publishOtaStatus(const char *target, const char *state, const char *message, uint8_t progress = 0);
void finishOtaFailure(const char *target, const char *message, bool abortUpdate = false);

bool parseHttpUrl(const char *url, ParsedHttpUrl &parts) {
  String raw = String(url ? url : "");
  raw.trim();

  if (!raw.startsWith("http://")) {
    Serial.printf("[OTA] Unsupported URL (expected http://): %s\n", raw.c_str());
    return false;
  }

  String remainder = raw.substring(7);
  const int slashIndex = remainder.indexOf('/');
  String hostPort = slashIndex >= 0 ? remainder.substring(0, slashIndex) : remainder;

  parts.path = slashIndex >= 0 ? remainder.substring(slashIndex) : "/";
  parts.port = 80;

  const int colonIndex = hostPort.lastIndexOf(':');
  if (colonIndex >= 0) {
    parts.host = hostPort.substring(0, colonIndex);
    const long parsedPort = hostPort.substring(colonIndex + 1).toInt();
    if (parsedPort > 0 && parsedPort <= 65535) {
      parts.port = (uint16_t)parsedPort;
    }
  } else {
    parts.host = hostPort;
  }

  if (parts.host.length() == 0) {
    Serial.println("[OTA] Parsed OTA host is empty");
    return false;
  }

  return true;
}

bool openOtaHttpStream(const char *url, ParsedHttpUrl &parts, int32_t &contentLength) {
  contentLength = -1;

  if (!parseHttpUrl(url, parts)) {
    return false;
  }

  if (!ensureNetworkAndGprs()) {
    Serial.println("[OTA] GSM/GPRS is not ready for HTTP download");
    return false;
  }

  ota_http_client.stop();
  ota_http_client.clearWriteError();
  ota_http_client.setTimeout(15000);

  Serial.printf("[OTA] Opening HTTP stream host=%s port=%u path=%s\n",
                parts.host.c_str(),
                parts.port,
                parts.path.c_str());

  if (!ota_http_client.connect(parts.host.c_str(), parts.port)) {
    Serial.println("[OTA] HTTP TCP connect failed over modem");
    return false;
  }

  ota_http_client.printf(
    "GET %s HTTP/1.1\r\n"
    "Host: %s:%u\r\n"
    "Connection: close\r\n"
    "User-Agent: smart-cargo-gateway-ota\r\n"
    "\r\n",
    parts.path.c_str(),
    parts.host.c_str(),
    parts.port
  );

  String statusLine = ota_http_client.readStringUntil('\n');
  statusLine.trim();
  if (statusLine.length() == 0) {
    Serial.println("[OTA] Empty HTTP status line");
    ota_http_client.stop();
    return false;
  }

  Serial.printf("[OTA] HTTP status: %s\n", statusLine.c_str());
  const int firstSpace = statusLine.indexOf(' ');
  const int secondSpace = firstSpace >= 0 ? statusLine.indexOf(' ', firstSpace + 1) : -1;
  const int statusCode =
      (firstSpace >= 0 && secondSpace > firstSpace)
          ? statusLine.substring(firstSpace + 1, secondSpace).toInt()
          : 0;

  if (statusCode != 200) {
    Serial.printf("[OTA] Unexpected HTTP status code: %d\n", statusCode);
    ota_http_client.stop();
    return false;
  }

  while (ota_http_client.connected()) {
    String headerLine = ota_http_client.readStringUntil('\n');
    if (headerLine == "\r" || headerLine.length() == 0) {
      break;
    }

    headerLine.trim();
    if (headerLine.startsWith("Content-Length:")) {
      contentLength = headerLine.substring(strlen("Content-Length:")).toInt();
    }
  }

  if (contentLength <= 0) {
    Serial.printf("[OTA] Invalid Content-Length: %ld\n", (long)contentLength);
    ota_http_client.stop();
    return false;
  }

  return true;
}

void finishOtaFailure(const char *target, const char *message, bool abortUpdate) {
  Serial.printf("[OTA] %s failure: %s\n", target, message);

  if (abortUpdate) {
    Update.abort();
  }

  ota_http_client.stop();
  publishOtaStatus(target, "error", message, 0);
  otaPending = false;
}

void publishOtaStatus(const char *target, const char *state, const char *message, uint8_t progress) {
  StaticJsonDocument<384> doc;
  doc["state"] = state;
  doc["message"] = message;
  doc["progress"] = progress;
  doc["target"] = target;
  doc["tenantId"] = TENANT_ID;
  doc["truckId"] = TRUCK_ID;
  doc["containerId"] = CONTAINER_ID;
  if (otaFilename[0] != '\0') {
    doc["filename"] = otaFilename;
  }

  char payload[384] = {};
  const size_t len = serializeJson(doc, payload, sizeof(payload));
  const char *topic = strcmp(target, "container") == 0 ? OTA_CONTAINER_STATUS_TOPIC : OTA_STATUS_TOPIC;
  mqtt_client.publish(topic, payload, len);
  Serial.printf("[OTA] %s -> %s (%u%%)\n", target, state, progress);
}

void performGatewayOta() {
  if (otaUrl[0] == '\0') {
    otaPending = false;
    return;
  }

  Serial.printf("[OTA] Starting gateway update from %s\n", otaUrl);
  publishOtaStatus("gateway", "downloading", "Preparing GSM firmware download", 0);

  ParsedHttpUrl parts{};
  int32_t contentLength = -1;
  if (!openOtaHttpStream(otaUrl, parts, contentLength)) {
    finishOtaFailure("gateway", "Could not open OTA download over GSM");
    return;
  }

  if (!Update.begin((size_t)contentLength, U_FLASH)) {
    finishOtaFailure("gateway", "Update.begin failed", false);
    return;
  }

  publishOtaStatus("gateway", "downloading", "Downloading firmware over GSM", 0);

  uint8_t buffer[512] = {};
  uint32_t totalWritten = 0;
  unsigned long lastDataMs = millis();

  while (ota_http_client.connected() || ota_http_client.available()) {
    const int availableBytes = ota_http_client.available();
    if (availableBytes <= 0) {
      if (millis() - lastDataMs > 15000UL) {
        finishOtaFailure("gateway", "Timed out while reading firmware stream", true);
        return;
      }
      delay(10);
      continue;
    }

    const int toRead = min((int)sizeof(buffer), availableBytes);
    const int readBytes = ota_http_client.read(buffer, toRead);
    if (readBytes <= 0) {
      delay(10);
      continue;
    }

    lastDataMs = millis();

    const size_t written = Update.write(buffer, (size_t)readBytes);
    if (written != (size_t)readBytes) {
      finishOtaFailure("gateway", "Flash write failed during OTA", true);
      return;
    }

    totalWritten += (uint32_t)written;

    const unsigned long currentMs = millis();
    mqtt_client.loop();
    maintainConnectivity(currentMs);
  }

  ota_http_client.stop();

  if (totalWritten != (uint32_t)contentLength) {
    finishOtaFailure("gateway", "Firmware download size mismatch", true);
    return;
  }

  if (!Update.end()) {
    finishOtaFailure("gateway", "Update.end failed", true);
    return;
  }

  publishOtaStatus("gateway", "success", "Update complete, rebooting", 100);
  delay(750);
  ESP.restart();
}

void performContainerOta() {
  if (otaUrl[0] == '\0') {
    otaPending = false;
    return;
  }

  Serial.printf("[OTA] Downloading container firmware from %s\n", otaUrl);
  publishOtaStatus("container", "downloading", "Preparing GSM container download", 0);

  ParsedHttpUrl parts{};
  int32_t totalSize = -1;
  if (!openOtaHttpStream(otaUrl, parts, totalSize)) {
    finishOtaFailure("container", "Could not download container firmware over GSM");
    return;
  }

  OtaBeginPacket beginPacket{};
  beginPacket.magic = OTA_PKT_BEGIN;
  beginPacket.totalSize = (uint32_t)totalSize;
  strncpy(beginPacket.filename, otaFilename, sizeof(beginPacket.filename) - 1);
  esp_now_send(SENSOR_MAC_BYTES, reinterpret_cast<const uint8_t *>(&beginPacket), sizeof(beginPacket));
  delay(50);

  uint8_t chunkBuffer[OTA_CHUNK_SIZE] = {};
  uint32_t offset = 0;
  uint32_t bytesLeft = (uint32_t)totalSize;
  unsigned long lastDataMs = millis();

  while (bytesLeft > 0 && (ota_http_client.connected() || ota_http_client.available())) {
    const int availableBytes = ota_http_client.available();
    if (availableBytes <= 0) {
      if (millis() - lastDataMs > 15000UL) {
        finishOtaFailure("container", "Timed out while downloading container firmware");
        return;
      }
      delay(10);
      continue;
    }

    const size_t toRead = min((size_t)OTA_CHUNK_SIZE, min((size_t)availableBytes, (size_t)bytesLeft));
    const int got = ota_http_client.read(chunkBuffer, toRead);
    if (got <= 0) {
      delay(10);
      continue;
    }

    lastDataMs = millis();

    OtaChunkPacket chunk{};
    chunk.magic = OTA_PKT_CHUNK;
    chunk.totalSize = (uint32_t)totalSize;
    chunk.offset = offset;
    chunk.chunkLen = (uint16_t)got;
    memcpy(chunk.data, chunkBuffer, (size_t)got);

    esp_now_send(SENSOR_MAC_BYTES, reinterpret_cast<const uint8_t *>(&chunk), sizeof(chunk));

    offset += (uint32_t)got;
    bytesLeft -= (uint32_t)got;

    const unsigned long currentMs = millis();
    mqtt_client.loop();
    maintainConnectivity(currentMs);

    delay(20);
  }

  ota_http_client.stop();

  if (offset != (uint32_t)totalSize) {
    finishOtaFailure("container", "Container firmware size mismatch");
    return;
  }

  OtaEndPacket endPacket{};
  endPacket.magic = OTA_PKT_END;
  endPacket.totalSize = (uint32_t)totalSize;
  esp_now_send(SENSOR_MAC_BYTES, reinterpret_cast<const uint8_t *>(&endPacket), sizeof(endPacket));

  publishOtaStatus("container", "success", "Firmware sent, container flashing", 100);
  otaPending = false;
}

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  if (topic == nullptr || payload == nullptr || length == 0) {
    return;
  }

  if (strcmp(topic, OTA_COMMAND_TOPIC) != 0 && strcmp(topic, OTA_CONTAINER_CMD_TOPIC) != 0) {
    return;
  }

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
    Serial.println("[OTA] Invalid JSON command");
    return;
  }

  const char *cmd = doc["cmd"] | "";
  if (strcmp(cmd, "ota_update") != 0) {
    return;
  }

  const char *target = doc["target"] | "gateway";
  const char *url = doc["url"] | "";
  const char *filename = doc["filename"] | "firmware";
  if (url[0] == '\0') {
    Serial.println("[OTA] Missing url in command");
    return;
  }

  memset(otaUrl, 0, sizeof(otaUrl));
  memset(otaFilename, 0, sizeof(otaFilename));
  strncpy(otaUrl, url, sizeof(otaUrl) - 1);
  strncpy(otaFilename, filename, sizeof(otaFilename) - 1);
  otaExpectedSize = doc["size"] | 0;
  otaIsForContainer = strcmp(target, "container") == 0;
  otaPending = true;

  publishOtaStatus(target, "pending", "Command received, starting update", 0);
}

void processPendingOta() {
  if (!otaPending) {
    return;
  }

  if (otaIsForContainer) {
    performContainerOta();
  } else {
    performGatewayOta();
  }
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
  const bool hasParsedNmea = (gps.passedChecksum() > 0) || (gps.failedChecksum() > 0);
  const bool warmupElapsed = (nowMs - bootMs) >= GPS_WARMUP_MS;

  if (hasParsedNmea || (hasRecentGpsBytes && !warmupElapsed)) {
    gpsLastBaudScanMs = nowMs;
    return;
  }

  gpsBaudCandidateIndex =
      (gpsBaudCandidateIndex + 1) % (sizeof(GPS_BAUD_CANDIDATES) / sizeof(GPS_BAUD_CANDIDATES[0]));
  if (gpsBaudCandidateIndex == 0) {
    gpsPinCandidateIndex =
        (gpsPinCandidateIndex + 1) % (sizeof(GPS_UART_PIN_CANDIDATES) / sizeof(GPS_UART_PIN_CANDIDATES[0]));
  }

  const uint32_t nextBaud = GPS_BAUD_CANDIDATES[gpsBaudCandidateIndex];
  const int nextRxPin = GPS_UART_PIN_CANDIDATES[gpsPinCandidateIndex][0];
  const int nextTxPin = GPS_UART_PIN_CANDIDATES[gpsPinCandidateIndex][1];
  beginGpsUart(nextBaud, nextRxPin, nextTxPin);
}

int64_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<int>(doe) - 719468;
}

uint32_t resolveTimestamp(const CargoPacket &pkt, bool &usedGpsTime, bool *usedGsmTime) {
  usedGpsTime = false;
  if (usedGsmTime) {
    *usedGsmTime = false;
  }

  if (gps.date.isValid() && gps.time.isValid()) {
    const int year = gps.date.year();
    const unsigned month = gps.date.month();
    const unsigned day = gps.date.day();
    const int64_t days = daysFromCivil(year, month, day);
    const int64_t ts = days * 86400LL +
                       (int64_t)gps.time.hour() * 3600LL +
                       (int64_t)gps.time.minute() * 60LL +
                       (int64_t)gps.time.second();
    if (ts >= (int64_t)MIN_VALID_UNIX_TS && ts <= 0xFFFFFFFFLL) {
      usedGpsTime = true;
      return (uint32_t)ts;
    }
  }

  int year = 0;
  int month = 0;
  int day = 0;
  int hour = 0;
  int minute = 0;
  int second = 0;
  float tz = 0.0f;
  if (modem.getNetworkTime(&year, &month, &day, &hour, &minute, &second, &tz)) {
    if (year >= 2024) {
      const int64_t days = daysFromCivil(year, (unsigned)month, (unsigned)day);
      const int64_t ts = days * 86400LL +
                         (int64_t)hour * 3600LL +
                         (int64_t)minute * 60LL +
                         (int64_t)second;
      const int64_t utcTs = ts - (int64_t)(tz * 3600.0f);
      if (utcTs >= (int64_t)MIN_VALID_UNIX_TS && utcTs <= 0xFFFFFFFFLL) {
        if (usedGsmTime) {
          *usedGsmTime = true;
        }
        return (uint32_t)utcTs;
      }
    }
  }

  return pkt.ts;
}

void readGpsSnapshot(float &lat, float &lon, float &speedKph, bool &gpsFix) {
  gpsPump();
  gpsFix = gps.location.isValid();

  if (gpsFix) {
    lat = (float)gps.location.lat();
    lon = (float)gps.location.lng();
    speedKph = gps.speed.isValid() ? (float)gps.speed.kmph() : 0.0f;
  } else {
    lat = 0.0f;
    lon = 0.0f;
    speedKph = 0.0f;
  }
}

// -----------------------------------------------------------------------------
// ESP-NOW receive
// -----------------------------------------------------------------------------

void handleEspNowData(const uint8_t *senderMac, const uint8_t *data, int len) {
  if (!senderMac || !data) return;

  if (!macEquals(senderMac, SENSOR_MAC_BYTES)) {
    rejectedMacCount++;
    return;
  }
  if (len != (int)sizeof(CargoPacket)) {
    rejectedLengthCount++;
    return;
  }

  portENTER_CRITICAL_ISR(&packetMux);
  memcpy(&rxPacket, data, sizeof(CargoPacket));
  packetReady = true;
  portEXIT_CRITICAL_ISR(&packetMux);
}

#if (defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)) || \
    (defined(ESP_IDF_VERSION_MAJOR) && (ESP_IDF_VERSION_MAJOR >= 5))
void onEspNowSent(const wifi_tx_info_t *txInfo, esp_now_send_status_t status) {
  (void)txInfo;
  Serial.printf("[ESP-NOW] Send => %s\n",
                status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}

void onEspNowReceive(const esp_now_recv_info_t *recvInfo, const uint8_t *data, int len) {
  if (!recvInfo) return;
  handleEspNowData(recvInfo->src_addr, data, len);
}
#else
void onEspNowSent(const uint8_t *senderMac, esp_now_send_status_t status) {
  Serial.printf("[ESP-NOW] Send to %s => %s\n",
                senderMac ? macToString(senderMac).c_str() : "unknown",
                status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}

void onEspNowReceive(const uint8_t *senderMac, const uint8_t *data, int len) {
  handleEspNowData(senderMac, data, len);
}
#endif

bool consumePacket(CargoPacket &pkt) {
  bool hasPacket = false;
  portENTER_CRITICAL(&packetMux);
  if (packetReady) {
    pkt = rxPacket;
    packetReady = false;
    hasPacket = true;
  }
  portEXIT_CRITICAL(&packetMux);
  return hasPacket;
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

  esp_now_register_send_cb(onEspNowSent);
  esp_now_register_recv_cb(onEspNowReceive);

  if (!esp_now_is_peer_exist(SENSOR_MAC_BYTES)) {
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, SENSOR_MAC_BYTES, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
      Serial.println("[ESP-NOW] Failed to add container peer");
    }
  }

  Serial.println("[ESP-NOW] RX/TX callbacks ready");
}

void broadcastTimeSync(unsigned long nowMs) {
  if (nowMs - lastTimeSyncMs < TIME_SYNC_INTERVAL_MS) {
    return;
  }

  bool usedGpsTime = false;
  bool usedGsmTime = false;
  CargoPacket dummy{};
  uint32_t ts = resolveTimestamp(dummy, usedGpsTime, &usedGsmTime);
  if (ts < MIN_VALID_UNIX_TS) {
    return;
  }

  lastTimeSyncMs = nowMs;

  TimeSyncPacket sync{};
  sync.magic = TIME_SYNC_MAGIC;
  sync.unixTs = ts;

  esp_err_t err = esp_now_send(
    SENSOR_MAC_BYTES,
    reinterpret_cast<const uint8_t *>(&sync),
    sizeof(sync)
  );

  Serial.printf("[TIMESYNC] ts=%lu gps=%u gsm=%u err=%d\n",
                (unsigned long)ts,
                usedGpsTime ? 1 : 0,
                usedGsmTime ? 1 : 0,
                (int)err);
}

// -----------------------------------------------------------------------------
// Connectivity and reconnect
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

    // Re-enable NITZ time sync on fresh PDP attachment so getNetworkTime() can resolve UTC.
    modem.sendAT("+CLTS=1");
    if (modem.waitResponse(2000) != 1) {
      Serial.println("[GSM] WARN: AT+CLTS=1 failed");
    }
    modem.sendAT("&W");
    if (modem.waitResponse(2000) != 1) {
      Serial.println("[GSM] WARN: AT&W failed after CLTS");
    } else {
      Serial.println("[GSM] Network time sync (CLTS) enabled");
    }
  }

  return true;
}

bool reconnectMqtt() {
  // Required cleanup before reconnect
  secure_client.stop();
  base_client.stop();
  raw_tcp_transport.stop();
  secure_client.clearWriteError();
  base_client.clearWriteError();
  raw_tcp_transport.clearWriteError();
  if (!otaPending) {
    ota_http_client.stop();
    ota_http_client.clearWriteError();
  }
  Serial.println("[MQTT] Socket cleanup done");

  if (!ensureNetworkAndGprs()) return false;

  base_client.configure(GHOSTPROXY_ENABLED, GHOSTPROXY_HOST, GHOSTPROXY_PORT);

  if (GHOSTPROXY_ENABLED) {
    Serial.printf("[TLS] GhostProxy ON transport=%s:%u sni-host=%s:%u\n",
                  GHOSTPROXY_HOST, GHOSTPROXY_PORT,
                  MQTT_BROKER_HOST, MQTT_BROKER_PORT);
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
  String clientId = String("gateway-") + TRUCK_ID + "-" + String((uint32_t)(efuseMac & 0xFFFFFFFF), HEX);
  clientId.toLowerCase();

  Serial.printf("[MQTT] Connecting clientId=%s user=%s\n", clientId.c_str(), MQTT_USERNAME);
  if (!mqtt_client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.printf("[MQTT] Connect failed rc=%d\n", mqtt_client.state());
    return false;
  }

  mqtt_client.subscribe(OTA_COMMAND_TOPIC, 1);
  mqtt_client.subscribe(OTA_CONTAINER_CMD_TOPIC, 1);
  Serial.println("[MQTT] Subscribed to OTA command topics");

  Serial.println("[MQTT] Connected over TLS 1.2");
  return true;
}

void maintainConnectivity(unsigned long nowMs) {
  if (mqtt_client.connected()) return;
  if (nowMs - lastReconnectAttemptMs < RECONNECT_INTERVAL_MS) return;

  lastReconnectAttemptMs = nowMs;
  Serial.println("[NET] Reconnect attempt...");
  if (!reconnectMqtt()) {
    Serial.println("[NET] Reconnect failed");
  }
}

// -----------------------------------------------------------------------------
// Publish
// -----------------------------------------------------------------------------

bool publishTelemetry(const CargoPacket &pkt) {
  float lat = 0.0f;
  float lon = 0.0f;
  float speedKph = 0.0f;
  bool gpsFix = false;
  bool usedGpsTime = false;

  readGpsSnapshot(lat, lon, speedKph, gpsFix);
  uint32_t ts = resolveTimestamp(pkt, usedGpsTime);

  StaticJsonDocument<640> doc;
  doc["tenantId"] = TENANT_ID;
  doc["fleetId"] = FLEET_ID;
  doc["truckId"] = TRUCK_ID;
  doc["containerId"] = CONTAINER_ID;
  doc["gatewayMac"] = GATEWAY_MAC_STR;
  doc["sensorNodeMac"] = SENSOR_MAC_STR;
  doc["seq"] = pkt.seq;
  doc["ts"] = ts;

  JsonObject gpsObj = doc.createNestedObject("gps");
  gpsObj["lat"] = lat;
  gpsObj["lon"] = lon;
  gpsObj["speedKph"] = speedKph;

  JsonObject envObj = doc.createNestedObject("env");
  envObj["temperatureC"] = pkt.tempC;
  envObj["humidityPct"] = pkt.humidity;
  envObj["pressureHpa"] = pkt.pressure;

  JsonObject motionObj = doc.createNestedObject("motion");
  motionObj["tiltDeg"] = pkt.tilt;
  motionObj["shock"] = pkt.shock;

  JsonObject gasObj = doc.createNestedObject("gas");
  gasObj["mq2Raw"] = pkt.gasRaw;
  gasObj["alert"] = pkt.gasRaw > 1500;

  JsonObject statusObj = doc.createNestedObject("status");
  statusObj["sdOk"] = pkt.sdOk;
  statusObj["gpsFix"] = gpsFix;
  statusObj["uplink"] = "gsm";

  char payload[640];
  size_t payloadLen = serializeJson(doc, payload, sizeof(payload));

  const size_t topicLen = strlen(MQTT_TOPIC);
  const size_t estPacketLen = topicLen + payloadLen + 10;
  if (estPacketLen > MQTT_BUFFER_BYTES) {
    Serial.printf("[PUB] WARN packet too large: topic=%u payload=%u est=%u buffer=%u\n",
                  (unsigned int)topicLen,
                  (unsigned int)payloadLen,
                  (unsigned int)estPacketLen,
                  (unsigned int)MQTT_BUFFER_BYTES);
  }

  bool ok = mqtt_client.publish(MQTT_TOPIC, payload, payloadLen);
  Serial.printf("[PUB] ok=%u seq=%lu ts=%lu gpsFix=%u gpsTs=%u lat=%.6f lon=%.6f speed=%.2f\n",
                ok ? 1 : 0,
                (unsigned long)pkt.seq,
                (unsigned long)ts,
                gpsFix ? 1 : 0,
                usedGpsTime ? 1 : 0,
                lat,
                lon,
                speedKph);
  if (!ok) {
    Serial.printf("[PUB] Failed, mqtt_state=%d topicLen=%u payloadLen=%u estPacket=%u buffer=%u\n",
                  mqtt_client.state(),
                  (unsigned int)topicLen,
                  (unsigned int)payloadLen,
                  (unsigned int)estPacketLen,
                  (unsigned int)MQTT_BUFFER_BYTES);
  }
  return ok;
}

void servicePublish(unsigned long nowMs) {
  if (!publishPending) return;
  if (!mqtt_client.connected()) return;
  if (nowMs - lastPublishMs < MIN_PUBLISH_GAP_MS) return;

  lastPublishMs = nowMs;

  if (publishTelemetry(publishPacketData)) {
    publishPending = false;
  }
}

// -----------------------------------------------------------------------------
// Setup / loop
// -----------------------------------------------------------------------------

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(DEBUG_BAUD);
  delay(400);
  bootMs = millis();

  Serial.println("\n=== Smart Cargo Gateway Boot ===");
  Serial.println("Design: ESP32 SSLClient/BearSSL TLS + SIM800L raw TCP transport");
  Serial.printf("[CFG] APN=%s\n", APN);
  Serial.printf("[CFG] Topic=%s\n", MQTT_TOPIC);
  Serial.printf("[CFG] Broker host=%s port=%u\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  // Must be configured before SerialAT.begin()
  SerialAT.setRxBufferSize(SERIAL_AT_RX_BUFFER_BYTES);
  SerialAT.begin(MODEM_BAUD, SERIAL_8N1, PIN_GSM_RX, PIN_GSM_TX);
  for (size_t i = 0; i < (sizeof(GPS_BAUD_CANDIDATES) / sizeof(GPS_BAUD_CANDIDATES[0])); ++i) {
    if (GPS_BAUD_CANDIDATES[i] == GPS_BAUD) {
      gpsBaudCandidateIndex = i;
      break;
    }
  }
  for (size_t i = 0; i < (sizeof(GPS_UART_PIN_CANDIDATES) / sizeof(GPS_UART_PIN_CANDIDATES[0])); ++i) {
    if (GPS_UART_PIN_CANDIDATES[i][0] == PIN_GPS_RX && GPS_UART_PIN_CANDIDATES[i][1] == PIN_GPS_TX) {
      gpsPinCandidateIndex = i;
      break;
    }
  }
  beginGpsUart(GPS_BAUD, PIN_GPS_RX, PIN_GPS_TX);

  // Optional modem DNS override for better reliability
  SerialAT.println("AT+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\"");

  initEspNow();
  mqtt_client.setCallback(onMqttMessage);

  if (!ensureModemReady()) {
    Serial.println("[GSM] Modem not ready at boot; loop will retry.");
  }
}

void loop() {
  digitalWrite(LED, HIGH);
  const unsigned long nowMs = millis();

  gpsPump();
  gpsMaybeScanBaud(nowMs);
  mqtt_client.loop();
  processPendingOta();

  CargoPacket pkt{};
  if (consumePacket(pkt)) {
    publishPacketData = pkt;
    publishPending = true;
    Serial.printf("[ESP-NOW] RX seq=%lu temp=%.2f hum=%.2f pressure=%.2f tilt=%.2f gas=%u shock=%u sdOk=%u\n",
                  (unsigned long)pkt.seq,
                  pkt.tempC,
                  pkt.humidity,
                  pkt.pressure,
                  pkt.tilt,
                  (unsigned int)pkt.gasRaw,
                  pkt.shock ? 1 : 0,
                  pkt.sdOk ? 1 : 0);
  }

  maintainConnectivity(nowMs);
  servicePublish(nowMs);
  broadcastTimeSync(nowMs);

  if (nowMs - lastStatusLogMs >= STATUS_LOG_INTERVAL_MS) {
    lastStatusLogMs = nowMs;
    Serial.printf("[STATUS] net=%u gprs=%u mqtt=%u gpsFix=%u sats=%lu gpsAgeMs=%lu gpsChars=%lu nmeaOk=%lu nmeaBad=%lu gpsBaud=%lu gpsRx=%d gpsTx=%d pending=%u dropMac=%lu dropLen=%lu\n",
                  modem.isNetworkConnected() ? 1 : 0,
                  modem.isGprsConnected() ? 1 : 0,
                  mqtt_client.connected() ? 1 : 0,
                  gps.location.isValid() ? 1 : 0,
                  (unsigned long)(gps.satellites.isValid() ? gps.satellites.value() : 0),
                  (unsigned long)(gps.location.isValid() ? gps.location.age() : 0),
                  (unsigned long)gps.charsProcessed(),
                  (unsigned long)gps.passedChecksum(),
                  (unsigned long)gps.failedChecksum(),
                  (unsigned long)gpsActiveBaud,
            gpsActiveRxPin,
            gpsActiveTxPin,
                  publishPending ? 1 : 0,
                  (unsigned long)rejectedMacCount,
                  (unsigned long)rejectedLengthCount);

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
