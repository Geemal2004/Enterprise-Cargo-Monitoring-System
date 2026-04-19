const { AppError } = require("../utils/appError");
const { parseDateInput } = require("../utils/time");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALERT_STATUSES = new Set(["OPEN", "ACKNOWLEDGED", "RESOLVED"]);
const ALERT_SEVERITIES = new Set(["INFO", "WARNING", "CRITICAL"]);

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTenantId(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const value = String(raw).trim();
  if (!UUID_PATTERN.test(value)) {
    throw new AppError("tenantId must be a valid UUID", 400);
  }

  return value;
}

function parseWindow(query, defaults = {}) {
  const defaultHours = defaults.defaultHours || 24;
  const now = new Date();
  const fallbackFrom = new Date(now.getTime() - defaultHours * 60 * 60 * 1000);

  const fromDate = query.from ? parseDateInput(query.from) : fallbackFrom;
  const toDate = query.to ? parseDateInput(query.to) : now;

  if (query.from && !fromDate) {
    throw new AppError("Invalid 'from' timestamp", 400);
  }
  if (query.to && !toDate) {
    throw new AppError("Invalid 'to' timestamp", 400);
  }
  if (fromDate > toDate) {
    throw new AppError("'from' must be earlier than or equal to 'to'", 400);
  }

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

function parsePositiveInteger(raw, options) {
  const fallback = options.fallback;
  const max = options.max;

  const parsed = raw === undefined || raw === null || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`${options.label} must be a positive number`, 400);
  }

  return Math.min(Math.floor(parsed), max);
}

function parseEnumCsv(raw, allowedSet, label) {
  if (!raw) {
    return null;
  }

  const values = String(raw)
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!values.length) {
    return null;
  }

  const invalid = values.filter((value) => !allowedSet.has(value));
  if (invalid.length > 0) {
    throw new AppError(`${label} contains invalid values: ${invalid.join(", ")}`, 400);
  }

  return values;
}

function createReportsService(deps) {
  const { reportsRepository, config } = deps;

  async function getFleetSummaryReport(query) {
    const window = parseWindow(query, { defaultHours: 24 });
    const tenantId = parseTenantId(query.tenantId);
    const bucketMinutes = parsePositiveInteger(query.bucketMinutes, {
      label: "bucketMinutes",
      fallback: 60,
      max: 1440,
    });

    const payload = await reportsRepository.getFleetSummaryReport(deps.pool, {
      tenantCode: query.tenantCode || null,
      tenantId,
      from: window.from,
      to: window.to,
      bucketInterval: `${bucketMinutes} minutes`,
      offlineThresholdMs: config.alerts.offlineThresholdMs,
    });

    const summary = payload.summary || {};
    return {
      window: {
        from: window.from,
        to: window.to,
        bucketMinutes,
      },
      overview: {
        telemetryPoints: toNumber(summary.telemetry_points),
        activeUnitsInWindow: toNumber(summary.active_units_in_window),
        onlineUnitsCurrent: toNumber(summary.online_units_current),
        offlineUnitsCurrent: toNumber(summary.offline_units_current),
        gasAlertSamples: toNumber(summary.gas_alert_samples),
        shockSamples: toNumber(summary.shock_samples),
        firstPointAt: summary.first_point_at || null,
        lastPointAt: summary.last_point_at || null,
        latestTelemetryAt: summary.latest_received_at || null,
      },
      metrics: {
        avgTemperatureC: toNumber(summary.avg_temperature_c, null),
        maxTemperatureC: toNumber(summary.max_temperature_c, null),
        avgHumidityPct: toNumber(summary.avg_humidity_pct, null),
        avgSpeedKph: toNumber(summary.avg_speed_kph, null),
      },
      trend: payload.trend.map((row) => ({
        bucketAt: row.bucket_at,
        sampleCount: toNumber(row.sample_count),
        avgTemperatureC: toNumber(row.avg_temperature_c, null),
        maxTemperatureC: toNumber(row.max_temperature_c, null),
        avgHumidityPct: toNumber(row.avg_humidity_pct, null),
        avgSpeedKph: toNumber(row.avg_speed_kph, null),
      })),
    };
  }

  async function getAlertSummaryReport(query) {
    const window = parseWindow(query, { defaultHours: 24 });
    const tenantId = parseTenantId(query.tenantId);
    const bucketMinutes = parsePositiveInteger(query.bucketMinutes, {
      label: "bucketMinutes",
      fallback: 60,
      max: 1440,
    });

    const statuses = parseEnumCsv(query.status, ALERT_STATUSES, "status");
    const severities = parseEnumCsv(query.severity, ALERT_SEVERITIES, "severity");

    const payload = await reportsRepository.getAlertSummaryReport(deps.pool, {
      tenantCode: query.tenantCode || null,
      tenantId,
      truckCode: query.truckId ? String(query.truckId).trim() : null,
      containerCode: query.containerId ? String(query.containerId).trim() : null,
      from: window.from,
      to: window.to,
      statuses,
      severities,
      bucketInterval: `${bucketMinutes} minutes`,
    });

    const summary = payload.summary || {};

    return {
      window: {
        from: window.from,
        to: window.to,
        bucketMinutes,
      },
      filters: {
        status: statuses,
        severity: severities,
        tenantId,
        truckId: query.truckId || null,
        containerId: query.containerId || null,
      },
      overview: {
        totalAlerts: toNumber(summary.total_alerts),
        openAlerts: toNumber(summary.open_alerts),
        acknowledgedAlerts: toNumber(summary.acknowledged_alerts),
        resolvedAlerts: toNumber(summary.resolved_alerts),
        criticalAlerts: toNumber(summary.critical_alerts),
        warningAlerts: toNumber(summary.warning_alerts),
        infoAlerts: toNumber(summary.info_alerts),
        impactedUnits: toNumber(summary.impacted_units),
        lastAlertAt: summary.last_alert_at || null,
      },
      bySeverity: payload.bySeverity.map((row) => ({
        severity: row.severity,
        count: toNumber(row.count),
      })),
      byStatus: payload.byStatus.map((row) => ({
        status: row.status,
        count: toNumber(row.count),
      })),
      byAlertType: payload.byType.map((row) => ({
        alertType: row.alert_type,
        count: toNumber(row.count),
      })),
      timeline: payload.timeline.map((row) => ({
        bucketAt: row.bucket_at,
        count: toNumber(row.count),
        criticalCount: toNumber(row.critical_count),
        warningCount: toNumber(row.warning_count),
        infoCount: toNumber(row.info_count),
      })),
      topContainers: payload.topContainers.map((row) => ({
        truckId: row.truck_code,
        containerId: row.container_code,
        alertCount: toNumber(row.alert_count),
        lastAlertAt: row.last_alert_at,
      })),
    };
  }

  async function getDeviceHealthSummaryReport(query) {
    const tenantId = parseTenantId(query.tenantId);
    const offlineMinutes = parsePositiveInteger(query.offlineMinutes, {
      label: "offlineMinutes",
      fallback: 15,
      max: 1440,
    });
    const limit = parsePositiveInteger(query.limit, {
      label: "limit",
      fallback: 50,
      max: 200,
    });

    const payload = await reportsRepository.getDeviceHealthSummaryReport(deps.pool, {
      tenantCode: query.tenantCode || null,
      tenantId,
      offlineThresholdMs: offlineMinutes * 60 * 1000,
      limit,
    });

    const summary = payload.summary || {};
    return {
      generatedAt: new Date().toISOString(),
      offlineThresholdMinutes: offlineMinutes,
      overview: {
        trackedUnits: toNumber(summary.tracked_units),
        onlineUnits: toNumber(summary.online_units),
        offlineUnits: toNumber(summary.offline_units),
        activeDevices: toNumber(summary.active_devices),
        staleDevices: toNumber(summary.stale_devices),
        latestTelemetryAt: summary.latest_telemetry_at || null,
      },
      devicesByType: {
        sensorNodes: toNumber(summary.active_sensor_devices),
        gatewayNodes: toNumber(summary.active_gateway_devices),
      },
      offlineUnits: payload.offlineUnits.map((row) => ({
        tenantCode: row.tenant_code,
        truckId: row.truck_code,
        containerId: row.container_code,
        lastTelemetryAt: row.received_at,
        minutesSinceLastTelemetry: toNumber(row.minutes_since_last_telemetry, null),
      })),
    };
  }

  return {
    getFleetSummaryReport,
    getAlertSummaryReport,
    getDeviceHealthSummaryReport,
  };
}

module.exports = {
  createReportsService,
};
