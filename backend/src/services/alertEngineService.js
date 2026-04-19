function createAlertEngineService(deps) {
  const {
    config,
    alertsRepository,
    alertRulesRepository,
  } = deps;

  function defaultsForType(type) {
    const base = {
      HIGH_TEMPERATURE: {
        severity: "WARNING",
        thresholdNumeric: config.alerts.highTemperatureThresholdC,
      },
      GAS_SPIKE: {
        severity: "WARNING",
        thresholdNumeric: config.alerts.gasSpikeThresholdRaw,
      },
      SHOCK_DETECTED: {
        severity: "CRITICAL",
        thresholdNumeric: null,
      },
      OFFLINE: {
        severity: "CRITICAL",
        thresholdNumeric: config.alerts.offlineThresholdMs,
      },
      GPS_LOST: {
        severity: "WARNING",
        thresholdNumeric: null,
      },
    };

    return base[type];
  }

  function resolveThresholdRule(ruleMap, alertType) {
    const fallback = defaultsForType(alertType);
    const dbRule = ruleMap.get(alertType);

    if (!dbRule) {
      return {
        ruleId: null,
        severity: fallback.severity,
        thresholdNumeric: fallback.thresholdNumeric,
      };
    }

    return {
      ruleId: dbRule.id,
      severity: dbRule.severity || fallback.severity,
      thresholdNumeric:
        dbRule.threshold_numeric !== null && dbRule.threshold_numeric !== undefined
          ? Number(dbRule.threshold_numeric)
          : fallback.thresholdNumeric,
    };
  }

  async function applyAlertState(client, payload) {
    const {
      tenantId,
      fleetId,
      truckId,
      containerId,
      tripId,
      alertType,
      shouldBeOpen,
      severity,
      title,
      message,
      latestValueNumeric,
      latestValueBoolean,
      thresholdValueNumeric,
      metadata,
      alertRuleId,
      actorUserId,
      canAutoResolve = true,
    } = payload;

    const existing = await alertsRepository.findActiveAlertForUpdate(client, {
      tenantId,
      truckId,
      containerId,
      alertType,
    });

    if (shouldBeOpen) {
      if (!existing) {
        const created = await alertsRepository.createAlert(client, {
          tenantId,
          fleetId,
          truckId,
          containerId,
          tripId,
          alertRuleId,
          alertType,
          severity,
          title,
          message,
          latestValueNumeric,
          latestValueBoolean,
          thresholdValueNumeric,
          metadata,
        });

        await alertsRepository.insertAlertEvent(client, {
          tenantId,
          alertId: created.id,
          eventType: "OPENED",
          fromStatus: null,
          toStatus: "OPEN",
          actorUserId,
          message,
          metadata,
        });
        return created;
      }

      const updated = await alertsRepository.updateActiveAlert(client, {
        alertId: existing.id,
        severity,
        title,
        message,
        latestValueNumeric,
        latestValueBoolean,
        thresholdValueNumeric,
        metadata,
      });

      return updated;
    }

    if (!existing || !canAutoResolve) {
      return existing;
    }

    const resolved = await alertsRepository.resolveAlert(client, {
      alertId: existing.id,
      message,
      metadata,
    });

    await alertsRepository.insertAlertEvent(client, {
      tenantId,
      alertId: existing.id,
      eventType: "RESOLVED",
      fromStatus: existing.status,
      toStatus: "RESOLVED",
      actorUserId,
      message,
      metadata,
    });

    return resolved;
  }

  async function evaluateTelemetryInTransaction(client, context, telemetry) {
    const rules = await alertRulesRepository.getAlertRuleMap(
      client,
      context.tenantId,
      context.fleetId
    );

    const highTempRule = resolveThresholdRule(rules, "HIGH_TEMPERATURE");
    const gasRule = resolveThresholdRule(rules, "GAS_SPIKE");
    const shockRule = resolveThresholdRule(rules, "SHOCK_DETECTED");
    const gpsRule = resolveThresholdRule(rules, "GPS_LOST");

    const evaluations = [
      {
        alertType: "HIGH_TEMPERATURE",
        title: "High temperature detected",
        shouldBeOpen:
          telemetry.temperatureC !== null &&
          telemetry.temperatureC > Number(highTempRule.thresholdNumeric),
        severity: highTempRule.severity,
        latestValueNumeric: telemetry.temperatureC,
        latestValueBoolean: null,
        thresholdValueNumeric: highTempRule.thresholdNumeric,
        message:
          telemetry.temperatureC !== null
            ? `Temperature ${telemetry.temperatureC}C exceeds threshold ${highTempRule.thresholdNumeric}C`
            : "Temperature threshold exceeded",
        alertRuleId: highTempRule.ruleId,
      },
      {
        alertType: "GAS_SPIKE",
        title: "Gas spike detected",
        shouldBeOpen:
          telemetry.gasRaw !== null && telemetry.gasRaw > Number(gasRule.thresholdNumeric),
        severity: gasRule.severity,
        latestValueNumeric: telemetry.gasRaw,
        latestValueBoolean: null,
        thresholdValueNumeric: gasRule.thresholdNumeric,
        message:
          telemetry.gasRaw !== null
            ? `Gas sensor value ${telemetry.gasRaw} exceeds threshold ${gasRule.thresholdNumeric}`
            : "Gas threshold exceeded",
        alertRuleId: gasRule.ruleId,
      },
      {
        alertType: "SHOCK_DETECTED",
        title: "Shock detected",
        shouldBeOpen: telemetry.shock === true,
        severity: shockRule.severity,
        latestValueNumeric: null,
        latestValueBoolean: telemetry.shock,
        thresholdValueNumeric: shockRule.thresholdNumeric,
        message: telemetry.shock
          ? "Shock event reported by sensor"
          : "Shock condition cleared",
        alertRuleId: shockRule.ruleId,
        canAutoResolve: config.alerts.autoResolveShock,
      },
      {
        alertType: "GPS_LOST",
        title: "GPS signal lost",
        shouldBeOpen: telemetry.gpsFix === false,
        severity: gpsRule.severity,
        latestValueNumeric: null,
        latestValueBoolean: telemetry.gpsFix,
        thresholdValueNumeric: gpsRule.thresholdNumeric,
        message:
          telemetry.gpsFix === false
            ? "GPS fix is unavailable"
            : "GPS fix restored",
        alertRuleId: gpsRule.ruleId,
      },
      {
        alertType: "OFFLINE",
        title: "Unit offline",
        shouldBeOpen: false,
        severity: defaultsForType("OFFLINE").severity,
        latestValueNumeric: 0,
        latestValueBoolean: null,
        thresholdValueNumeric: config.alerts.offlineThresholdMs,
        message: "Telemetry resumed",
        alertRuleId: null,
      },
    ];

    for (const evaluation of evaluations) {
      await applyAlertState(client, {
        tenantId: context.tenantId,
        fleetId: context.fleetId,
        truckId: context.truckId,
        containerId: context.containerId,
        tripId: context.tripId,
        alertType: evaluation.alertType,
        shouldBeOpen: evaluation.shouldBeOpen,
        severity: evaluation.severity,
        title: evaluation.title,
        message: evaluation.message,
        latestValueNumeric: evaluation.latestValueNumeric,
        latestValueBoolean: evaluation.latestValueBoolean,
        thresholdValueNumeric: evaluation.thresholdValueNumeric,
        metadata: {
          telemetrySourceTs: telemetry.sourceTs,
          receivedAt: telemetry.receivedAt,
          mqttTopic: telemetry.mqttTopic,
        },
        alertRuleId: evaluation.alertRuleId,
        actorUserId: null,
        canAutoResolve:
          evaluation.canAutoResolve === undefined
            ? true
            : evaluation.canAutoResolve,
      });
    }
  }

  async function evaluateOfflineCandidateInTransaction(client, candidate) {
    const rules = await alertRulesRepository.getAlertRuleMap(
      client,
      candidate.tenant_id,
      candidate.fleet_id
    );
    const offlineRule = resolveThresholdRule(rules, "OFFLINE");

    const staleMs = Math.max(
      0,
      Math.floor(Date.now() - new Date(candidate.received_at).getTime())
    );

    await applyAlertState(client, {
      tenantId: candidate.tenant_id,
      fleetId: candidate.fleet_id,
      truckId: candidate.truck_id,
      containerId: candidate.container_id,
      tripId: candidate.trip_id,
      alertType: "OFFLINE",
      shouldBeOpen: true,
      severity: offlineRule.severity,
      title: "Unit offline",
      message: `No telemetry for ${staleMs} ms`,
      latestValueNumeric: staleMs,
      latestValueBoolean: null,
      thresholdValueNumeric: offlineRule.thresholdNumeric,
      metadata: {
        lastReceivedAt: candidate.received_at,
        mqttTopic: candidate.mqtt_topic,
      },
      alertRuleId: offlineRule.ruleId,
      actorUserId: null,
    });
  }

  return {
    evaluateTelemetryInTransaction,
    evaluateOfflineCandidateInTransaction,
  };
}

module.exports = {
  createAlertEngineService,
};
