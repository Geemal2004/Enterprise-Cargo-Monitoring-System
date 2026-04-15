const mqtt = require("mqtt");
const { parseTelemetryTopic } = require("../utils/topicParser");
const {
  validateTelemetryPayload,
  normalizeTelemetryPayload,
} = require("../utils/payloadValidator");

function createMqttConsumer(config, store, runtimeState) {
  const options = {
    protocol: "mqtts",
    host: config.mqtt.host,
    port: config.mqtt.port,
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: config.mqtt.reconnectPeriodMs,
    connectTimeout: config.mqtt.connectTimeoutMs,
    rejectUnauthorized: config.mqtt.rejectUnauthorized,
    clientId: `${config.mqtt.clientIdPrefix}-${Math.random()
      .toString(16)
      .slice(2, 10)}`,
  };

  if (config.mqtt.ca) {
    options.ca = config.mqtt.ca;
  }

  const client = mqtt.connect(options);

  client.on("connect", () => {
    runtimeState.markMqttConnected(config.mqtt.topicFilter);
    console.log(
      `[MQTT] Connected to ${config.mqtt.host}:${config.mqtt.port} over TLS`
    );

    client.subscribe(config.mqtt.topicFilter, { qos: 1 }, (error) => {
      if (error) {
        runtimeState.markMqttError(error);
        console.error("[MQTT] Subscribe failed", error.message);
        return;
      }
      console.log(`[MQTT] Subscribed to ${config.mqtt.topicFilter}`);
    });
  });

  client.on("message", (topic, payloadBuffer) => {
    const topicInfo = parseTelemetryTopic(topic);
    if (!topicInfo) {
      runtimeState.markMqttMessageRejected("topic_mismatch");
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payloadBuffer.toString("utf8"));
    } catch (error) {
      runtimeState.markMqttMessageRejected("invalid_json");
      return;
    }

    const validation = validateTelemetryPayload(parsedPayload);
    if (!validation.valid) {
      runtimeState.markMqttMessageRejected(
        `invalid_payload:${validation.errors.join("|")}`
      );
      return;
    }

    if (
      parsedPayload.truckId &&
      String(parsedPayload.truckId) !== String(topicInfo.truckId)
    ) {
      runtimeState.markMqttMessageRejected("truck_id_topic_mismatch");
      return;
    }

    if (
      parsedPayload.containerId &&
      String(parsedPayload.containerId) !== String(topicInfo.containerId)
    ) {
      runtimeState.markMqttMessageRejected("container_id_topic_mismatch");
      return;
    }

    const normalized = normalizeTelemetryPayload(topicInfo, parsedPayload);
    store.upsert(normalized);
    runtimeState.markMqttMessageAccepted();
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("close", () => {
    runtimeState.markMqttDisconnected();
    console.log("[MQTT] Connection closed");
  });

  client.on("offline", () => {
    runtimeState.markMqttDisconnected();
    console.log("[MQTT] Offline");
  });

  client.on("error", (error) => {
    runtimeState.markMqttError(error);
    console.error("[MQTT] Error", error.message);
  });

  return {
    stop() {
      client.end(true);
    },
  };
}

module.exports = {
  createMqttConsumer,
};
