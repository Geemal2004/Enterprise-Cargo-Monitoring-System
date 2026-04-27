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

function parseDayWindow(rawDay) {
  const dayValue = rawDay
    ? String(rawDay).trim()
    : new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayValue)) {
    throw new AppError("day must be in YYYY-MM-DD format", 400);
  }

  const fromDate = new Date(`${dayValue}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime())) {
    throw new AppError("Invalid day value", 400);
  }

  const toDate = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
  return {
    day: dayValue,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

function parseRequiredText(raw, label) {
  const value = String(raw || "").trim();
  if (!value) {
    throw new AppError(`${label} is required`, 400);
  }
  return value;
}

function summarizeAlertRows(rows) {
  const bySeverity = {};
  let count = 0;

  for (const row of rows || []) {
    const severity = String(row.severity || "UNKNOWN").toUpperCase();
    const amount = toNumber(row.count);
    bySeverity[severity] = amount;
    count += amount;
  }

  return {
    count,
    bySeverity,
  };
}

function createReportsService(deps) {
  const { reportsRepository, config, tripSummaryAiService } = deps;

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

  async function getContainerDayAiSummary(input) {
    if (!input || typeof input !== "object") {
      throw new AppError("Request body must be a JSON object", 400);
    }

    const truckCode = parseRequiredText(input.truckId, "truckId");
    const containerCode = parseRequiredText(input.containerId, "containerId");
    const cargoType = parseRequiredText(input.cargoType, "cargoType");
    const goodsDescription = input.goodsDescription
      ? String(input.goodsDescription).trim()
      : null;

    const dayWindow = parseDayWindow(input.day);
    const bucketMinutes = parsePositiveInteger(input.bucketMinutes, {
      label: "bucketMinutes",
      fallback: Number(config.ai.dailySummaryBucketMinutes || 15),
      max: 1440,
    });
    const maxPoints = parsePositiveInteger(input.maxPoints, {
      label: "maxPoints",
      fallback: Number(config.ai.dailySummaryMaxPoints || 96),
      max: 288,
    });

    const payload = await reportsRepository.getContainerDayTelemetrySummary(deps.pool, {
      tenantCode: input.tenantCode || null,
      truckCode,
      containerCode,
      from: dayWindow.from,
      to: dayWindow.to,
      bucketInterval: `${bucketMinutes} minutes`,
      maxPoints,
      managerUserId: input.managerUserId || null,
    });

    const metrics = payload.metrics || {};
    const sampleCount = Number(metrics.sample_count || 0);
    if (sampleCount <= 0) {
      throw new AppError("No telemetry found for selected truck/container/day", 404);
    }

    const alertSummary = summarizeAlertRows(payload.alertsBySeverity);
    const gpsFixRatePct = toNumber(
      sampleCount > 0 ? ((Number(metrics.gps_fix_true_count || 0) / sampleCount) * 100).toFixed(2) : null,
      null
    );

    let aiSummary = {
      provider: "rule_based",
      model: "fallback-local",
      generatedAt: new Date().toISOString(),
      summary: "AI summary is unavailable.",
    };

    if (tripSummaryAiService?.generateContainerDaySummary) {
      aiSummary = await tripSummaryAiService.generateContainerDaySummary({
        truckId: truckCode,
        containerId: containerCode,
        cargoType,
        goodsDescription,
        window: dayWindow,
        metrics,
        alertSummary,
        timeline: payload.timeline,
        maxTimelinePoints: maxPoints,
      });
    }

    return {
      truckId: truckCode,
      containerId: containerCode,
      cargoType,
      window: {
        day: dayWindow.day,
        from: dayWindow.from,
        to: dayWindow.to,
        bucketMinutes,
      },
      telemetry: {
        sampleCount,
        timelinePointsAnalyzed: Array.isArray(payload.timeline) ? payload.timeline.length : 0,
        occurredAtStart: metrics.first_point_at || null,
        occurredAtEnd: metrics.last_point_at || null,
        metrics: {
          temperature: {
            min: toNumber(metrics.temperature_min, null),
            avg: toNumber(metrics.temperature_avg, null),
            max: toNumber(metrics.temperature_max, null),
          },
          humidity: {
            min: toNumber(metrics.humidity_min, null),
            avg: toNumber(metrics.humidity_avg, null),
            max: toNumber(metrics.humidity_max, null),
          },
          pressure: {
            min: toNumber(metrics.pressure_min, null),
            avg: toNumber(metrics.pressure_avg, null),
            max: toNumber(metrics.pressure_max, null),
          },
          speed: {
            min: toNumber(metrics.speed_min, null),
            avg: toNumber(metrics.speed_avg, null),
            max: toNumber(metrics.speed_max, null),
          },
          motion: {
            shockCount: toNumber(metrics.shock_count),
            tiltMax: toNumber(metrics.tilt_max, null),
          },
          gas: {
            maxRaw: toNumber(metrics.gas_max, null),
            avgRaw: toNumber(metrics.gas_avg, null),
            gasAlertCount: toNumber(metrics.gas_alert_count),
          },
          gps: {
            fixRatePct: gpsFixRatePct,
          },
        },
        alerts: alertSummary,
      },
      aiSummary,
    };
  }

  return {
    getFleetSummaryReport,
    getAlertSummaryReport,
    getDeviceHealthSummaryReport,
    getContainerDayAiSummary,
  };
}

module.exports = {
  createReportsService,
};
