const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadEnvironment() {
  const backendEnvPath = path.resolve(__dirname, "../../.env");
  const rootEnvPath = path.resolve(__dirname, "../../../.env");

  if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
    return;
  }

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
    return;
  }

  dotenv.config();
}

loadEnvironment();

function readBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number.`);
  }
  return parsed;
}

function readString(name, fallback = "") {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  return String(raw);
}

function assertJwtSecret(name, value) {
  if (!value || value.length < 32) {
    throw new Error(
      `Environment variable ${name} must be set and at least 32 characters long for JWT security.`
    );
  }
}

function resolveFilePath(value) {
  if (!value) {
    return "";
  }
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function readOptionalFile(filePathValue, label) {
  if (!filePathValue) {
    return undefined;
  }

  const absolutePath = resolveFilePath(filePathValue);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} file does not exist: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath);
}

function parseBrokerUrl() {
  const brokerUrl = readString("MQTT_BROKER_URL", "");
  if (!brokerUrl) {
    return null;
  }

  const url = new URL(brokerUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 8883),
    username: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
  };
}

function buildDatabaseConfig() {
  const connectionString = readString("DATABASE_URL", "");
  const sslEnabled = readBool("DB_SSL", false) || readBool("PGSSL", false);
  const sslRejectUnauthorized = readBool("DB_SSL_REJECT_UNAUTHORIZED", true);
  const sslCaPath = readString("DB_SSL_CA_PATH", "");

  const base = {
    max: readNumber("PGPOOL_MAX", 20),
    idleTimeoutMillis: readNumber("PG_IDLE_TIMEOUT_MS", 30000),
    connectionTimeoutMillis: readNumber("PG_CONNECT_TIMEOUT_MS", 15000),
  };

  if (sslEnabled) {
    base.ssl = {
      rejectUnauthorized: sslRejectUnauthorized,
      ca: readOptionalFile(sslCaPath, "DB SSL CA") || undefined,
    };
  }

  if (connectionString) {
    return {
      ...base,
      connectionString,
    };
  }

  return {
    ...base,
    host: readString("PGHOST", "127.0.0.1"),
    port: readNumber("PGPORT", 5432),
    user: readString("PGUSER", "postgres"),
    password: readString("PGPASSWORD", "postgres"),
    database: readString("PGDATABASE", "smart_cargo"),
  };
}

const brokerFromUrl = parseBrokerUrl();
const legacyBrokerHost = readString("MQTT_BROKER", "");
const brokerHost =
  readString("MQTT_BROKER_HOST", "") ||
  legacyBrokerHost ||
  (brokerFromUrl && brokerFromUrl.host) ||
  "";
const brokerPort = readNumber(
  "MQTT_BROKER_PORT",
  readNumber("MQTT_PORT", (brokerFromUrl && brokerFromUrl.port) || 8883)
);

const mqttCaPath = readString("MQTT_CA_PATH", "");
const jwtAccessSecret = readString("JWT_ACCESS_SECRET", "");
const jwtRefreshSecret = readString("JWT_REFRESH_SECRET", "");
const gasSpikeThresholdRaw = readNumber(
  "ALERT_GAS_SPIKE_THRESHOLD_RAW",
  readNumber("ALERT_GAS_SPIKE_THRESHOLD_PPM", 2000)
);
const smokeThresholdPpm = readNumber("ALERT_SMOKE_THRESHOLD_PPM", 500);

assertJwtSecret("JWT_ACCESS_SECRET", jwtAccessSecret);
assertJwtSecret("JWT_REFRESH_SECRET", jwtRefreshSecret);

const config = {
  nodeEnv: readString("NODE_ENV", "development"),
  logLevel: readString("LOG_LEVEL", "info"),
  server: {
    port: readNumber("PORT", 5000),
    apiPrefix: readString("API_PREFIX", "/api"),
  },
  cors: {
    origin: readString("CORS_ORIGIN", "*"),
  },
  auth: {
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiresIn: readString("JWT_ACCESS_EXPIRES_IN", "15m"),
    jwtRefreshExpiresIn: readString("JWT_REFRESH_EXPIRES_IN", "7d"),
    jwtIssuer: readString("JWT_ISSUER", "smart-cargo-backend"),
    jwtAudience: readString("JWT_AUDIENCE", "smart-cargo-api"),
  },
  mqtt: {
    enabled: Boolean(brokerHost),
    host: brokerHost,
    port: brokerPort,
    username:
      readString("MQTT_USERNAME", "") ||
      readString("MQTT_USER", "") ||
      (brokerFromUrl && brokerFromUrl.username) ||
      "",
    password: readString("MQTT_PASSWORD", "") || (brokerFromUrl && brokerFromUrl.password) || "",
    topicFilter: readString(
      "MQTT_TOPIC_FILTER",
      "tenant/+/truck/+/container/+/telemetry"
    ),
    clientIdPrefix: readString("MQTT_CLIENT_ID_PREFIX", "smart-cargo-backend"),
    connectTimeoutMs: readNumber("MQTT_CONNECT_TIMEOUT_MS", 30000),
    reconnectPeriodMs: readNumber("MQTT_RECONNECT_PERIOD_MS", 5000),
    rejectUnauthorized: readBool("MQTT_REJECT_UNAUTHORIZED", true),
    caPath: mqttCaPath,
    ca: readOptionalFile(mqttCaPath, "MQTT CA"),
  },
  db: {
    runMigrationsOnBoot: readBool("RUN_MIGRATIONS_ON_BOOT", false),
    runSeedsOnBoot: readBool("RUN_SEEDS_ON_BOOT", false),
    pg: buildDatabaseConfig(),
  },
  alerts: {
    highTemperatureThresholdC: readNumber("ALERT_HIGH_TEMPERATURE_THRESHOLD_C", 35),
    gasSpikeThresholdRaw,
    smokeThresholdPpm,
    autoResolveShock: readBool("ALERT_AUTO_RESOLVE_SHOCK", false),
    offlineThresholdMs: readNumber("OFFLINE_THRESHOLD_MS", 30000),
  },
  jobs: {
    offlineScanIntervalMs: readNumber("OFFLINE_SCAN_INTERVAL_MS", 5000),
  },
  ingest: {
    queueConcurrency: readNumber("INGEST_QUEUE_CONCURRENCY", 6),
    queueMaxBacklog: readNumber("INGEST_QUEUE_MAX_BACKLOG", 5000),
  },
  query: {
    historyDefaultLimit: readNumber("HISTORY_DEFAULT_LIMIT", 240),
    historyMaxLimit: readNumber("HISTORY_MAX_LIMIT", 2000),
  },
  ai: {
    tripSummaryEnabled: readBool("AI_TRIP_SUMMARY_ENABLED", true),
    dailySummaryEnabled: readBool("AI_DAILY_SUMMARY_ENABLED", true),
    geminiModel: readString("GEMINI_MODEL", "gemini-flash-lite-latest"),
    geminiApiBaseUrl: readString(
      "GEMINI_API_BASE_URL",
      "https://generativelanguage.googleapis.com/v1beta"
    ),
    geminiApiKeyBase64: readString("GEMINI_API_KEY_BASE64", ""),
    tripSummaryTimeoutMs: readNumber("AI_TRIP_SUMMARY_TIMEOUT_MS", 15000),
    dailySummaryTimeoutMs: readNumber("AI_DAILY_SUMMARY_TIMEOUT_MS", 15000),
    dailySummaryMaxPoints: readNumber("AI_DAILY_SUMMARY_MAX_POINTS", 96),
    dailySummaryBucketMinutes: readNumber("AI_DAILY_SUMMARY_BUCKET_MINUTES", 15),
    dailySummarySystemPrompt: readString("AI_DAILY_SUMMARY_SYSTEM_PROMPT", ""),
  },
};

module.exports = { config };
