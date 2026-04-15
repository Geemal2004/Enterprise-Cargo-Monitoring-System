const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

function readBool(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readNumber(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }
  return parsed;
}

function parseBrokerUrl() {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    return null;
  }

  const url = new URL(brokerUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 8883),
  };
}

function readCaBuffer(caPathValue) {
  if (!caPathValue) {
    return undefined;
  }

  const absolutePath = path.isAbsolute(caPathValue)
    ? caPathValue
    : path.resolve(process.cwd(), caPathValue);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`MQTT CA file does not exist: ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath);
}

const brokerFromUrl = parseBrokerUrl();
const brokerHost = process.env.MQTT_BROKER_HOST || (brokerFromUrl && brokerFromUrl.host);
const brokerPort = readNumber(
  "MQTT_BROKER_PORT",
  (brokerFromUrl && brokerFromUrl.port) || 8883
);

if (!brokerHost) {
  throw new Error(
    "Missing MQTT broker host. Set MQTT_BROKER_HOST or MQTT_BROKER_URL in environment variables."
  );
}

const mqttCaPath = process.env.MQTT_CA_PATH || "";

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  server: {
    port: readNumber("PORT", 5000),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
  mqtt: {
    host: brokerHost,
    port: brokerPort,
    username: process.env.MQTT_USERNAME || "",
    password: process.env.MQTT_PASSWORD || "",
    topicFilter:
      process.env.MQTT_TOPIC_FILTER ||
      "tenant/+/truck/+/container/+/telemetry",
    clientIdPrefix: process.env.MQTT_CLIENT_ID_PREFIX || "smart-cargo-backend",
    connectTimeoutMs: readNumber("MQTT_CONNECT_TIMEOUT_MS", 30000),
    reconnectPeriodMs: readNumber("MQTT_RECONNECT_PERIOD_MS", 5000),
    rejectUnauthorized: readBool("MQTT_REJECT_UNAUTHORIZED", true),
    caPath: mqttCaPath,
    ca: readCaBuffer(mqttCaPath),
  },
  alerts: {
    offlineThresholdMs: readNumber("OFFLINE_THRESHOLD_MS", 30000),
    scanIntervalMs: readNumber("OFFLINE_SCAN_INTERVAL_MS", 5000),
  },
};

module.exports = {
  config,
};
