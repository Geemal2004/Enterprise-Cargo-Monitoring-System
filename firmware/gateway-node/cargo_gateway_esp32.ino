// 1. DEFINES MUST COME BEFORE TinyGSM INCLUDE
#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024
#define TINY_GSM_DEBUG Serial
#define MQTT_MAX_PACKET_SIZE 2048

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <TinyGsmClient.h>
#include <TinyGPSPlus.h>
#include <PubSubClient.h>
#include <SSLClient.h>
#include <HTTPUpdate.h>
#include <Update.h>
#include <ArduinoJson.h>
#include <Preferences.h>
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

static const char WIFI_SCAN_REQUEST_TOPIC[] = "tenant/demo/truck/TRUCK01/gateway/wifi/scan/request";
static const char WIFI_SCAN_RESULT_TOPIC[] = "tenant/demo/truck/TRUCK01/gateway/wifi/scan/result";
static const char WIFI_CONNECT_TOPIC[] = "tenant/demo/truck/TRUCK01/gateway/wifi/connect";
static const char WIFI_STATUS_TOPIC[] = "tenant/demo/truck/TRUCK01/gateway/wifi/status";
static const char WIFI_SCAN_REQUEST_TOPIC_FILTER[] = "tenant/+/truck/+/gateway/wifi/scan/request";
static const char WIFI_CONNECT_TOPIC_FILTER[] = "tenant/+/truck/+/gateway/wifi/connect";
static const char OTA_COMMAND_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/gateway/command";
static const char OTA_STATUS_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/gateway/status";
static const char OTA_CONTAINER_CMD_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/container/command";
static const char OTA_CONTAINER_STATUS_TOPIC[] = "tenant/demo/truck/TRUCK01/ota/container/status";
static const char OTA_COMMAND_TOPIC_FILTER[] = "tenant/+/truck/+/ota/gateway/command";
static const char OTA_CONTAINER_CMD_TOPIC_FILTER[] = "tenant/+/truck/+/ota/container/command";
static const size_t OTA_CHUNK_SIZE = 200;
static const uint32_t OTA_PKT_BEGIN = 0x4F544142UL;
static const uint32_t OTA_PKT_CHUNK = 0x4F54414EUL;
static const uint32_t OTA_PKT_END = 0x4F544145UL;
static const uint32_t ESP_NOW_CHANNEL_MAGIC = 0x4348414EUL; // "CHAN"

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
static const char FIRMWARE_BUILD[] = "FW_BUILD:gateway-ota-wifi-cancel-led-off-2026-04-26";
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
static const uint16_t MQTT_BUFFER_BYTES = 2048;
static const uint32_t TIME_SYNC_INTERVAL_MS = 30000;
static const uint32_t MIN_VALID_UNIX_TS = 1704067200UL;
static const uint32_t WIFI_CONNECT_TIMEOUT_MS = 45000;
static const uint32_t WIFI_SCAN_TIMEOUT_MS = 30000;
static const uint16_t WIFI_SCAN_MAX_MS_PER_CHANNEL = 120;
static const uint32_t OTA_READ_TIMEOUT_MS = 15000;
static const uint32_t OTA_SUCCESS_MQTT_FLUSH_MS = 4000;
static const uint8_t ESP_NOW_BOOT_CHANNEL = 1;

// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------

HardwareSerial SerialAT(1);   // GSM UART1
HardwareSerial SerialGPS(2);  // GPS UART2

TinyGsm modem(SerialAT);
TinyGsmClient raw_tcp_transport(modem, 0);   // SIM800L raw TCP for MQTT/TLS
SSLClient secure_client(raw_tcp_transport, TAs, (size_t)TAs_NUM, 34);
PubSubClient mqtt_client(secure_client);

TinyGPSPlus gps;
Preferences wifiPrefs;

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

enum WifiState {
  WIFI_IDLE,
  WIFI_SCANNING,
  WIFI_CONNECTING,
  WIFI_CONNECTED,
  WIFI_FAILED,
};

WifiState wifiState = WIFI_IDLE;
bool wifiStatusDirty = false;
bool wifiPrefsReady = false;
bool wifiScanActive = false;
unsigned long wifiScanStartedMs = 0;
unsigned long wifiConnectStartedMs = 0;
String pendingWifiSsid;
String pendingWifiPass;
String activeWifiSsid;
String scannedSsidCache[12];
uint8_t scannedChannelCache[12] = {};
String scannedBssidCache[12];
size_t scannedNetworkCacheCount = 0;
uint8_t expectedContainerChannel = ESP_NOW_BOOT_CHANNEL;
uint8_t pendingWifiChannel = 0;
uint8_t pendingWifiBssid[6] = {};
bool pendingWifiHasBssid = false;
volatile uint8_t lastWifiDisconnectReason = 0;
volatile bool wifiGotIpEventPending = false;

bool otaPending = false;
bool otaIsForContainer = false;
volatile bool otaCancelRequested = false;
char otaUrl[256] = {};
uint32_t otaExpectedSize = 0;
char otaFilename[64] = {};
String wifiTopicBase = "tenant/demo/truck/TRUCK01/gateway/wifi";
String otaGatewayTopicBase = "tenant/demo/truck/TRUCK01/ota/gateway";
String otaContainerTopicBase = "tenant/demo/truck/TRUCK01/ota/container";
uint8_t lastGatewayOtaProgress = 255;
unsigned long lastGatewayOtaProgressMs = 0;
WiFiClient *activeGatewayOtaClient = nullptr;

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

const char *wifiStateName(WifiState state) {
  switch (state) {
    case WIFI_IDLE: return "idle";
    case WIFI_SCANNING: return "scanning";
    case WIFI_CONNECTING: return "connecting";
    case WIFI_CONNECTED: return "connected";
    case WIFI_FAILED: return "failed";
    default: return "unknown";
  }
}

bool topicMatchesSelectedTruck(const char *topic, const char *suffix) {
  if (!topic || !suffix) {
    return false;
  }

  const String topicText(topic);
  const String truckNeedle = String("/truck/") + TRUCK_ID + "/";
  return topicText.startsWith("tenant/") &&
         topicText.indexOf(truckNeedle) >= 0 &&
         topicText.endsWith(suffix);
}

bool parseBssidString(const char *raw, uint8_t out[6]) {
  if (!raw || strlen(raw) != 17) {
    return false;
  }

  unsigned int bytes[6] = {};
  if (sscanf(raw, "%02x:%02x:%02x:%02x:%02x:%02x",
             &bytes[0], &bytes[1], &bytes[2], &bytes[3], &bytes[4], &bytes[5]) != 6) {
    return false;
  }

  for (int i = 0; i < 6; ++i) {
    if (bytes[i] > 0xFF) {
      return false;
    }
    out[i] = (uint8_t)bytes[i];
  }

  return true;
}

const char *wifiReasonName(uint8_t reason) {
  switch (reason) {
    case 0: return "none";
    case 2: return "auth expired";
    case 4: return "assoc expired";
    case 15: return "4-way handshake timeout";
    case 17: return "IE invalid";
    case 18: return "group cipher invalid";
    case 19: return "pairwise cipher invalid";
    case 20: return "AKMP invalid";
    case 21: return "unsupported RSN IE version";
    case 23: return "802.1x auth failed";
    case 24: return "cipher suite rejected";
    case 201: return "no AP found";
    case 202: return "auth fail";
    case 203: return "assoc fail";
    case 204: return "handshake timeout";
    case 205: return "connection fail";
    default: return "unknown";
  }
}

String topicBaseFromSuffix(const char *topic, const char *suffix) {
  const String topicText(topic ? topic : "");
  const String suffixText(suffix ? suffix : "");
  if (!topicText.endsWith(suffixText)) {
    return topicText;
  }

  return topicText.substring(0, topicText.length() - suffixText.length());
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

struct EspNowChannelPacket {
  uint32_t magic;
  uint8_t channel;
};

struct ParsedHttpUrl {
  String host;
  uint16_t port;
  String path;
  bool https;
};

bool ensureNetworkAndGprs();
bool reconnectMqtt();
bool parseHttpUrl(const char *url, ParsedHttpUrl &parts);
bool openWifiHttpStream(WiFiClient &client, const char *url, ParsedHttpUrl &parts, int32_t &contentLength);
uint32_t resolveTimestamp(const CargoPacket &pkt, bool &usedGpsTime, bool *usedGsmTime = nullptr);
void maintainConnectivity(unsigned long nowMs);
void processWifiTasks(unsigned long nowMs);
void publishWifiStatus(const char *message = nullptr);
void publishWifiScanResult(int networkCount);
bool runBoundedWifiScanFallback(const char *reason);
int findScannedChannelForSsid(const String &ssid);
bool findScannedBssidForSsid(const String &ssid, uint8_t out[6], String &bssidText);
void setEspNowPeerChannel(uint8_t channel);
bool notifyContainerWifiChannel(uint8_t channel);
bool publishOtaStatus(const char *target, const char *state, const char *message, uint8_t progress = 0);
void finishOtaFailure(const char *target, const char *message, bool abortUpdate = false);
void finishOtaCancelled(const char *target);
void flushMqttFor(uint32_t durationMs);
void publishGatewayRunningStatus();

bool parseHttpUrl(const char *url, ParsedHttpUrl &parts) {
  String raw = String(url ? url : "");
  raw.trim();

  String remainder;
  parts = ParsedHttpUrl{};
  if (raw.startsWith("https://")) {
    parts.https = true;
    parts.port = 443;
    remainder = raw.substring(8);
  } else if (raw.startsWith("http://")) {
    parts.https = false;
    parts.port = 80;
    remainder = raw.substring(7);
  } else {
    Serial.printf("[OTA] Unsupported URL (expected http:// or https://): %s\n", raw.c_str());
    return false;
  }

  const int slashIndex = remainder.indexOf('/');
  String hostPort = slashIndex >= 0 ? remainder.substring(0, slashIndex) : remainder;

  parts.path = slashIndex >= 0 ? remainder.substring(slashIndex) : "/";

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

bool openWifiHttpStream(WiFiClient &client, const char *url, ParsedHttpUrl &parts, int32_t &contentLength) {
  contentLength = -1;

  if (!parseHttpUrl(url, parts)) {
    return false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[OTA] WiFi is not connected for HTTP download");
    return false;
  }

  client.stop();
  client.setTimeout(15000);

  Serial.printf("[OTA] Opening WiFi %s stream host=%s port=%u path=%s\n",
                parts.https ? "HTTPS" : "HTTP",
                parts.host.c_str(),
                parts.port,
                parts.path.c_str());

  if (!client.connect(parts.host.c_str(), parts.port)) {
    Serial.println("[OTA] HTTP TCP/TLS connect failed over WiFi");
    return false;
  }

  client.printf(
    "GET %s HTTP/1.1\r\n"
    "Host: %s:%u\r\n"
    "Connection: close\r\n"
    "User-Agent: smart-cargo-gateway-ota\r\n"
    "\r\n",
    parts.path.c_str(),
    parts.host.c_str(),
    parts.port
  );

  String statusLine = client.readStringUntil('\n');
  statusLine.trim();
  if (statusLine.length() == 0) {
    Serial.println("[OTA] Empty HTTP status line");
    client.stop();
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
    client.stop();
    return false;
  }

  while (client.connected()) {
    String headerLine = client.readStringUntil('\n');
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
    client.stop();
    return false;
  }

  return true;
}

void finishOtaFailure(const char *target, const char *message, bool abortUpdate) {
  Serial.printf("[OTA] %s failure: %s\n", target, message);

  if (abortUpdate) {
    Update.abort();
  }

  publishOtaStatus(target, "error", message, 0);
  otaPending = false;
  otaCancelRequested = false;
}

void finishOtaCancelled(const char *target) {
  Serial.printf("[OTA] %s cancelled\n", target);
  Update.abort();
  publishOtaStatus(target, "cancelled", "Update cancelled", 0);
  otaPending = false;
  otaCancelRequested = false;
}

const char *firmwareBuildLabel() {
  static const char prefix[] = "FW_BUILD:";
  if (strncmp(FIRMWARE_BUILD, prefix, strlen(prefix)) == 0) {
    return FIRMWARE_BUILD + strlen(prefix);
  }

  return FIRMWARE_BUILD;
}

bool publishOtaStatus(const char *target, const char *state, const char *message, uint8_t progress) {
  StaticJsonDocument<512> doc;
  doc["state"] = state;
  doc["message"] = message;
  doc["progress"] = progress;
  doc["target"] = target;
  doc["tenantId"] = TENANT_ID;
  doc["truckId"] = TRUCK_ID;
  doc["containerId"] = CONTAINER_ID;
  doc["firmwareBuild"] = firmwareBuildLabel();
  if (otaFilename[0] != '\0') {
    doc["filename"] = otaFilename;
  }

  char payload[512] = {};
  const size_t len = serializeJson(doc, payload, sizeof(payload));
  const String topic = strcmp(target, "container") == 0
                         ? otaContainerTopicBase + "/status"
                         : otaGatewayTopicBase + "/status";
  const bool ok = mqtt_client.connected() && mqtt_client.publish(topic.c_str(), payload, len);
  Serial.printf("[OTA] %s -> %s (%u%%) mqtt=%u\n", target, state, progress, ok ? 1 : 0);
  return ok;
}

void flushMqttFor(uint32_t durationMs) {
  const unsigned long startedMs = millis();
  while (millis() - startedMs < durationMs) {
    mqtt_client.loop();
    delay(50);
  }
}

void publishGatewayRunningStatus() {
  if (!mqtt_client.connected()) {
    return;
  }

  if (otaPending) {
    return;
  }

  publishOtaStatus("gateway", "success", "Gateway firmware is running", 100);
}

void publishWifiStatus(const char *message) {
  StaticJsonDocument<384> doc;
  doc["state"] = wifiStateName(wifiState);
  if (activeWifiSsid.length() > 0) {
    doc["ssid"] = activeWifiSsid;
  } else if (pendingWifiSsid.length() > 0) {
    doc["ssid"] = pendingWifiSsid;
  }
  if (WiFi.status() == WL_CONNECTED) {
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["channel"] = WiFi.channel();
  } else {
    doc["wifiStatusCode"] = (int)WiFi.status();
    if (lastWifiDisconnectReason != 0) {
      doc["disconnectReason"] = lastWifiDisconnectReason;
      doc["disconnectReasonText"] = wifiReasonName(lastWifiDisconnectReason);
    }
  }
  if (message && message[0] != '\0') {
    doc["message"] = message;
  }

  char payload[384] = {};
  const size_t len = serializeJson(doc, payload, sizeof(payload));
  if (!mqtt_client.connected()) {
    wifiStatusDirty = true;
    return;
  }

  const String topic = wifiTopicBase + "/status";
  mqtt_client.publish(topic.c_str(), payload, len);
  wifiStatusDirty = false;
  Serial.printf("[WIFI] Status -> %s\n", payload);
}

void setEspNowPeerChannel(uint8_t channel) {
  if (channel == 0 || channel > 13) {
    return;
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, SENSOR_MAC_BYTES, 6);
  peerInfo.channel = channel;
  peerInfo.encrypt = false;

  // WiFi.begin() moves the radio to the router channel. ESP-NOW traffic only
  // works when both boards share that channel, so telemetry may pause during OTA
  // unless the container is also using this router channel.
  esp_err_t err = esp_now_is_peer_exist(SENSOR_MAC_BYTES)
                    ? esp_now_mod_peer(&peerInfo)
                    : esp_now_add_peer(&peerInfo);
  Serial.printf("[ESP-NOW] Peer channel set to %d err=%d\n", channel, (int)err);
}

void updateEspNowPeerChannel() {
  const int channel = WiFi.channel();
  if (channel <= 0) {
    return;
  }

  expectedContainerChannel = (uint8_t)channel;
  setEspNowPeerChannel((uint8_t)channel);
}

int findScannedChannelForSsid(const String &ssid) {
  for (size_t i = 0; i < scannedNetworkCacheCount; ++i) {
    if (scannedSsidCache[i] == ssid && scannedChannelCache[i] > 0) {
      return scannedChannelCache[i];
    }
  }

  return 0;
}

bool findScannedBssidForSsid(const String &ssid, uint8_t out[6], String &bssidText) {
  for (size_t i = 0; i < scannedNetworkCacheCount; ++i) {
    if (scannedSsidCache[i] == ssid && scannedBssidCache[i].length() == 17) {
      bssidText = scannedBssidCache[i];
      return parseBssidString(bssidText.c_str(), out);
    }
  }

  bssidText = "";
  return false;
}

bool notifyContainerWifiChannel(uint8_t channel) {
  if (channel == 0 || channel > 13) {
    return false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    esp_wifi_scan_stop();
    WiFi.scanDelete();
    esp_wifi_set_channel(expectedContainerChannel, WIFI_SECOND_CHAN_NONE);
    setEspNowPeerChannel(expectedContainerChannel);
    delay(30);
  }

  EspNowChannelPacket packet{};
  packet.magic = ESP_NOW_CHANNEL_MAGIC;
  packet.channel = channel;

  esp_err_t lastErr = ESP_FAIL;
  for (uint8_t attempt = 0; attempt < 3; ++attempt) {
    lastErr = esp_now_send(SENSOR_MAC_BYTES, reinterpret_cast<const uint8_t *>(&packet), sizeof(packet));
    delay(40);
  }

  Serial.printf("[ESP-NOW] Requested container switch to channel %u err=%d\n",
                (unsigned int)channel,
                (int)lastErr);
  expectedContainerChannel = channel;
  return lastErr == ESP_OK;
}

void persistWifiCredentialsIfChanged(const String &ssid, const String &pass) {
  if (!wifiPrefsReady) {
    return;
  }

  const String storedSsid = wifiPrefs.getString("ssid", "");
  const String storedPass = wifiPrefs.getString("pass", "");
  const uint8_t storedChannel = wifiPrefs.getUChar("chan", 0);
  const uint8_t currentChannel = WiFi.status() == WL_CONNECTED ? (uint8_t)WiFi.channel() : 0;

  if (storedSsid != ssid || storedPass != pass || (currentChannel > 0 && storedChannel != currentChannel)) {
    wifiPrefs.putString("ssid", ssid);
    wifiPrefs.putString("pass", pass);
    if (currentChannel > 0) {
      wifiPrefs.putUChar("chan", currentChannel);
    }
    Serial.println("[WIFI] Credentials saved to NVS");
  }
}

void beginWifiConnect(const String &ssid, const String &pass, bool fromStoredCredentials, uint8_t preferredChannel = 0, const char *preferredBssid = nullptr) {
  if (ssid.length() == 0) {
    wifiState = WIFI_FAILED;
    wifiStatusDirty = true;
    publishWifiStatus("SSID is required");
    return;
  }

  uint8_t parsedBssid[6] = {};
  const bool hasPreferredBssid = parseBssidString(preferredBssid, parsedBssid);

  if (WiFi.status() == WL_CONNECTED && WiFi.SSID() == ssid) {
    activeWifiSsid = ssid;
    wifiState = WIFI_CONNECTED;
    lastWifiDisconnectReason = 0;
    updateEspNowPeerChannel();
    persistWifiCredentialsIfChanged(activeWifiSsid, pass);
    publishWifiStatus("Already connected");
    return;
  }

  pendingWifiSsid = ssid;
  pendingWifiPass = pass;
  lastWifiDisconnectReason = 0;
  pendingWifiChannel = preferredChannel;
  pendingWifiHasBssid = hasPreferredBssid;
  if (pendingWifiHasBssid) {
    memcpy(pendingWifiBssid, parsedBssid, sizeof(pendingWifiBssid));
  } else {
    memset(pendingWifiBssid, 0, sizeof(pendingWifiBssid));
  }
  wifiConnectStartedMs = millis();
  wifiState = WIFI_CONNECTING;
  wifiStatusDirty = true;
  if (wifiScanActive) {
    esp_wifi_scan_stop();
    WiFi.scanDelete();
    wifiScanActive = false;
  }

  Serial.printf("[WIFI] Connecting to %s...\n", pendingWifiSsid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);

  int targetChannel = pendingWifiChannel > 0 ? pendingWifiChannel : findScannedChannelForSsid(pendingWifiSsid);
  if (targetChannel <= 0 && fromStoredCredentials && wifiPrefsReady) {
    targetChannel = wifiPrefs.getUChar("chan", 0);
  }

  String cachedBssidText;
  if (!pendingWifiHasBssid && findScannedBssidForSsid(pendingWifiSsid, pendingWifiBssid, cachedBssidText)) {
    pendingWifiHasBssid = true;
  }

  if (targetChannel > 0) {
    notifyContainerWifiChannel((uint8_t)targetChannel);
  } else {
    Serial.println("[ESP-NOW] No scanned WiFi channel for selected SSID; scan before connect or set fixed channel.");
  }

  WiFi.disconnect(false, false);
  delay(250);

  if (targetChannel > 0 && pendingWifiHasBssid) {
    const char *bssidForLog =
        (preferredBssid && preferredBssid[0] != '\0') ? preferredBssid : cachedBssidText.c_str();
    Serial.printf("[WIFI] Connecting with channel=%d bssid=%s\n", targetChannel, bssidForLog);
    WiFi.begin(pendingWifiSsid.c_str(), pendingWifiPass.c_str(), targetChannel, pendingWifiBssid);
  } else if (targetChannel > 0) {
    Serial.printf("[WIFI] Connecting with channel=%d\n", targetChannel);
    WiFi.begin(pendingWifiSsid.c_str(), pendingWifiPass.c_str(), targetChannel);
  } else {
    WiFi.begin(pendingWifiSsid.c_str(), pendingWifiPass.c_str());
  }
  publishWifiStatus(fromStoredCredentials ? "Connecting with stored credentials" : "Connecting");
}

void attemptStoredWifiConnect() {
  if (!wifiPrefsReady) {
    return;
  }

  const String ssid = wifiPrefs.getString("ssid", "");
  const String pass = wifiPrefs.getString("pass", "");
  if (ssid.length() == 0) {
    Serial.println("[WIFI] No stored credentials");
    return;
  }

  beginWifiConnect(ssid, pass, true);
}

void startWifiScan() {
  if (wifiScanActive || wifiState == WIFI_SCANNING) {
    publishWifiStatus("Scan already running");
    return;
  }

  Serial.println("[WIFI] Scan requested");
  esp_wifi_scan_stop();
  WiFi.scanDelete();
  const int result = WiFi.scanNetworks(true, true, false, WIFI_SCAN_MAX_MS_PER_CHANNEL);
  wifiScanActive = true;
  wifiScanStartedMs = millis();
  wifiState = WIFI_SCANNING;
  wifiStatusDirty = true;
  publishWifiStatus("Scan started");

  if (result >= 0) {
    Serial.printf("[WIFI] Async scan completed immediately count=%d\n", result);
    publishWifiScanResult(result);
    WiFi.scanDelete();
    wifiScanActive = false;
    wifiState = WiFi.status() == WL_CONNECTED ? WIFI_CONNECTED : WIFI_IDLE;
    publishWifiStatus("Scan complete");
  } else if (result != WIFI_SCAN_RUNNING) {
    Serial.printf("[WIFI] Async scan returned immediate code=%d\n", result);
  }
}

bool runBoundedWifiScanFallback(const char *reason) {
  Serial.printf("[WIFI] Running bounded fallback scan: %s\n", reason ? reason : "unknown");

  esp_wifi_scan_stop();
  WiFi.scanDelete();
  delay(20);

  const int networkCount = WiFi.scanNetworks(false, true, false, WIFI_SCAN_MAX_MS_PER_CHANNEL);
  if (networkCount < 0) {
    Serial.printf("[WIFI] Fallback scan failed code=%d\n", networkCount);
    return false;
  }

  publishWifiScanResult(networkCount);
  WiFi.scanDelete();
  wifiState = WiFi.status() == WL_CONNECTED ? WIFI_CONNECTED : WIFI_IDLE;
  publishWifiStatus("Scan complete");
  return true;
}

void publishWifiScanResult(int networkCount) {
  StaticJsonDocument<1536> doc;
  JsonArray networks = doc.to<JsonArray>();
  const int limitedCount = min(networkCount, 12);
  scannedNetworkCacheCount = 0;

  for (int i = 0; i < limitedCount; ++i) {
    const String ssid = WiFi.SSID(i);
    const int channel = WiFi.channel(i);
    const String bssid = WiFi.BSSIDstr(i);
    JsonObject item = networks.createNestedObject();
    item["ssid"] = ssid;
    item["bssid"] = bssid;
    item["rssi"] = WiFi.RSSI(i);
    item["secure"] = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;
    item["channel"] = channel;

    if (ssid.length() > 0 && channel > 0) {
      scannedSsidCache[scannedNetworkCacheCount] = ssid;
      scannedChannelCache[scannedNetworkCacheCount] = (uint8_t)channel;
      scannedBssidCache[scannedNetworkCacheCount] = bssid;
      scannedNetworkCacheCount++;
    }
  }

  char payload[1536] = {};
  const size_t len = serializeJson(doc, payload, sizeof(payload));
  if (mqtt_client.connected()) {
    const String topic = wifiTopicBase + "/scan/result";
    mqtt_client.publish(topic.c_str(), payload, len);
    Serial.printf("[WIFI] Scan result published count=%d sent=%d\n", networkCount, limitedCount);
  } else {
    Serial.println("[WIFI] MQTT disconnected before scan result publish");
  }
}

void processWifiScan(unsigned long nowMs) {
  nowMs = millis();

  if (!wifiScanActive) {
    return;
  }

  const int result = WiFi.scanComplete();
  if (result == WIFI_SCAN_RUNNING) {
    if (nowMs - wifiScanStartedMs > WIFI_SCAN_TIMEOUT_MS) {
      Serial.printf("[WIFI] Scan timeout after %lu ms\n", (unsigned long)(nowMs - wifiScanStartedMs));
      WiFi.scanDelete();
      wifiScanActive = false;
      if (!runBoundedWifiScanFallback("async scan timed out")) {
        wifiState = WiFi.status() == WL_CONNECTED ? WIFI_CONNECTED : WIFI_IDLE;
        publishWifiStatus("Scan timed out; WiFi radio returned no scan result");
      }
    }
    return;
  }

  if (result == WIFI_SCAN_FAILED) {
    Serial.println("[WIFI] Scan failed");
    WiFi.scanDelete();
    wifiScanActive = false;
    if (!runBoundedWifiScanFallback("async scan failed")) {
      wifiState = WiFi.status() == WL_CONNECTED ? WIFI_CONNECTED : WIFI_IDLE;
      publishWifiStatus("Scan failed; WiFi radio returned WIFI_SCAN_FAILED");
    }
    return;
  }

  publishWifiScanResult(result);
  WiFi.scanDelete();
  wifiScanActive = false;
  wifiState = WiFi.status() == WL_CONNECTED ? WIFI_CONNECTED : WIFI_IDLE;
  publishWifiStatus("Scan complete");
}

void processWifiConnect(unsigned long nowMs) {
  nowMs = millis();

  const bool isConnected = WiFi.status() == WL_CONNECTED;
  if (wifiGotIpEventPending || isConnected) {
    wifiGotIpEventPending = false;
    if (!isConnected) {
      return;
    }

    if (wifiState != WIFI_CONNECTED) {
      activeWifiSsid = pendingWifiSsid.length() > 0 ? pendingWifiSsid : WiFi.SSID();
      wifiState = WIFI_CONNECTED;
      lastWifiDisconnectReason = 0;
      updateEspNowPeerChannel();
      persistWifiCredentialsIfChanged(activeWifiSsid, pendingWifiPass);
      Serial.printf("[WIFI] Connected, IP=%s\n", WiFi.localIP().toString().c_str());
      publishWifiStatus("Connected");
    }
    return;
  }

  if (wifiState != WIFI_CONNECTING) {
    return;
  }

  if (nowMs - wifiConnectStartedMs >= WIFI_CONNECT_TIMEOUT_MS) {
    Serial.printf("[WIFI] Connect failed for %s\n", pendingWifiSsid.c_str());
    wifiState = WIFI_FAILED;
    activeWifiSsid = "";
    const int scannedChannel = findScannedChannelForSsid(pendingWifiSsid);
    if (scannedChannel > 0) {
      expectedContainerChannel = (uint8_t)scannedChannel;
      esp_wifi_set_channel((uint8_t)scannedChannel, WIFI_SECOND_CHAN_NONE);
      setEspNowPeerChannel((uint8_t)scannedChannel);
    }
    publishWifiStatus("Connection timed out");
  }
}

void processWifiTasks(unsigned long nowMs) {
  processWifiScan(nowMs);
  processWifiConnect(nowMs);

  if (wifiStatusDirty && mqtt_client.connected()) {
    publishWifiStatus();
  }
}

// -----------------------------------------------------------------------------
// OTA over WiFi
// -----------------------------------------------------------------------------

void performGatewayOta() {
  if (otaUrl[0] == '\0') {
    otaPending = false;
    return;
  }

  if (otaCancelRequested) {
    finishOtaCancelled("gateway");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    finishOtaFailure("gateway", "Gateway WiFi is not connected");
    return;
  }

  ParsedHttpUrl gatewayOtaParts{};
  if (!parseHttpUrl(otaUrl, gatewayOtaParts)) {
    finishOtaFailure("gateway", "Gateway OTA URL must use http:// or https:// firmware URL");
    return;
  }

  Serial.printf("[OTA] Download started: %s\n", otaUrl);
  publishOtaStatus("gateway", "downloading", "Download started over WiFi", 0);

  WiFiClient plainClient;
  WiFiClientSecure tlsClient;
  WiFiClient *downloadClient = &plainClient;
  if (gatewayOtaParts.https) {
    tlsClient.setInsecure();
    downloadClient = &tlsClient;
  }

  lastGatewayOtaProgress = 255;
  lastGatewayOtaProgressMs = 0;
  activeGatewayOtaClient = downloadClient;

  httpUpdate.rebootOnUpdate(false);
  httpUpdate.onProgress([](int current, int total) {
    if (total <= 0) {
      return;
    }

    const uint8_t progress = (uint8_t)(((uint64_t)current * 100) / (uint32_t)total);
    const unsigned long nowMs = millis();
    if (progress == lastGatewayOtaProgress && (nowMs - lastGatewayOtaProgressMs) < 2000UL) {
      return;
    }

    if (progress == 100 || lastGatewayOtaProgress == 255 || progress >= lastGatewayOtaProgress + 5) {
      lastGatewayOtaProgress = progress;
      lastGatewayOtaProgressMs = nowMs;
      publishOtaStatus("gateway", "downloading", "Downloading firmware over WiFi", progress);
      mqtt_client.loop();
    }

    if (otaCancelRequested) {
      if (activeGatewayOtaClient) {
        activeGatewayOtaClient->stop();
      }
    }
  });

  const t_httpUpdate_return result = httpUpdate.update(*downloadClient, otaUrl);
  activeGatewayOtaClient = nullptr;
  downloadClient->stop();

  switch (result) {
    case HTTP_UPDATE_OK:
      if (otaCancelRequested) {
        finishOtaCancelled("gateway");
        break;
      }
      publishOtaStatus("gateway", "success", "Update successful, rebooting", 100);
      Serial.println("[OTA] Update successful, rebooting");
      flushMqttFor(OTA_SUCCESS_MQTT_FLUSH_MS);
      delay(500);
      ESP.restart();
      break;
    case HTTP_UPDATE_NO_UPDATES:
      finishOtaFailure("gateway", "No update was available");
      break;
    case HTTP_UPDATE_FAILED: {
      if (otaCancelRequested) {
        finishOtaCancelled("gateway");
        break;
      }
      String error = httpUpdate.getLastErrorString();
      if (error.length() == 0) {
        error = "HTTPUpdate failed";
      }
      finishOtaFailure("gateway", error.c_str());
      break;
    }
  }
}

void performContainerOta() {
  if (otaUrl[0] == '\0') {
    otaPending = false;
    return;
  }

  if (otaCancelRequested) {
    finishOtaCancelled("container");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    finishOtaFailure("container", "Gateway WiFi is not connected");
    return;
  }

  Serial.printf("[OTA] Downloading container firmware from %s\n", otaUrl);
  publishOtaStatus("container", "downloading", "Preparing WiFi container download", 0);

  ParsedHttpUrl parts{};
  if (!parseHttpUrl(otaUrl, parts)) {
    finishOtaFailure("container", "Container OTA URL must use http:// or https:// firmware URL");
    return;
  }

  WiFiClient plainClient;
  WiFiClientSecure tlsClient;
  WiFiClient *downloadClient = &plainClient;
  if (parts.https) {
    tlsClient.setInsecure();
    downloadClient = &tlsClient;
  }

  int32_t totalSize = -1;
  if (!openWifiHttpStream(*downloadClient, otaUrl, parts, totalSize)) {
    finishOtaFailure("container", "Could not download container firmware over WiFi");
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
  uint8_t lastProgress = 255;
  unsigned long lastDataMs = millis();

  while (bytesLeft > 0 && (downloadClient->connected() || downloadClient->available())) {
    if (otaCancelRequested) {
      downloadClient->stop();
      finishOtaCancelled("container");
      return;
    }

    const int availableBytes = downloadClient->available();
    if (availableBytes <= 0) {
      if (millis() - lastDataMs > OTA_READ_TIMEOUT_MS) {
        downloadClient->stop();
        finishOtaFailure("container", "Timed out while downloading container firmware");
        return;
      }
      mqtt_client.loop();
      if (otaCancelRequested) {
        downloadClient->stop();
        finishOtaCancelled("container");
        return;
      }
      maintainConnectivity(millis());
      delay(10);
      continue;
    }

    const size_t toRead = min((size_t)OTA_CHUNK_SIZE, min((size_t)availableBytes, (size_t)bytesLeft));
    const int got = downloadClient->read(chunkBuffer, toRead);
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

    const uint8_t progress = (uint8_t)(((uint64_t)offset * 100) / (uint32_t)totalSize);
    if (progress == 100 || lastProgress == 255 || progress >= lastProgress + 5) {
      lastProgress = progress;
      publishOtaStatus("container", "flashing", "Relaying firmware to container", progress);
    }

    mqtt_client.loop();
    if (otaCancelRequested) {
      downloadClient->stop();
      finishOtaCancelled("container");
      return;
    }
    maintainConnectivity(millis());
    delay(20);
  }

  downloadClient->stop();

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

void queueOtaCommand(JsonDocument &doc, const char *topic) {
  const char *cmd = doc["cmd"] | "";
  const char *target = doc["target"] | (strcmp(topic, OTA_CONTAINER_CMD_TOPIC) == 0 ? "container" : "gateway");

  if (strcmp(cmd, "ota_cancel") == 0) {
    const bool targetIsContainer = strcmp(target, "container") == 0;
    const bool matchesActiveTarget = otaPending && (otaIsForContainer == targetIsContainer);
    if (matchesActiveTarget) {
      otaCancelRequested = true;
      Serial.printf("[OTA] Cancel requested for %s\n", target);
    } else {
      publishOtaStatus(target, "cancelled", "No active update to cancel", 0);
    }
    return;
  }

  if (strcmp(cmd, "ota_update") != 0) {
    return;
  }

  const char *url = doc["url"] | "";
  const char *filename = doc["filename"] | "firmware";
  if (url[0] == '\0') {
    Serial.println("[OTA] Missing url in command");
    publishOtaStatus(target, "error", "Missing firmware URL", 0);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    publishOtaStatus(target, "error", "Gateway WiFi is not connected", 0);
    return;
  }

  memset(otaUrl, 0, sizeof(otaUrl));
  memset(otaFilename, 0, sizeof(otaFilename));
  strncpy(otaUrl, url, sizeof(otaUrl) - 1);
  strncpy(otaFilename, filename, sizeof(otaFilename) - 1);
  otaExpectedSize = doc["size"] | 0;
  otaIsForContainer = strcmp(target, "container") == 0;
  otaCancelRequested = false;
  if (otaIsForContainer) {
    otaContainerTopicBase = topicBaseFromSuffix(topic, "/command");
  } else {
    otaGatewayTopicBase = topicBaseFromSuffix(topic, "/command");
  }
  otaPending = true;

  Serial.printf("[OTA] Queued: target=%s url=%s\n", target, otaUrl);
  publishOtaStatus(target, "pending", "Command received, starting update", 0);
}

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  if (topic == nullptr) {
    return;
  }

  if (strcmp(topic, WIFI_SCAN_REQUEST_TOPIC) == 0 ||
      topicMatchesSelectedTruck(topic, "/gateway/wifi/scan/request")) {
    wifiTopicBase = topicBaseFromSuffix(topic, "/scan/request");
    startWifiScan();
    return;
  }

  if (payload == nullptr || length == 0) {
    return;
  }

  if (strcmp(topic, WIFI_CONNECT_TOPIC) == 0 ||
      topicMatchesSelectedTruck(topic, "/gateway/wifi/connect")) {
    wifiTopicBase = topicBaseFromSuffix(topic, "/connect");
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
      Serial.println("[WIFI] Invalid JSON connect payload");
      wifiState = WIFI_FAILED;
      publishWifiStatus("Invalid JSON connect payload");
      return;
    }

    const char *ssid = doc["ssid"] | "";
    const char *password = doc["password"] | "";
    const uint8_t channel = doc["channel"] | 0;
    const char *bssid = doc["bssid"] | "";
    beginWifiConnect(String(ssid), String(password), false, channel, bssid);
    return;
  }

  const bool isGatewayOtaTopic =
      strcmp(topic, OTA_COMMAND_TOPIC) == 0 ||
      topicMatchesSelectedTruck(topic, "/ota/gateway/command");
  const bool isContainerOtaTopic =
      strcmp(topic, OTA_CONTAINER_CMD_TOPIC) == 0 ||
      topicMatchesSelectedTruck(topic, "/ota/container/command");

  if (!isGatewayOtaTopic && !isContainerOtaTopic) {
    return;
  }

  StaticJsonDocument<384> doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
    Serial.println("[OTA] Invalid JSON command");
    return;
  }

  queueOtaCommand(doc, topic);
}

void processPendingOta() {
  if (!otaPending) {
    return;
  }

  if (otaCancelRequested) {
    finishOtaCancelled(otaIsForContainer ? "container" : "gateway");
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

void onWifiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_START:
      Serial.println("[WIFI] STA started");
      break;
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.printf("[WIFI] Associated to AP, channel=%u\n", (unsigned int)WiFi.channel());
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      wifiGotIpEventPending = true;
      Serial.printf("[WIFI] Got IP=%s\n", WiFi.localIP().toString().c_str());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      lastWifiDisconnectReason = info.wifi_sta_disconnected.reason;
      Serial.printf("[WIFI] Disconnected reason=%u (%s)\n",
                    (unsigned int)lastWifiDisconnectReason,
                    wifiReasonName(lastWifiDisconnectReason));
      break;
    default:
      break;
  }
}

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
  WiFi.setSleep(false);
  esp_wifi_set_channel(ESP_NOW_BOOT_CHANNEL, WIFI_SECOND_CHAN_NONE);

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
    peerInfo.channel = ESP_NOW_BOOT_CHANNEL;
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
  raw_tcp_transport.stop();
  secure_client.clearWriteError();
  raw_tcp_transport.clearWriteError();
  Serial.println("[MQTT] Socket cleanup done");

  if (!ensureNetworkAndGprs()) return false;

  Serial.printf("[TLS] Direct SIM800L transport host=%s:%u\n",
                MQTT_BROKER_HOST, MQTT_BROKER_PORT);

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
  mqtt_client.subscribe(WIFI_SCAN_REQUEST_TOPIC, 1);
  mqtt_client.subscribe(WIFI_CONNECT_TOPIC, 1);
  mqtt_client.subscribe(OTA_COMMAND_TOPIC_FILTER, 1);
  mqtt_client.subscribe(OTA_CONTAINER_CMD_TOPIC_FILTER, 1);
  mqtt_client.subscribe(WIFI_SCAN_REQUEST_TOPIC_FILTER, 1);
  mqtt_client.subscribe(WIFI_CONNECT_TOPIC_FILTER, 1);
  Serial.println("[MQTT] Subscribed to OTA command topics");
  Serial.println("[MQTT] Subscribed to WiFi management topics");

  Serial.println("[MQTT] Connected over TLS 1.2");
  publishWifiStatus();
  publishGatewayRunningStatus();
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
  Serial.begin(DEBUG_BAUD);
  delay(400);
  bootMs = millis();

  Serial.println("\n=== Smart Cargo Gateway Boot ===");
  Serial.println("Design: ESP32 SSLClient/BearSSL TLS + SIM800L MQTT, WiFi OTA HTTP");
  Serial.printf("[FW] Build=%s\n", FIRMWARE_BUILD);
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

  WiFi.persistent(false);
  WiFi.onEvent(onWifiEvent);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  initEspNow();
  wifiPrefsReady = wifiPrefs.begin("wificfg", false);
  mqtt_client.setCallback(onMqttMessage);
  attemptStoredWifiConnect();

  if (!ensureModemReady()) {
    Serial.println("[GSM] Modem not ready at boot; loop will retry.");
  }
}

void loop() {
  const unsigned long nowMs = millis();

  gpsPump();
  gpsMaybeScanBaud(nowMs);
  mqtt_client.loop();
  processWifiTasks(nowMs);
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
    Serial.printf("[STATUS] net=%u gprs=%u mqtt=%u wifi=%s gpsFix=%u sats=%lu gpsAgeMs=%lu gpsChars=%lu nmeaOk=%lu nmeaBad=%lu gpsBaud=%lu gpsRx=%d gpsTx=%d pending=%u dropMac=%lu dropLen=%lu\n",
                  modem.isNetworkConnected() ? 1 : 0,
                  modem.isGprsConnected() ? 1 : 0,
                  mqtt_client.connected() ? 1 : 0,
                  wifiStateName(wifiState),
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
