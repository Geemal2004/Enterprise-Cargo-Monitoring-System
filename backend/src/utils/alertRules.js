function evaluateAlerts(telemetryEntry, nowMs, offlineThresholdMs) {
  const alerts = [];

  if (telemetryEntry.env && telemetryEntry.env.temperatureC > 35) {
    alerts.push({
      code: "TEMPERATURE_HIGH",
      severity: "high",
      message: "Temperature above 35C",
      value: telemetryEntry.env.temperatureC,
      threshold: 35,
    });
  }

  if (telemetryEntry.gas && telemetryEntry.gas.mq2Raw > 1500) {
    alerts.push({
      code: "GAS_HIGH",
      severity: "high",
      message: "MQ2 gas level above 1500",
      value: telemetryEntry.gas.mq2Raw,
      threshold: 1500,
    });
  }

  if (telemetryEntry.motion && telemetryEntry.motion.shock === true) {
    alerts.push({
      code: "SHOCK_DETECTED",
      severity: "medium",
      message: "Shock detected",
      value: true,
      threshold: true,
    });
  }

  if (nowMs - telemetryEntry.receivedAtMs > offlineThresholdMs) {
    alerts.push({
      code: "OFFLINE",
      severity: "critical",
      message: "No telemetry update for more than 30 seconds",
      value: nowMs - telemetryEntry.receivedAtMs,
      threshold: offlineThresholdMs,
    });
  }

  return alerts;
}

module.exports = {
  evaluateAlerts,
};
