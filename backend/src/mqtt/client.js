const mqtt = require("mqtt");
const { parseTelemetryTopic } = require("./topicParser");

function createConcurrentQueue(concurrency, onSizeChanged) {
  const tasks = [];
  let active = 0;

  function size() {
    return tasks.length + active;
  }

  function notify() {
    if (typeof onSizeChanged === "function") {
      onSizeChanged(size());
    }
  }

  function drain() {
    while (active < concurrency && tasks.length > 0) {
      const task = tasks.shift();
      active += 1;
      notify();

      Promise.resolve()
        .then(task)
        .catch(() => {
          // Error handling is implemented by the task itself.
        })
        .finally(() => {
          active -= 1;
          notify();
          drain();
        });
    }
  }

  function add(task) {
    tasks.push(task);
    notify();
    drain();
  }

  return {
    add,
    size,
  };
}

function createMqttConsumer(deps) {
  const {
    config,
    logger,
    runtimeState,
    onTelemetryMessage,
  } = deps;

  if (!config.mqtt.host) {
    throw new Error("Missing MQTT broker host. Set MQTT_BROKER_HOST or MQTT_BROKER_URL.");
  }

  const options = {
    protocol: "mqtts",
    host: config.mqtt.host,
    port: config.mqtt.port,
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: config.mqtt.reconnectPeriodMs,
    connectTimeout: config.mqtt.connectTimeoutMs,
    rejectUnauthorized: config.mqtt.rejectUnauthorized,
    clientId: `${config.mqtt.clientIdPrefix}-${Math.random().toString(16).slice(2, 10)}`,
  };

  if (config.mqtt.ca) {
    options.ca = config.mqtt.ca;
  }

  const queue = createConcurrentQueue(config.ingest.queueConcurrency, (current) => {
    runtimeState.setMqttQueueBacklog(current);
  });

  const client = mqtt.connect(options);

  client.on("connect", () => {
    runtimeState.markMqttConnected(config.mqtt.topicFilter);
    logger.info("MQTT connected", {
      host: config.mqtt.host,
      port: config.mqtt.port,
      topicFilter: config.mqtt.topicFilter,
    });

    client.subscribe(config.mqtt.topicFilter, { qos: 1 }, (error) => {
      if (error) {
        runtimeState.markMqttError(error);
        logger.error("MQTT subscribe failed", { error: error.message });
        return;
      }

      logger.info("MQTT subscription active", {
        topicFilter: config.mqtt.topicFilter,
      });
    });
  });

  client.on("message", (topic, payloadBuffer) => {
    runtimeState.markMqttMessageReceived();

    const backlog = queue.size();
    if (backlog >= config.ingest.queueMaxBacklog) {
      runtimeState.markMqttMessageRejected("ingest_queue_overflow");
      logger.warn("Dropping telemetry due to ingest queue overflow", {
        backlog,
        maxBacklog: config.ingest.queueMaxBacklog,
      });
      return;
    }

    const payloadText = payloadBuffer.toString("utf8");

    queue.add(async () => {
      try {
        const topicInfo = parseTelemetryTopic(topic);
        if (!topicInfo) {
          runtimeState.markMqttMessageRejected("topic_mismatch");
          return;
        }

        let parsedPayload;
        try {
          parsedPayload = JSON.parse(payloadText);
        } catch (_error) {
          runtimeState.markMqttMessageRejected("invalid_json");
          return;
        }

        await onTelemetryMessage(topicInfo, parsedPayload);
      } catch (error) {
        runtimeState.markMqttMessageRejected("ingest_processing_error");
        logger.error("Telemetry processing failed", {
          error: error.message,
          topic,
        });
      }
    });
  });

  client.on("reconnect", () => {
    logger.info("MQTT reconnecting");
  });

  client.on("close", () => {
    runtimeState.markMqttDisconnected();
    logger.warn("MQTT connection closed");
  });

  client.on("offline", () => {
    runtimeState.markMqttDisconnected();
    logger.warn("MQTT client offline");
  });

  client.on("error", (error) => {
    runtimeState.markMqttError(error);
    logger.error("MQTT error", { error: error.message });
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
