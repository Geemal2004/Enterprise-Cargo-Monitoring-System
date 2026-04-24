export const OFFLINE_THRESHOLD_MS = 30000;
const TELEMETRY_TIME_ZONE = "Asia/Colombo";

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
    const telemetry = entry.telemetry;
    const env = telemetry.env && typeof telemetry.env === "object" ? telemetry.env : {};
    const gas = telemetry.gas && typeof telemetry.gas === "object" ? telemetry.gas : {};
    const motion = telemetry.motion && typeof telemetry.motion === "object" ? telemetry.motion : {};
    const gps = telemetry.gps && typeof telemetry.gps === "object" ? telemetry.gps : {};
    const status = telemetry.status && typeof telemetry.status === "object" ? telemetry.status : {};

    return {
      ...telemetry,
      seq: asNumberOrNull(telemetry.seq) ?? telemetry.seq,
      gps: {
        ...gps,
        lat: asNumberOrNull(gps.lat),
        lon: asNumberOrNull(gps.lon),
        speedKph: asNumberOrNull(gps.speedKph),
      },
      env: {
        ...env,
        temperatureC: asNumberOrNull(env.temperatureC),
        humidityPct: asNumberOrNull(env.humidityPct),
        pressureHpa: asNumberOrNull(env.pressureHpa),
      },
      gas: {
        ...gas,
        mq2Raw: asNumberOrNull(gas.mq2Raw),
        alert: asBooleanOrNull(gas.alert) ?? Boolean(gas.alert),
      },
      motion: {
        ...motion,
        tiltDeg: asNumberOrNull(motion.tiltDeg),
        shock: asBooleanOrNull(motion.shock) ?? Boolean(motion.shock),
      },
      status: {
        ...status,
        sdOk: asBooleanOrNull(status.sdOk),
        gpsFix: asBooleanOrNull(status.gpsFix),
        uplink: status.uplink ?? "unknown",
      },
    };
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

function asNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asBooleanOrNull(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return null;
}

function parseTimestampMs(value) {
  if (value === null || value === undefined) {
    return NaN;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) {
      return NaN;
    }

    // Accept unix timestamps provided as numeric strings.
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
    }

    return Date.parse(raw);
  }

  return NaN;
}

function formatTelemetryTime(tsMs) {
  return new Date(tsMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: TELEMETRY_TIME_ZONE,
  });
}

function buildHistoryPoint(point, index) {
  const tsRaw =
    point.ts ??
    point.timestamp ??
    point.occurredAt ??
    point.receivedAt ??
    point.time ??
    point.createdAt ??
    null;
  const parsedTsMs = parseTimestampMs(tsRaw);

  const tsMs = Number.isFinite(parsedTsMs) ? parsedTsMs : Date.now();
  const env = point.env || {};
  const gas = point.gas || {};

  return {
    index,
    tsMs,
    label: formatTelemetryTime(tsMs),
    temperatureC: asNumberOrNull(env.temperatureC ?? point.temperatureC),
    humidityPct: asNumberOrNull(env.humidityPct ?? point.humidityPct),
    pressureHpa: asNumberOrNull(env.pressureHpa ?? point.pressureHpa),
    gasRaw: asNumberOrNull(gas.mq2Raw ?? point.gasRaw),
  };
}

export function extractHistoryPoints(entry) {
  const candidate = historyCandidate(entry);
  if (!candidate || candidate.length === 0) {
    return [];
  }

  return candidate
    .map((point, index) => buildHistoryPoint(point, index))
    .filter(
      (point) =>
        point.temperatureC !== null ||
        point.humidityPct !== null ||
        point.pressureHpa !== null ||
        point.gasRaw !== null
    );
}

export function extractHistoryFromPayload(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.map((point, index) => buildHistoryPoint(point, index));
  }

  if (Array.isArray(payload.items)) {
    return payload.items.map((point, index) => buildHistoryPoint(point, index));
  }

  if (Array.isArray(payload.history)) {
    return payload.history.map((point, index) => buildHistoryPoint(point, index));
  }

  if (Array.isArray(payload.data)) {
    return payload.data.map((point, index) => buildHistoryPoint(point, index));
  }

  return [];
}

export function getAlertPayload(alertItem) {
  if (!alertItem || typeof alertItem !== "object") {
    return {};
  }
  return alertItem.alert && typeof alertItem.alert === "object" ? alertItem.alert : {};
}

export function normalizeSeverity(severity) {
  const value = String(severity || "").toLowerCase();
  if (value === "critical") return "critical";
  if (value === "high" || value === "warning") return "warning";
  if (value === "medium" || value === "low" || value === "info") return "info";
  return "info";
}

export function severityLabel(level) {
  if (level === "critical") return "Critical";
  if (level === "warning") return "Warning";
  return "Info";
}

export function getReceivedAtMs(entry) {
  const telemetry = extractTelemetry(entry);

  if (entry && typeof entry.receivedAtMs === "number") {
    return entry.receivedAtMs;
  }
  if (telemetry && typeof telemetry.receivedAtMs === "number") {
    return telemetry.receivedAtMs;
  }

  const rawTs = entry && entry.receivedAt ? entry.receivedAt : telemetry.receivedAt;
  const parsed = rawTs ? Date.parse(rawTs) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateTime(ts) {
  if (!ts) return "-";
  const date = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function formatRelativeTime(tsMs) {
  if (!tsMs) return "-";
  const diff = Math.max(0, Date.now() - tsMs);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function groupAlertsByDevice(alerts) {
  const byKey = {};
  for (const item of alerts || []) {
    const key = item && item.key ? item.key : `${item?.truckId || "UNKNOWN"}::${item?.containerId || "UNKNOWN"}`;
    if (!byKey[key]) {
      byKey[key] = [];
    }
    byKey[key].push(item);
  }
  return byKey;
}

export function hasWarningState(alertsForDevice) {
  if (!alertsForDevice || alertsForDevice.length === 0) {
    return false;
  }
  return alertsForDevice.some((item) => {
    const code = String(getAlertPayload(item).code || "").toUpperCase();
    return code !== "OFFLINE";
  });
}

export function isEntryOffline(entry, alertsForDevice, thresholdMs = OFFLINE_THRESHOLD_MS) {
  const offlineFromAlert = (alertsForDevice || []).some((item) => {
    const code = String(getAlertPayload(item).code || "").toUpperCase();
    return code === "OFFLINE";
  });

  const receivedAtMs = getReceivedAtMs(entry);
  if (!receivedAtMs) {
    return offlineFromAlert;
  }

  return offlineFromAlert || Date.now() - receivedAtMs > thresholdMs;
}

export function deriveDeviceStatus(entry, alertsForDevice, thresholdMs = OFFLINE_THRESHOLD_MS) {
  if (isEntryOffline(entry, alertsForDevice, thresholdMs)) {
    return {
      code: "offline",
      label: "Offline",
      tone: "offline",
    };
  }

  if (hasWarningState(alertsForDevice)) {
    return {
      code: "warning",
      label: "Warning",
      tone: "warning",
    };
  }

  return {
    code: "online",
    label: "Online",
    tone: "online",
  };
}

export function deriveFleetSummary(entries, alerts, thresholdMs = OFFLINE_THRESHOLD_MS) {
  const alertsByKey = groupAlertsByDevice(alerts);

  let online = 0;
  let warning = 0;
  for (const entry of entries || []) {
    const key = getDeviceKey(entry);
    const status = deriveDeviceStatus(entry, alertsByKey[key] || [], thresholdMs);
    if (status.code === "online") {
      online += 1;
    }
    if (status.code === "warning") {
      warning += 1;
    }
  }

  return {
    totalTrucks: (entries || []).length,
    onlineTrucks: online,
    activeAlerts: (alerts || []).length,
    warningContainers: warning,
  };
}

export function pushLiveHistory(previousByKey, entries, maxPoints = 72) {
  const next = { ...previousByKey };

  for (const entry of entries || []) {
    const key = getDeviceKey(entry);
    const telemetry = extractTelemetry(entry);

    const point = buildHistoryPoint(
      {
        ts: telemetry.ts || telemetry.receivedAt || entry.receivedAt,
        env: telemetry.env,
        gas: telemetry.gas,
      },
      0
    );

    const current = next[key] ? [...next[key]] : [];
    const last = current[current.length - 1];
    const isDuplicate =
      last &&
      last.tsMs === point.tsMs &&
      last.temperatureC === point.temperatureC &&
      last.humidityPct === point.humidityPct &&
      last.pressureHpa === point.pressureHpa &&
      last.gasRaw === point.gasRaw;

    if (!isDuplicate) {
      current.push(point);
    }

    next[key] = current.slice(-maxPoints).map((item, index) => ({
      ...item,
      index,
    }));
  }

  return next;
}

export function formatSensor(value, digits = 1, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(digits)}${suffix}`;
}
