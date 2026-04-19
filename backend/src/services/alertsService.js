const { withTransaction } = require("../db/transaction");
const { AppError } = require("../utils/appError");
const { parseDateInput } = require("../utils/time");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeCsvValues(raw, fallback = null) {
  if (!raw) {
    return fallback;
  }

  const values = String(raw)
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return values.length ? values : fallback;
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

function parseDateRange(fromRaw, toRaw) {
  const fromDate = parseDateInput(fromRaw);
  const toDate = parseDateInput(toRaw);

  if (fromRaw && !fromDate) {
    throw new AppError("Invalid 'from' timestamp", 400);
  }
  if (toRaw && !toDate) {
    throw new AppError("Invalid 'to' timestamp", 400);
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new AppError("'from' must be earlier than or equal to 'to'", 400);
  }

  return {
    from: fromDate ? fromDate.toISOString() : null,
    to: toDate ? toDate.toISOString() : null,
  };
}

function parseLimit(raw, defaults) {
  const requested = Number(raw || defaults.fallback);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new AppError("limit must be a positive number", 400);
  }

  return Math.min(Math.floor(requested), defaults.max);
}

function createAlertsService(deps) {
  const { alertsRepository, config } = deps;
  const maxHistoryLimit = config?.query?.historyMaxLimit || 2000;
  const defaultHistoryLimit = config?.query?.historyDefaultLimit || 240;

  async function listAlerts(query) {
    const statuses = query.status
      ? normalizeCsvValues(query.status)
      : ["OPEN", "ACKNOWLEDGED"];

    const rows = await alertsRepository.listAlerts(deps.pool, {
      tenantCode: query.tenantCode || null,
      statuses,
      severities: normalizeCsvValues(query.severity),
      limit: parseLimit(query.limit, {
        fallback: defaultHistoryLimit,
        max: maxHistoryLimit,
      }),
    });

    const items = rows.map((row) => ({
      key: `${row.truck_code}::${row.container_code}`,
      truckId: row.truck_code,
      containerId: row.container_code,
      tenantId: row.tenant_code,
      receivedAt: row.last_event_at,
      alert: {
        code: row.alert_type,
        severity: row.severity,
        message: row.message,
        value:
          row.latest_value_numeric !== null
            ? row.latest_value_numeric
            : row.latest_value_boolean,
      },
      id: row.id,
      fleetId: row.fleet_code,
      alertType: row.alert_type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      message: row.message,
      openedAt: row.opened_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      lastEventAt: row.last_event_at,
      latestValueNumeric: row.latest_value_numeric,
      latestValueBoolean: row.latest_value_boolean,
      thresholdValueNumeric: row.threshold_value_numeric,
      metadata: row.metadata_json,
    }));

    return {
      count: items.length,
      items,
    };
  }

  async function listAlertHistory(query) {
    const statuses = normalizeCsvValues(query.status);
    const severities = normalizeCsvValues(query.severity);
    const { from, to } = parseDateRange(query.from, query.to);
    const tenantId = parseTenantId(query.tenantId);
    const rows = await alertsRepository.listAlertHistory(deps.pool, {
      tenantCode: query.tenantCode || null,
      tenantId,
      statuses,
      severities,
      truckCode: query.truckId ? String(query.truckId).trim() : null,
      containerCode: query.containerId ? String(query.containerId).trim() : null,
      from,
      to,
      limit: parseLimit(query.limit, {
        fallback: defaultHistoryLimit,
        max: maxHistoryLimit,
      }),
    });

    const items = rows.map((row) => ({
      key: `${row.truck_code}::${row.container_code}`,
      id: row.id,
      tenantId: row.tenant_id,
      tenantCode: row.tenant_code,
      fleetId: row.fleet_code,
      truckId: row.truck_code,
      containerId: row.container_code,
      alertType: row.alert_type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      message: row.message,
      openedAt: row.opened_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      lastEventAt: row.last_event_at,
      latestValueNumeric: row.latest_value_numeric,
      latestValueBoolean: row.latest_value_boolean,
      thresholdValueNumeric: row.threshold_value_numeric,
      metadata: row.metadata_json,
    }));

    return {
      count: items.length,
      filters: {
        status: statuses,
        severity: severities,
        tenantId,
        truckId: query.truckId || null,
        containerId: query.containerId || null,
        from,
        to,
      },
      items,
    };
  }

  async function getAlertEvents(alertId, query, tenantCode) {
    const tenantId = parseTenantId(query.tenantId);
    const limit = parseLimit(query.limit, {
      fallback: 300,
      max: maxHistoryLimit,
    });

    const rows = await alertsRepository.getAlertEvents(
      deps.pool,
      {
        alertId,
        limit,
        tenantCode,
        tenantId,
      }
    );

    return {
      count: rows.length,
      alertId,
      items: rows.map((row) => ({
        id: row.id,
        alertId: row.alert_id,
        tenantCode: row.tenant_code,
        eventType: row.event_type,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        actorUserId: row.actor_user_id,
        actorEmail: row.actor_email,
        actorName: row.actor_name,
        eventAt: row.event_at,
        message: row.message,
        metadata: row.metadata_json,
      })),
    };
  }

  async function transitionAlert(alertId, action, options = {}) {
    const normalizedAction = String(action || "").trim().toUpperCase();
    if (!["ACKNOWLEDGE", "RESOLVE"].includes(normalizedAction)) {
      throw new AppError("action must be ACKNOWLEDGE or RESOLVE", 400);
    }

    return withTransaction(deps.pool, async (client) => {
      const current = await alertsRepository.findAlertByIdForUpdate(client, alertId);
      if (!current) {
        throw new AppError("Alert not found", 404);
      }

      if (current.status === "RESOLVED" && normalizedAction === "ACKNOWLEDGE") {
        throw new AppError("Resolved alerts cannot be acknowledged", 409);
      }

      if (current.status === "RESOLVED" && normalizedAction === "RESOLVE") {
        return current;
      }

      const metadata = {
        source: "manual_transition",
        requestedAction: normalizedAction,
      };

      let updated;
      if (normalizedAction === "ACKNOWLEDGE") {
        updated = await alertsRepository.acknowledgeAlert(client, {
          alertId,
          message: options.message,
          metadata,
        });

        await alertsRepository.insertAlertEvent(client, {
          tenantId: current.tenant_id,
          alertId,
          eventType: "ACKNOWLEDGED",
          fromStatus: current.status,
          toStatus: "ACKNOWLEDGED",
          actorUserId: options.actorUserId || null,
          message: options.message || "Alert acknowledged",
          metadata,
        });
      } else {
        updated = await alertsRepository.resolveAlert(client, {
          alertId,
          message: options.message,
          metadata,
        });

        await alertsRepository.insertAlertEvent(client, {
          tenantId: current.tenant_id,
          alertId,
          eventType: "RESOLVED",
          fromStatus: current.status,
          toStatus: "RESOLVED",
          actorUserId: options.actorUserId || null,
          message: options.message || "Alert resolved",
          metadata,
        });
      }

      return updated;
    });
  }

  return {
    listAlerts,
    listAlertHistory,
    getAlertEvents,
    transitionAlert,
  };
}

module.exports = {
  createAlertsService,
};
