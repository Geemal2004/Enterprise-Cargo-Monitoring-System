const { config } = require("./config/env");
const { createApp } = require("./app");
const { createTelemetryStore } = require("./services/telemetryStore");
const { startOfflineScanner } = require("./services/offlineScanner");
const { createRuntimeState } = require("./services/runtimeState");
const { createMqttConsumer } = require("./mqtt/client");

const telemetryStore = createTelemetryStore({
  offlineThresholdMs: config.alerts.offlineThresholdMs,
});
const runtimeState = createRuntimeState();

const stopOfflineScanner = startOfflineScanner(
  telemetryStore,
  config.alerts.scanIntervalMs
);
const mqttConsumer = createMqttConsumer(config, telemetryStore, runtimeState);

const app = createApp(config, telemetryStore, runtimeState);
const server = app.listen(config.server.port, () => {
  console.log(`[API] Backend listening on port ${config.server.port}`);
  console.log(
    `[ALERT] Offline threshold ${config.alerts.offlineThresholdMs}ms, scan interval ${config.alerts.scanIntervalMs}ms`
  );
});

function shutdown(signal) {
  console.log(`[SYS] Received ${signal}, shutting down...`);
  stopOfflineScanner();
  mqttConsumer.stop();

  server.close(() => {
    console.log("[SYS] HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.warn("[SYS] Force exit after timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
