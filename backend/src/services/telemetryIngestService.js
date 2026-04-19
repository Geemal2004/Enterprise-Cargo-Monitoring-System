const { withTransaction } = require("../db/transaction");

function createTelemetryIngestService(deps) {
  const {
    pool,
    logger,
    runtimeState,
    telemetryRepository,
    assetRepository,
    alertEngineService,
    telemetryValidator,
  } = deps;

  async function handleIncomingTelemetry(topicInfo, payload) {
    const validation = telemetryValidator.validateAndNormalizeTelemetry(topicInfo, payload);

    if (!validation.valid) {
      runtimeState.markMqttMessageRejected(`invalid_payload:${validation.errors.join("|")}`);
      logger.warn("Telemetry payload rejected", {
        tenantCode: topicInfo.tenantCode,
        truckCode: topicInfo.truckCode,
        containerCode: topicInfo.containerCode,
        errors: validation.errors,
      });
      return;
    }

    const context = await assetRepository.resolveAssetContextByCodes(pool, {
      tenantCode: topicInfo.tenantCode,
      truckCode: topicInfo.truckCode,
      containerCode: topicInfo.containerCode,
    });

    if (!context) {
      runtimeState.markMqttMessageRejected("unknown_asset_reference");
      logger.warn("Telemetry rejected due to unknown tenant/truck/container mapping", {
        tenantCode: topicInfo.tenantCode,
        truckCode: topicInfo.truckCode,
        containerCode: topicInfo.containerCode,
      });
      return;
    }

    const receivedAt = new Date().toISOString();
    const normalized = validation.normalized;

    const telemetry = {
      tenantId: context.tenant_id,
      fleetId: context.fleet_id,
      truckId: context.truck_id,
      containerId: context.container_id,
      tripId: context.trip_id,
      gatewayDeviceId: null,
      sensorDeviceId: null,
      mqttTopic: topicInfo.topic,
      seq: normalized.seq,
      sourceTs: normalized.sourceTs,
      receivedAt,
      gpsLat: normalized.gpsLat,
      gpsLon: normalized.gpsLon,
      speedKph: normalized.speedKph,
      temperatureC: normalized.temperatureC,
      humidityPct: normalized.humidityPct,
      pressureHpa: normalized.pressureHpa,
      tiltDeg: normalized.tiltDeg,
      shock: normalized.shock,
      gasRaw: normalized.gasRaw,
      gasAlert: normalized.gasAlert,
      sdOk: normalized.sdOk,
      gpsFix: normalized.gpsFix,
      uplink: normalized.uplink,
      rawPayload: normalized.rawPayload,
    };

    await withTransaction(pool, async (client) => {
      await telemetryRepository.insertTelemetryHistory(client, telemetry);
      await telemetryRepository.upsertTelemetryLatest(client, telemetry);
      await alertEngineService.evaluateTelemetryInTransaction(client, {
        tenantId: context.tenant_id,
        fleetId: context.fleet_id,
        truckId: context.truck_id,
        containerId: context.container_id,
        tripId: context.trip_id,
      }, telemetry);
    });

    runtimeState.markMqttMessageAccepted();
  }

  return {
    handleIncomingTelemetry,
  };
}

module.exports = {
  createTelemetryIngestService,
};
