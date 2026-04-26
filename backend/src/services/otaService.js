const mqtt = require("mqtt");

const BROKER_URL =
  process.env.MQTT_BROKER_URL || "mqtts://i8e0f149.ala.asia-southeast1.emqxsl.com:8883";
const MQTT_USER = process.env.MQTT_USERNAME || "cabin_node";
const MQTT_PASS = process.env.MQTT_PASSWORD || "6HYUvbJEkeFr9m4";
const OTA_STATUS_TOPIC_FILTER = "tenant/+/truck/+/ota/+/status";
const OTA_TOPIC_PATTERN =
  /^tenant\/([^/]+)\/truck\/([^/]+)\/ota\/(gateway|container)\/(command|status)$/;

let mqttClient = null;

const stagedFirmware = {};
const otaStatusByKey = {};
const latestStatusByTarget = {};
const routeContextByKey = {};
const sseClients = [];

function normalizeTarget(target) {
  return String(target || "").trim().toLowerCase();
}

function buildRouteKey(tenantCode, truckId, target) {
  return `${tenantCode || ""}::${truckId || ""}::${normalizeTarget(target)}`;
}

function buildUnitKey(tenantCode, truckId, containerId) {
  return `${tenantCode || ""}::${truckId || ""}::${containerId || ""}`;
}

function buildStatusKey(tenantCode, truckId, containerId, target) {
  return `${buildUnitKey(tenantCode, truckId, containerId)}::${normalizeTarget(target)}`;
}

function otaTopic(tenantCode, truckId, target, direction) {
  return `tenant/${tenantCode}/truck/${truckId}/ota/${normalizeTarget(target)}/${direction}`;
}

function parseOtaTopic(topic) {
  const match = OTA_TOPIC_PATTERN.exec(String(topic || ""));
  if (!match) {
    return null;
  }

  return {
    tenantCode: match[1],
    truckId: match[2],
    target: match[3],
    direction: match[4],
  };
}

function broadcastSse(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch (_error) {
      // Ignore stale sockets; they are removed on close.
    }
  }
}

function setUnitStatus(context, message) {
  if (!context?.tenantCode || !context?.truckId || !context?.containerId || !context?.target) {
    return null;
  }

  const payload = {
    ...message,
    target: normalizeTarget(context.target),
    tenantCode: context.tenantCode,
    tenantId: message?.tenantId || context.tenantCode,
    truckId: context.truckId,
    containerId: context.containerId,
    receivedAt: new Date().toISOString(),
  };

  const statusKey = buildStatusKey(
    context.tenantCode,
    context.truckId,
    context.containerId,
    context.target
  );

  otaStatusByKey[statusKey] = payload;
  latestStatusByTarget[normalizeTarget(context.target)] = payload;
  broadcastSse({ type: "ota_status", ...payload });

  return payload;
}

function resolveStatusContext(topic, message) {
  const parsed = parseOtaTopic(topic);
  if (!parsed) {
    return null;
  }

  const routeKey = buildRouteKey(parsed.tenantCode, parsed.truckId, parsed.target);
  const remembered = routeContextByKey[routeKey] || null;

  const tenantCode = String(message?.tenantId || parsed.tenantCode || "").trim();
  const truckId = String(message?.truckId || parsed.truckId || "").trim();
  const containerId = String(message?.containerId || remembered?.containerId || "").trim();

  if (!tenantCode || !truckId || !containerId) {
    return null;
  }

  return {
    tenantCode,
    truckId,
    containerId,
    target: parsed.target,
  };
}

function getMqttClient() {
  if (mqttClient) {
    return mqttClient;
  }

  mqttClient = mqtt.connect(BROKER_URL, {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: `ota-server-${Date.now()}`,
    rejectUnauthorized: true,
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    console.log("[OTA MQTT] Connected to broker");
    mqttClient.subscribe(OTA_STATUS_TOPIC_FILTER, { qos: 1 }, (error) => {
      if (error) {
        console.error("[OTA MQTT] Subscribe error:", error.message);
        return;
      }

      console.log("[OTA MQTT] Subscribed to status topic filter:", OTA_STATUS_TOPIC_FILTER);
    });
  });

  mqttClient.on("message", (topic, payload) => {
    try {
      const message = JSON.parse(payload.toString());
      const context = resolveStatusContext(topic, message);

      if (!context) {
        console.warn("[OTA MQTT] Ignoring status with incomplete routing context:", topic);
        return;
      }

      setUnitStatus(context, message);
    } catch (error) {
      console.error("[OTA MQTT] Bad status payload:", error.message);
    }
  });

  mqttClient.on("error", (error) => {
    console.error("[OTA MQTT] Error:", error.message);
  });

  return mqttClient;
}

function setStagedFirmware(target, info) {
  stagedFirmware[normalizeTarget(target)] = info;
}

function getStagedFirmware(target) {
  return stagedFirmware[normalizeTarget(target)] || null;
}

function getAllStagedFirmware() {
  return {
    gateway: getStagedFirmware("gateway"),
    container: getStagedFirmware("container"),
  };
}

function getOtaStatus(target, context = null) {
  const normalizedTarget = normalizeTarget(target);

  if (context?.tenantCode && context?.truckId && context?.containerId) {
    return (
      otaStatusByKey[
        buildStatusKey(context.tenantCode, context.truckId, context.containerId, normalizedTarget)
      ] || null
    );
  }

  return latestStatusByTarget[normalizedTarget] || null;
}

function getUnitStatuses(context) {
  return {
    gateway: getOtaStatus("gateway", context),
    container: getOtaStatus("container", context),
  };
}

function addSseClient(res) {
  sseClients.push(res);

  for (const status of Object.values(otaStatusByKey)) {
    res.write(`data: ${JSON.stringify({ type: "ota_status", ...status })}\n\n`);
  }
}

function removeSseClient(res) {
  const index = sseClients.indexOf(res);
  if (index !== -1) {
    sseClients.splice(index, 1);
  }
}

async function triggerOta({ tenantCode, truckId, containerId, target, firmwareUrl, staged }) {
  return new Promise((resolve, reject) => {
    const client = getMqttClient();
    const normalizedTarget = normalizeTarget(target);

    if (!client.connected) {
      reject(new Error("MQTT client not connected to broker"));
      return;
    }

    const command = {
      cmd: "ota_update",
      target: normalizedTarget,
      tenantId: tenantCode,
      truckId,
      containerId,
      url: firmwareUrl,
      size: staged.sizeBytes,
      filename: staged.filename,
      triggeredAt: new Date().toISOString(),
    };

    const topic = otaTopic(tenantCode, truckId, normalizedTarget, "command");
    routeContextByKey[buildRouteKey(tenantCode, truckId, normalizedTarget)] = {
      tenantCode,
      truckId,
      containerId,
      target: normalizedTarget,
    };

    client.publish(topic, JSON.stringify(command), { qos: 1, retain: false }, (error) => {
      if (error) {
        reject(new Error(`MQTT publish failed: ${error.message}`));
        return;
      }

      console.log(`[OTA] Command published -> ${topic}`, command);

      setUnitStatus(
        {
          tenantCode,
          truckId,
          containerId,
          target: normalizedTarget,
        },
        {
          state: "pending",
          message: "Command sent, waiting for device acknowledgment",
          filename: staged.filename,
          progress: 0,
          triggeredAt: command.triggeredAt,
        }
      );

      resolve();
    });
  });
}

getMqttClient();

module.exports = {
  setStagedFirmware,
  getStagedFirmware,
  getAllStagedFirmware,
  getOtaStatus,
  getUnitStatuses,
  triggerOta,
  addSseClient,
  removeSseClient,
};
