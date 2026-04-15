const { evaluateAlerts } = require("../utils/alertRules");

function buildKey(truckId, containerId) {
  return `${truckId}::${containerId}`;
}

function createTelemetryStore(options) {
  const offlineThresholdMs = options.offlineThresholdMs;
  const latestByKey = new Map();

  function upsert(telemetry) {
    const key = buildKey(telemetry.truckId, telemetry.containerId);
    const nowMs = Date.now();
    const alerts = evaluateAlerts(telemetry, nowMs, offlineThresholdMs);

    const entry = {
      key,
      truckId: telemetry.truckId,
      containerId: telemetry.containerId,
      tenantId: telemetry.tenantId,
      telemetry,
      receivedAt: telemetry.receivedAt,
      receivedAtMs: telemetry.receivedAtMs,
      alerts,
      updatedAt: new Date(nowMs).toISOString(),
      updatedAtMs: nowMs,
    };

    latestByKey.set(key, entry);
    return entry;
  }

  function refreshAlerts() {
    const nowMs = Date.now();
    for (const [key, entry] of latestByKey.entries()) {
      const refreshedAlerts = evaluateAlerts(
        entry.telemetry,
        nowMs,
        offlineThresholdMs
      );
      latestByKey.set(key, {
        ...entry,
        alerts: refreshedAlerts,
        updatedAt: new Date(nowMs).toISOString(),
        updatedAtMs: nowMs,
      });
    }
  }

  function getLatest(truckId, containerId) {
    return latestByKey.get(buildKey(truckId, containerId)) || null;
  }

  function getLatestList() {
    return Array.from(latestByKey.values()).sort((a, b) => b.receivedAtMs - a.receivedAtMs);
  }

  function getLatestByKeyObject() {
    const output = {};
    for (const [key, value] of latestByKey.entries()) {
      output[key] = value;
    }
    return output;
  }

  function getActiveAlerts() {
    const alerts = [];
    for (const entry of latestByKey.values()) {
      for (const alert of entry.alerts) {
        alerts.push({
          key: entry.key,
          truckId: entry.truckId,
          containerId: entry.containerId,
          tenantId: entry.tenantId,
          receivedAt: entry.receivedAt,
          alert,
        });
      }
    }
    return alerts;
  }

  function size() {
    return latestByKey.size;
  }

  return {
    upsert,
    refreshAlerts,
    getLatest,
    getLatestList,
    getLatestByKeyObject,
    getActiveAlerts,
    size,
  };
}

module.exports = {
  createTelemetryStore,
};
