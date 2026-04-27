function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableBoolean(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(lower)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(lower)) {
      return false;
    }
  }
  return null;
}

function normalizeTimestamp(payload) {
  const raw =
    payload.sourceTs ||
    payload.timestamp ||
    payload.ts ||
    payload.time ||
    payload.occurredAt ||
    null;

  if (raw === null) {
    return new Date();
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) {
    const millis = asNumber > 1e12 ? asNumber : asNumber * 1000;
    const fromMillis = new Date(millis);
    if (!Number.isNaN(fromMillis.getTime())) {
      return fromMillis;
    }
  }

  return new Date();
}

function validateAndNormalizeTelemetry(topicInfo, payload) {
  const errors = [];

  if (!isObject(payload)) {
    return {
      valid: false,
      errors: ["Payload must be a JSON object"],
      normalized: null,
    };
  }

  const env = isObject(payload.env) ? payload.env : {};
  const gas = isObject(payload.gas) ? payload.gas : {};
  const motion = isObject(payload.motion) ? payload.motion : {};

  const gpsCandidate = isObject(payload.gps)
    ? payload.gps
    : isObject(payload.location)
      ? payload.location
      : {};

  const statusCandidate = isObject(payload.status)
    ? payload.status
    : isObject(payload.system)
      ? payload.system
      : {};

  const temperatureC = toNullableNumber(env.temperatureC);
  const gasRaw = toNullableNumber(gas.mq2Raw);
  const smokePpm = toNullableNumber(gas.smokePpm);
  const shock = toNullableBoolean(motion.shock);

  if (temperatureC === null) {
    errors.push("env.temperatureC must be a number");
  }
  if (gasRaw === null) {
    errors.push("gas.mq2Raw must be a number");
  }
  if (shock === null) {
    errors.push("motion.shock must be a boolean");
  }

  if (payload.truckId && String(payload.truckId) !== String(topicInfo.truckCode)) {
    errors.push("Payload truckId does not match topic truck segment");
  }

  if (
    payload.containerId &&
    String(payload.containerId) !== String(topicInfo.containerCode)
  ) {
    errors.push("Payload containerId does not match topic container segment");
  }

  const normalized = {
    seq: Math.max(0, Math.trunc(toNullableNumber(payload.seq) || 0)),
    sourceTs: normalizeTimestamp(payload).toISOString(),
    gpsLat: toNullableNumber(gpsCandidate.lat),
    gpsLon: toNullableNumber(gpsCandidate.lon),
    speedKph: toNullableNumber(gpsCandidate.speedKph),
    temperatureC,
    humidityPct: toNullableNumber(env.humidityPct),
    pressureHpa: toNullableNumber(env.pressureHpa),
    tiltDeg: toNullableNumber(motion.tiltDeg),
    shock: Boolean(shock),
    gasRaw,
    smokePpm,
    gasAlert: Boolean(toNullableBoolean(gas.alert)),
    sdOk: toNullableBoolean(statusCandidate.sdOk),
    gpsFix:
      toNullableBoolean(statusCandidate.gpsFix) ??
      toNullableBoolean(gpsCandidate.gpsFix) ??
      toNullableBoolean(payload.gpsFix),
    uplink: statusCandidate.uplink ? String(statusCandidate.uplink) : "unknown",
    rawPayload: payload,
  };

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

module.exports = {
  validateAndNormalizeTelemetry,
};
