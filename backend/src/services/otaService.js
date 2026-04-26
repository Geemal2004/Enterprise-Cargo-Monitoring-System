const mqtt = require("mqtt");

const BROKER_URL =
  process.env.MQTT_BROKER_URL || "mqtts://i8e0f149.ala.asia-southeast1.emqxsl.com:8883";
const MQTT_USER = process.env.MQTT_USERNAME || "cabin_node";
const MQTT_PASS = process.env.MQTT_PASSWORD || "6HYUvbJEkeFr9m4";
const OTA_STATUS_TOPIC_FILTER = "tenant/+/truck/+/ota/+/status";
const GATEWAY_WIFI_TOPIC_BASE =
  process.env.GATEWAY_TOPIC_BASE || "tenant/demo/truck/TRUCK01/gateway/wifi";
const WIFI_SCAN_RESULT_TOPIC_FILTER = "tenant/+/truck/+/gateway/wifi/scan/result";
const WIFI_STATUS_TOPIC_FILTER = "tenant/+/truck/+/gateway/wifi/status";
const OTA_TOPIC_PATTERN =
  /^tenant\/([^/]+)\/truck\/([^/]+)\/ota\/(gateway|container)\/(command|status)$/;
const WIFI_TOPIC_PATTERN =
  /^tenant\/([^/]+)\/truck\/([^/]+)\/gateway\/wifi\/(scan\/result|status)$/;

let mqttClient = null;

const stagedFirmware = {};
const otaStatusByKey = {};
const latestStatusByTarget = {};
const routeContextByKey = {};
const sseClients = [];
let latestWifiNetworks = [];
let latestWifiStatus = {
  state: "unknown",
  receivedAt: null,
};
const wifiNetworksByKey = {};
const wifiStatusByKey = {};
let mqttConnectionState = {
  connected: false,
  state: "initializing",
  lastError: null,
  updatedAt: new Date().toISOString(),
};

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

function buildWifiKey(tenantCode, truckId) {
  return `${tenantCode || ""}::${truckId || ""}`;
}

function parseWifiTopic(topic) {
  const match = WIFI_TOPIC_PATTERN.exec(String(topic || ""));
  if (!match) {
    return null;
  }

  return {
    tenantCode: match[1],
    truckId: match[2],
    kind: match[3],
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

function handleWifiScanResult(topic, message) {
  const context = parseWifiTopic(topic);
  const networks = Array.isArray(message)
    ? message
    : Array.isArray(message?.networks)
      ? message.networks
      : [];

  latestWifiNetworks = networks
    .filter((network) => network && typeof network === "object")
    .map((network) => ({
      ssid: String(network.ssid || ""),
      rssi: Number(network.rssi),
      secure: Boolean(network.secure),
    }))
    .filter((network) => network.ssid);
  if (context) {
    wifiNetworksByKey[buildWifiKey(context.tenantCode, context.truckId)] = latestWifiNetworks;
  }

  broadcastSse({
    type: "wifi_scan",
    tenantCode: context?.tenantCode || null,
    truckId: context?.truckId || null,
    networks: latestWifiNetworks,
    receivedAt: new Date().toISOString(),
  });
}

function handleWifiStatus(topic, message) {
  const context = parseWifiTopic(topic);
  latestWifiStatus = {
    ...(message && typeof message === "object" ? message : {}),
    tenantCode: context?.tenantCode || message?.tenantCode || null,
    truckId: context?.truckId || message?.truckId || null,
    receivedAt: new Date().toISOString(),
  };
  if (context) {
    wifiStatusByKey[buildWifiKey(context.tenantCode, context.truckId)] = latestWifiStatus;
  }

  broadcastSse({
    type: "wifi_status",
    ...latestWifiStatus,
  });
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
    mqttConnectionState = {
      connected: true,
      state: "connected",
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    console.log("[OTA MQTT] Connected to broker");
    mqttClient.subscribe(
      [OTA_STATUS_TOPIC_FILTER, WIFI_SCAN_RESULT_TOPIC_FILTER, WIFI_STATUS_TOPIC_FILTER],
      { qos: 1 },
      (error) => {
      if (error) {
        console.error("[OTA MQTT] Subscribe error:", error.message);
        return;
      }

      console.log("[OTA MQTT] Subscribed to status topic filter:", OTA_STATUS_TOPIC_FILTER);
      console.log("[OTA MQTT] Subscribed to WiFi topic filters:", GATEWAY_WIFI_TOPIC_BASE);
      }
    );
  });

  mqttClient.on("message", (topic, payload) => {
    try {
      const message = JSON.parse(payload.toString());
      const wifiContext = parseWifiTopic(topic);
      if (wifiContext?.kind === "scan/result") {
        handleWifiScanResult(topic, message);
        return;
      }

      if (wifiContext?.kind === "status") {
        handleWifiStatus(topic, message);
        return;
      }

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

  mqttClient.on("reconnect", () => {
    mqttConnectionState = {
      ...mqttConnectionState,
      connected: false,
      state: "reconnecting",
      updatedAt: new Date().toISOString(),
    };
  });

  mqttClient.on("close", () => {
    mqttConnectionState = {
      ...mqttConnectionState,
      connected: false,
      state: "closed",
      updatedAt: new Date().toISOString(),
    };
  });

  mqttClient.on("error", (error) => {
    mqttConnectionState = {
      connected: false,
      state: "error",
      lastError: error.message,
      updatedAt: new Date().toISOString(),
    };
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

function getWifiNetworks(context = null) {
  if (context?.tenantCode && context?.truckId) {
    return wifiNetworksByKey[buildWifiKey(context.tenantCode, context.truckId)] || [];
  }

  return latestWifiNetworks;
}

function getWifiStatus(context = null) {
  if (context?.tenantCode && context?.truckId) {
    return wifiStatusByKey[buildWifiKey(context.tenantCode, context.truckId)] || {
      state: "unknown",
      tenantCode: context.tenantCode,
      truckId: context.truckId,
      receivedAt: null,
    };
  }

  return latestWifiStatus;
}

function getMqttConnectionState() {
  const client = getMqttClient();
  return {
    ...mqttConnectionState,
    connected: Boolean(client.connected),
  };
}

function addSseClient(res) {
  sseClients.push(res);

  for (const status of Object.values(otaStatusByKey)) {
    res.write(`data: ${JSON.stringify({ type: "ota_status", ...status })}\n\n`);
  }

  res.write(
    `data: ${JSON.stringify({
      type: "wifi_scan",
      networks: latestWifiNetworks,
      receivedAt: new Date().toISOString(),
    })}\n\n`
  );
  res.write(`data: ${JSON.stringify({ type: "wifi_status", ...latestWifiStatus })}\n\n`);
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

async function cancelOta({ tenantCode, truckId, containerId, target }) {
  return new Promise((resolve, reject) => {
    const client = getMqttClient();
    const normalizedTarget = normalizeTarget(target);

    if (!client.connected) {
      reject(new Error("MQTT client not connected to broker"));
      return;
    }

    const command = {
      cmd: "ota_cancel",
      target: normalizedTarget,
      tenantId: tenantCode,
      truckId,
      containerId,
      cancelledAt: new Date().toISOString(),
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

      console.log(`[OTA] Cancel published -> ${topic}`, command);

      const status = setUnitStatus(
        {
          tenantCode,
          truckId,
          containerId,
          target: normalizedTarget,
        },
        {
          state: "cancelling",
          message: "Cancel command sent, waiting for device confirmation",
          progress: 0,
          cancelledAt: command.cancelledAt,
        }
      );

      resolve(status);
    });
  });
}

async function publishMqttMessage(topic, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const client = getMqttClient();
    let settled = false;
    const timeoutMs = options.timeoutMs || 5000;

    if (!client.connected) {
      reject(new Error("MQTT client not connected to broker"));
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`MQTT publish timed out after ${timeoutMs}ms: ${topic}`));
    }, timeoutMs);

    client.publish(
      topic,
      JSON.stringify(payload || {}),
      {
        qos: options.qos ?? 1,
        retain: Boolean(options.retain),
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (error) {
          reject(new Error(`MQTT publish failed: ${error.message}`));
          return;
        }

        console.log(`[MQTT] Published -> ${topic}`, payload || {});
        resolve();
      }
    );
  });
}

getMqttClient();

module.exports = {
  setStagedFirmware,
  getStagedFirmware,
  getAllStagedFirmware,
  getOtaStatus,
  getUnitStatuses,
  getWifiNetworks,
  getWifiStatus,
  getMqttConnectionState,
  triggerOta,
  cancelOta,
  publishMqttMessage,
  addSseClient,
  removeSseClient,
};
