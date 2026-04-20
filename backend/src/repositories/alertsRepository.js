async function findActiveAlertForUpdate(client, scope) {
  const { tenantId, truckId, containerId, alertType } = scope;

  const result = await client.query(
    `
      SELECT *
      FROM alerts
      WHERE tenant_id = $1
        AND truck_id = $2
        AND container_id = $3
        AND alert_type = $4
        AND status IN ('OPEN', 'ACKNOWLEDGED')
      ORDER BY opened_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [tenantId, truckId, containerId, alertType]
  );

  return result.rows[0] || null;
}

async function findAlertByIdForUpdate(client, alertId) {
  const result = await client.query(
    `
      SELECT *
      FROM alerts
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [alertId]
  );

  return result.rows[0] || null;
}

async function createAlert(client, payload) {
  const result = await client.query(
    `
      INSERT INTO alerts (
        tenant_id,
        fleet_id,
        truck_id,
        container_id,
        trip_id,
        alert_rule_id,
        alert_type,
        severity,
        status,
        title,
        message,
        latest_value_numeric,
        latest_value_boolean,
        threshold_value_numeric,
        metadata_json
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, 'OPEN', $9, $10,
        $11, $12, $13, $14
      )
      RETURNING *
    `,
    [
      payload.tenantId,
      payload.fleetId,
      payload.truckId,
      payload.containerId,
      payload.tripId,
      payload.alertRuleId,
      payload.alertType,
      payload.severity,
      payload.title,
      payload.message,
      payload.latestValueNumeric,
      payload.latestValueBoolean,
      payload.thresholdValueNumeric,
      JSON.stringify(payload.metadata || {}),
    ]
  );

  return result.rows[0];
}

async function updateActiveAlert(client, payload) {
  const result = await client.query(
    `
      UPDATE alerts
      SET
        severity = $2,
        title = $3,
        message = $4,
        latest_value_numeric = $5,
        latest_value_boolean = $6,
        threshold_value_numeric = $7,
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $8::jsonb,
        last_event_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      payload.alertId,
      payload.severity,
      payload.title,
      payload.message,
      payload.latestValueNumeric,
      payload.latestValueBoolean,
      payload.thresholdValueNumeric,
      JSON.stringify(payload.metadata || {}),
    ]
  );

  return result.rows[0] || null;
}

async function resolveAlert(client, payload) {
  const result = await client.query(
    `
      UPDATE alerts
      SET
        status = 'RESOLVED',
        resolved_at = NOW(),
        message = COALESCE($2, message),
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb,
        last_event_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [payload.alertId, payload.message || null, JSON.stringify(payload.metadata || {})]
  );

  return result.rows[0] || null;
}

async function acknowledgeAlert(client, payload) {
  const result = await client.query(
    `
      UPDATE alerts
      SET
        status = 'ACKNOWLEDGED',
        acknowledged_at = COALESCE(acknowledged_at, NOW()),
        message = COALESCE($2, message),
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb,
        last_event_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [payload.alertId, payload.message || null, JSON.stringify(payload.metadata || {})]
  );

  return result.rows[0] || null;
}

async function insertAlertEvent(client, payload) {
  const result = await client.query(
    `
      INSERT INTO alert_events (
        tenant_id,
        alert_id,
        event_type,
        from_status,
        to_status,
        actor_user_id,
        event_at,
        message,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
      RETURNING *
    `,
    [
      payload.tenantId,
      payload.alertId,
      payload.eventType,
      payload.fromStatus || null,
      payload.toStatus,
      payload.actorUserId || null,
      payload.message || null,
      JSON.stringify(payload.metadata || {}),
    ]
  );

  return result.rows[0];
}

async function listAlerts(pool, filters = {}) {
  const tenantCode = filters.tenantCode || null;
  const statuses = filters.statuses && filters.statuses.length ? filters.statuses : null;
  const severities =
    filters.severities && filters.severities.length ? filters.severities : null;
  const limit = filters.limit || 500;

  const result = await pool.query(
    `
      SELECT
        a.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      LEFT JOIN fleets f
        ON f.id = a.fleet_id
       AND f.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::alert_status_enum[] IS NULL OR a.status = ANY($2))
        AND ($3::alert_severity_enum[] IS NULL OR a.severity = ANY($3))
      ORDER BY a.last_event_at DESC
      LIMIT $4
    `,
    [tenantCode, statuses, severities, limit]
  );

  return result.rows;
}

async function getAlertSummaryByTrip(pool, input) {
  const result = await pool.query(
    `
      SELECT severity, COUNT(*)::int AS count
      FROM alerts
      WHERE tenant_id = $1
        AND trip_id = $2
      GROUP BY severity
    `,
    [input.tenantId, input.tripId]
  );

  const bySeverity = {};
  let total = 0;

  for (const row of result.rows) {
    bySeverity[row.severity] = row.count;
    total += row.count;
  }

  return { count: total, bySeverity };
}

async function listAlertHistory(pool, filters = {}) {
  const tenantCode = filters.tenantCode || null;
  const tenantId = filters.tenantId || null;
  const statuses = filters.statuses && filters.statuses.length ? filters.statuses : null;
  const severities =
    filters.severities && filters.severities.length ? filters.severities : null;
  const truckCode = filters.truckCode || null;
  const containerCode = filters.containerCode || null;
  const from = filters.from || null;
  const to = filters.to || null;
  const limit = filters.limit || 300;

  const result = await pool.query(
    `
      SELECT
        a.*, 
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      LEFT JOIN fleets f
        ON f.id = a.fleet_id
       AND f.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR a.tenant_id = $2)
        AND ($3::alert_status_enum[] IS NULL OR a.status = ANY($3))
        AND ($4::alert_severity_enum[] IS NULL OR a.severity = ANY($4))
        AND ($5::text IS NULL OR tr.truck_code = $5)
        AND ($6::text IS NULL OR c.container_code = $6)
        AND ($7::timestamptz IS NULL OR a.last_event_at >= $7)
        AND ($8::timestamptz IS NULL OR a.last_event_at <= $8)
      ORDER BY a.last_event_at DESC
      LIMIT $9
    `,
    [
      tenantCode,
      tenantId,
      statuses,
      severities,
      truckCode,
      containerCode,
      from,
      to,
      limit,
    ]
  );

  return result.rows;
}

async function getAlertEvents(pool, options) {
  const {
    alertId,
    limit = 300,
    tenantCode = null,
    tenantId = null,
  } = options;

  const result = await pool.query(
    `
      SELECT
        ae.*,
        t.tenant_code,
        u.email AS actor_email,
        u.full_name AS actor_name
      FROM alert_events ae
      JOIN alerts a
        ON a.id = ae.alert_id
       AND a.tenant_id = ae.tenant_id
      JOIN tenants t
        ON t.id = ae.tenant_id
      LEFT JOIN users u
        ON u.id = ae.actor_user_id
      WHERE ae.alert_id = $1
        AND ($2::text IS NULL OR t.tenant_code = $2)
        AND ($3::uuid IS NULL OR ae.tenant_id = $3)
      ORDER BY ae.event_at DESC
      LIMIT $4
    `,
    [alertId, tenantCode, tenantId, limit]
  );

  return result.rows;
}

module.exports = {
  findActiveAlertForUpdate,
  findAlertByIdForUpdate,
  createAlert,
  updateActiveAlert,
  acknowledgeAlert,
  resolveAlert,
  insertAlertEvent,
  listAlerts,
  listAlertHistory,
  getAlertSummaryByTrip,
  getAlertEvents,
};
