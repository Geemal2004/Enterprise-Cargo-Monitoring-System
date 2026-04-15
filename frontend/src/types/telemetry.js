export const OFFLINE_THRESHOLD_MS = 30000;

export function getDeviceKey(entry) {
  if (entry && entry.key) {
    return entry.key;
  }
  const truckId = entry && entry.truckId ? entry.truckId : "UNKNOWN_TRUCK";
  const containerId = entry && entry.containerId ? entry.containerId : "UNKNOWN_CONTAINER";
  return `${truckId}::${containerId}`;
}

export function getDeviceLabel(entry) {
  const truckId = entry && entry.truckId ? entry.truckId : "UNKNOWN_TRUCK";
  const containerId = entry && entry.containerId ? entry.containerId : "UNKNOWN_CONTAINER";
  return `${truckId} / ${containerId}`;
}

export function extractLatestEntries(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (payload.byKey && typeof payload.byKey === "object") {
    return Object.values(payload.byKey);
  }

  return [];
}

export function extractAlerts(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.alerts)) {
    return payload.alerts;
  }

  return [];
}

export function extractTelemetry(entry) {
  if (!entry || typeof entry !== "object") {
    return {};
  }

  if (entry.telemetry && typeof entry.telemetry === "object") {
    return entry.telemetry;
  }

  return {};
}

function historyCandidate(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (Array.isArray(entry.history)) return entry.history;
  if (Array.isArray(entry.telemetryHistory)) return entry.telemetryHistory;

  const telemetry = extractTelemetry(entry);
  if (Array.isArray(telemetry.history)) return telemetry.history;

  return null;
}

export function extractHistoryPoints(entry) {
  const candidate = historyCandidate(entry);
  if (!candidate || candidate.length === 0) {
    return [];
  }

  return candidate
    .map((point, index) => {
      const tsValue = point.ts || point.timestamp || point.receivedAt || point.time;
      const date = tsValue ? new Date(tsValue) : null;
      const label = date && !Number.isNaN(date.getTime())
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : `P${index + 1}`;

      const env = point.env || {};
      const gas = point.gas || {};
      const fallbackTemp = typeof point.temperatureC === "number" ? point.temperatureC : null;

      return {
        label,
        temperatureC: typeof env.temperatureC === "number" ? env.temperatureC : fallbackTemp,
        humidityPct: typeof env.humidityPct === "number" ? env.humidityPct : null,
        gas: typeof gas.mq2Raw === "number" ? gas.mq2Raw : null,
      };
    })
    .filter((point) => point.temperatureC !== null || point.humidityPct !== null || point.gas !== null);
}
