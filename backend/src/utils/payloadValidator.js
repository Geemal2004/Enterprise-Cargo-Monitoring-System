function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function validateTelemetryPayload(payload) {
  const errors = [];

  if (!isObject(payload)) {
    errors.push("Payload must be a JSON object.");
    return { valid: false, errors };
  }

  if (!isObject(payload.env)) {
    errors.push("env must be an object.");
  } else if (!isFiniteNumber(payload.env.temperatureC)) {
    errors.push("env.temperatureC must be a finite number.");
  }

  if (!isObject(payload.gas)) {
    errors.push("gas must be an object.");
  } else if (!isFiniteNumber(payload.gas.mq2Raw)) {
    errors.push("gas.mq2Raw must be a finite number.");
  }

  if (!isObject(payload.motion)) {
    errors.push("motion must be an object.");
  } else if (typeof payload.motion.shock !== "boolean") {
    errors.push("motion.shock must be a boolean.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeTelemetryPayload(topicInfo, payload) {
  const receivedAtMs = Date.now();

  return {
    tenantId: payload.tenantId || topicInfo.tenantId,
    truckId: payload.truckId || topicInfo.truckId,
    containerId: payload.containerId || topicInfo.containerId,
    topic: topicInfo.topic,
    seq: toNumberOrNull(payload.seq),
    ts: toNumberOrNull(payload.ts),
    gps: {
      lat: toNumberOrNull(payload.gps && payload.gps.lat),
      lon: toNumberOrNull(payload.gps && payload.gps.lon),
      speedKph: toNumberOrNull(payload.gps && payload.gps.speedKph),
    },
    env: {
      temperatureC: toNumberOrNull(payload.env && payload.env.temperatureC),
      humidityPct: toNumberOrNull(payload.env && payload.env.humidityPct),
      pressureHpa: toNumberOrNull(payload.env && payload.env.pressureHpa),
    },
    gas: {
      mq2Raw: toNumberOrNull(payload.gas && payload.gas.mq2Raw),
      alert: Boolean(payload.gas && payload.gas.alert),
    },
    motion: {
      tiltDeg: toNumberOrNull(payload.motion && payload.motion.tiltDeg),
      shock: Boolean(payload.motion && payload.motion.shock),
    },
    status: {
      sdOk: Boolean(payload.status && payload.status.sdOk),
      gpsFix: Boolean(payload.status && payload.status.gpsFix),
      uplink: (payload.status && payload.status.uplink) || "unknown",
    },
    raw: payload,
    receivedAt: new Date(receivedAtMs).toISOString(),
    receivedAtMs,
  };
}

module.exports = {
  validateTelemetryPayload,
  normalizeTelemetryPayload,
};
