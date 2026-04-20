const { AppError } = require("../utils/appError");

function mapLatestRowToApi(row) {
  return {
    key: `${row.truck_code}::${row.container_code}`,
    tenantId: row.tenant_code,
    truckId: row.truck_code,
    containerId: row.container_code,
    fleetId: row.fleet_code,
    receivedAt: row.received_at,
    telemetry: {
      seq: row.seq,
      ts: row.source_ts,
      gps: {
        lat: row.gps_lat,
        lon: row.gps_lon,
        speedKph: row.speed_kph,
      },
      env: {
        temperatureC: row.temperature_c,
        humidityPct: row.humidity_pct,
        pressureHpa: row.pressure_hpa,
      },
      gas: {
        mq2Raw: row.gas_raw,
        alert: row.gas_alert,
      },
      motion: {
        tiltDeg: row.tilt_deg,
        shock: row.shock,
      },
      status: {
        sdOk: row.sd_ok,
        gpsFix: row.gps_fix,
        uplink: row.uplink,
      },
      raw: row.raw_payload,
    },
    activeAlerts: row.active_alerts,
    highestAlertSeverity: row.highest_alert_severity,
    isOnline: row.is_online,
  };
}

function createFleetService(deps) {
  const { config, telemetryRepository } = deps;

  async function getLatestSnapshot(tenantCode = null, managerUserId = null) {
    const rows = await telemetryRepository.getLatestSnapshot(deps.pool, {
      tenantCode,
      limit: config.query.historyMaxLimit,
      managerUserId,
    });

    const items = rows.map(mapLatestRowToApi);
    const byKey = {};
    for (const item of items) {
      byKey[item.key] = item;
    }

    return {
      count: items.length,
      byKey,
      items,
    };
  }

  async function getFleetSummary(tenantCode = null, managerUserId = null) {
    const summary = await telemetryRepository.getFleetSummary(
      deps.pool,
      config.alerts.offlineThresholdMs,
      tenantCode,
      managerUserId
    );

    return {
      totalTrucks: Number(summary.total_trucks || 0),
      onlineTrucks: Number(summary.online_trucks || 0),
      activeAlerts: Number(summary.active_alerts || 0),
      warningContainers: Number(summary.containers_in_warning || 0),
      lastUpdateTime: summary.last_update_time,
      countsBySeverity: {
        INFO: Number(summary.info_alerts || 0),
        WARNING: Number(summary.warning_alerts || 0),
        CRITICAL: Number(summary.critical_alerts || 0),
      },
    };
  }

  async function getFleetUnits(tenantCode = null, managerUserId = null) {
    const rows = await telemetryRepository.listFleetUnits(
      deps.pool,
      config.alerts.offlineThresholdMs,
      tenantCode,
      config.query.historyMaxLimit,
      managerUserId
    );

    return rows.map(mapLatestRowToApi);
  }

  async function getLatestForUnit(
    truckCode,
    containerCode,
    tenantCode = null,
    managerUserId = null
  ) {
    const row = await telemetryRepository.getLatestByCodes(deps.pool, {
      tenantCode,
      truckCode,
      containerCode,
      managerUserId,
    });

    if (!row) {
      throw new AppError("Telemetry not found for truck/container", 404);
    }

    return mapLatestRowToApi(row);
  }

  async function getHistoryForUnit(truckCode, containerCode, options) {
    const rows = await telemetryRepository.getHistoryByCodes(deps.pool, {
      tenantCode: options.tenantCode || null,
      truckCode,
      containerCode,
      from: options.from,
      to: options.to,
      limit: options.limit,
      interval: options.interval,
      managerUserId: options.managerUserId || null,
    });

    const items = rows.map((row) => {
      if (row.bucket_at) {
        return {
          ts: row.bucket_at,
          occurredAt: row.bucket_at,
          env: {
            temperatureC: row.temperature_c,
            humidityPct: row.humidity_pct,
            pressureHpa: row.pressure_hpa,
          },
          gas: {
            mq2Raw: row.gas_raw,
            alert: row.gas_alert,
          },
          motion: {
            shock: row.shock,
            tiltDeg: row.tilt_deg,
          },
          gps: {
            lat: row.gps_lat,
            lon: row.gps_lon,
            speedKph: row.speed_kph,
            gpsFix: row.gps_lost === true ? false : true,
          },
          sampleCount: row.sample_count,
        };
      }

      return {
        ts: row.occurred_at,
        occurredAt: row.occurred_at,
        env: {
          temperatureC: row.temperature_c,
          humidityPct: row.humidity_pct,
          pressureHpa: row.pressure_hpa,
        },
        gas: {
          mq2Raw: row.gas_raw,
          alert: row.gas_alert,
        },
        motion: {
          shock: row.shock,
          tiltDeg: row.tilt_deg,
        },
        gps: {
          lat: row.gps_lat,
          lon: row.gps_lon,
          speedKph: row.speed_kph,
          gpsFix: row.gps_fix,
        },
        uplink: row.uplink,
        receivedAt: row.received_at,
      };
    });

    return {
      truckId: truckCode,
      containerId: containerCode,
      count: items.length,
      bucketMinutes: options.bucketMinutes || null,
      interval: options.interval || null,
      from: options.from,
      to: options.to,
      items,
    };
  }

  return {
    getLatestSnapshot,
    getFleetSummary,
    getFleetUnits,
    getLatestForUnit,
    getHistoryForUnit,
  };
}

module.exports = {
  createFleetService,
};
