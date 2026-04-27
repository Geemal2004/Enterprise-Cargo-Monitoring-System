async function getFleetSummaryReport(pool, filters) {
  const {
    tenantCode = null,
    tenantId = null,
    from,
    to,
    bucketInterval,
    offlineThresholdMs,
  } = filters;

  const summaryResult = await pool.query(
    `
      WITH history_scope AS (
        SELECT
          th.truck_id,
          th.container_id,
          th.occurred_at,
          th.temperature_c,
          th.humidity_pct,
          th.speed_kph,
          th.gas_alert,
          th.shock
        FROM telemetry_history th
        JOIN tenants t
          ON t.id = th.tenant_id
        WHERE ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR th.tenant_id = $2)
          AND th.occurred_at >= $3
          AND th.occurred_at <= $4
      ),
      latest_scope AS (
        SELECT
          tl.truck_id,
          tl.container_id,
          tl.received_at
        FROM telemetry_latest tl
        JOIN tenants t
          ON t.id = tl.tenant_id
        WHERE ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR tl.tenant_id = $2)
      )
      SELECT
        COUNT(*)::int AS telemetry_points,
        COUNT(DISTINCT (history_scope.truck_id::text || ':' || history_scope.container_id::text))::int
          AS active_units_in_window,
        AVG(history_scope.temperature_c)::numeric(10,2) AS avg_temperature_c,
        MAX(history_scope.temperature_c)::numeric(10,2) AS max_temperature_c,
        AVG(history_scope.humidity_pct)::numeric(10,2) AS avg_humidity_pct,
        AVG(history_scope.speed_kph)::numeric(10,2) AS avg_speed_kph,
        COUNT(*) FILTER (WHERE history_scope.gas_alert IS TRUE)::int AS gas_alert_samples,
        COUNT(*) FILTER (WHERE history_scope.shock IS TRUE)::int AS shock_samples,
        MIN(history_scope.occurred_at) AS first_point_at,
        MAX(history_scope.occurred_at) AS last_point_at,
        (
          SELECT COUNT(DISTINCT (ls.truck_id::text || ':' || ls.container_id::text))::int
          FROM latest_scope ls
          WHERE (EXTRACT(EPOCH FROM (NOW() - ls.received_at)) * 1000) <= $5
        ) AS online_units_current,
        (
          SELECT COUNT(DISTINCT (ls.truck_id::text || ':' || ls.container_id::text))::int
          FROM latest_scope ls
          WHERE (EXTRACT(EPOCH FROM (NOW() - ls.received_at)) * 1000) > $5
        ) AS offline_units_current,
        (SELECT MAX(received_at) FROM latest_scope) AS latest_received_at
      FROM history_scope
    `,
    [tenantCode, tenantId, from, to, offlineThresholdMs]
  );

  const trendResult = await pool.query(
    `
      SELECT
        date_bin($5::interval, th.occurred_at, TIMESTAMPTZ '1970-01-01') AS bucket_at,
        COUNT(*)::int AS sample_count,
        AVG(th.temperature_c)::numeric(10,2) AS avg_temperature_c,
        AVG(th.humidity_pct)::numeric(10,2) AS avg_humidity_pct,
        AVG(th.speed_kph)::numeric(10,2) AS avg_speed_kph,
        MAX(th.temperature_c)::numeric(10,2) AS max_temperature_c
      FROM telemetry_history th
      JOIN tenants t
        ON t.id = th.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR th.tenant_id = $2)
        AND th.occurred_at >= $3
        AND th.occurred_at <= $4
      GROUP BY bucket_at
      ORDER BY bucket_at ASC
    `,
    [tenantCode, tenantId, from, to, bucketInterval]
  );

  return {
    summary: summaryResult.rows[0] || null,
    trend: trendResult.rows,
  };
}

async function getAlertSummaryReport(pool, filters) {
  const {
    tenantCode = null,
    tenantId = null,
    truckCode = null,
    containerCode = null,
    from = null,
    to = null,
    statuses = null,
    severities = null,
    bucketInterval,
  } = filters;

  const baseParams = [
    tenantCode,
    tenantId,
    truckCode,
    containerCode,
    from,
    to,
    statuses,
    severities,
  ];

  const timelineParams = [
    ...baseParams,
    bucketInterval,
  ];

  const summaryResult = await pool.query(
    `
      WITH scoped_alerts AS (
        SELECT
          a.*,
          tr.truck_code,
          c.container_code
        FROM alerts a
        JOIN tenants t
          ON t.id = a.tenant_id
        JOIN trucks tr
          ON tr.id = a.truck_id
         AND tr.tenant_id = a.tenant_id
        JOIN containers c
          ON c.id = a.container_id
         AND c.tenant_id = a.tenant_id
        WHERE ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR a.tenant_id = $2)
          AND ($3::text IS NULL OR tr.truck_code = $3)
          AND ($4::text IS NULL OR c.container_code = $4)
          AND ($5::timestamptz IS NULL OR a.last_event_at >= $5)
          AND ($6::timestamptz IS NULL OR a.last_event_at <= $6)
          AND ($7::alert_status_enum[] IS NULL OR a.status = ANY($7))
          AND ($8::alert_severity_enum[] IS NULL OR a.severity = ANY($8))
      )
      SELECT
        COUNT(*)::int AS total_alerts,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_alerts,
        COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED')::int AS acknowledged_alerts,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_alerts,
        COUNT(*) FILTER (WHERE severity = 'INFO')::int AS info_alerts,
        COUNT(*) FILTER (WHERE severity = 'WARNING')::int AS warning_alerts,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical_alerts,
        COUNT(DISTINCT (truck_code || ':' || container_code))::int AS impacted_units,
        MAX(last_event_at) AS last_alert_at
      FROM scoped_alerts
    `,
    baseParams
  );

  const severityResult = await pool.query(
    `
      SELECT
        a.severity,
        COUNT(*)::int AS count
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR a.tenant_id = $2)
        AND ($3::text IS NULL OR tr.truck_code = $3)
        AND ($4::text IS NULL OR c.container_code = $4)
        AND ($5::timestamptz IS NULL OR a.last_event_at >= $5)
        AND ($6::timestamptz IS NULL OR a.last_event_at <= $6)
        AND ($7::alert_status_enum[] IS NULL OR a.status = ANY($7))
        AND ($8::alert_severity_enum[] IS NULL OR a.severity = ANY($8))
      GROUP BY a.severity
      ORDER BY a.severity
    `,
    baseParams
  );

  const statusResult = await pool.query(
    `
      SELECT
        a.status,
        COUNT(*)::int AS count
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR a.tenant_id = $2)
        AND ($3::text IS NULL OR tr.truck_code = $3)
        AND ($4::text IS NULL OR c.container_code = $4)
        AND ($5::timestamptz IS NULL OR a.last_event_at >= $5)
        AND ($6::timestamptz IS NULL OR a.last_event_at <= $6)
        AND ($7::alert_status_enum[] IS NULL OR a.status = ANY($7))
        AND ($8::alert_severity_enum[] IS NULL OR a.severity = ANY($8))
      GROUP BY a.status
      ORDER BY a.status
    `,
    baseParams
  );

  const typeResult = await pool.query(
    `
      SELECT
        a.alert_type,
        COUNT(*)::int AS count
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR a.tenant_id = $2)
        AND ($3::text IS NULL OR tr.truck_code = $3)
        AND ($4::text IS NULL OR c.container_code = $4)
        AND ($5::timestamptz IS NULL OR a.last_event_at >= $5)
        AND ($6::timestamptz IS NULL OR a.last_event_at <= $6)
        AND ($7::alert_status_enum[] IS NULL OR a.status = ANY($7))
        AND ($8::alert_severity_enum[] IS NULL OR a.severity = ANY($8))
      GROUP BY a.alert_type
      ORDER BY count DESC, a.alert_type ASC
      LIMIT 10
    `,
    baseParams
  );

  const timelineResult = await pool.query(
    `
      SELECT
        date_bin($9::interval, a.last_event_at, TIMESTAMPTZ '1970-01-01') AS bucket_at,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE a.severity = 'CRITICAL')::int AS critical_count,
        COUNT(*) FILTER (WHERE a.severity = 'WARNING')::int AS warning_count,
        COUNT(*) FILTER (WHERE a.severity = 'INFO')::int AS info_count
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR a.tenant_id = $2)
        AND ($3::text IS NULL OR tr.truck_code = $3)
        AND ($4::text IS NULL OR c.container_code = $4)
        AND ($5::timestamptz IS NULL OR a.last_event_at >= $5)
        AND ($6::timestamptz IS NULL OR a.last_event_at <= $6)
        AND ($7::alert_status_enum[] IS NULL OR a.status = ANY($7))
        AND ($8::alert_severity_enum[] IS NULL OR a.severity = ANY($8))
      GROUP BY bucket_at
      ORDER BY bucket_at ASC
    `,
    timelineParams
  );

  const topContainersResult = await pool.query(
    `
      SELECT
        tr.truck_code,
        c.container_code,
        COUNT(*)::int AS alert_count,
        MAX(a.last_event_at) AS last_alert_at
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR a.tenant_id = $2)
        AND ($3::text IS NULL OR tr.truck_code = $3)
        AND ($4::text IS NULL OR c.container_code = $4)
        AND ($5::timestamptz IS NULL OR a.last_event_at >= $5)
        AND ($6::timestamptz IS NULL OR a.last_event_at <= $6)
        AND ($7::alert_status_enum[] IS NULL OR a.status = ANY($7))
        AND ($8::alert_severity_enum[] IS NULL OR a.severity = ANY($8))
      GROUP BY tr.truck_code, c.container_code
      ORDER BY alert_count DESC, last_alert_at DESC
      LIMIT 10
    `,
    baseParams
  );

  return {
    summary: summaryResult.rows[0] || null,
    bySeverity: severityResult.rows,
    byStatus: statusResult.rows,
    byType: typeResult.rows,
    timeline: timelineResult.rows,
    topContainers: topContainersResult.rows,
  };
}

async function getDeviceHealthSummaryReport(pool, filters) {
  const {
    tenantCode = null,
    tenantId = null,
    offlineThresholdMs,
    limit,
  } = filters;

  const summaryResult = await pool.query(
    `
      WITH latest_scope AS (
        SELECT
          tl.truck_id,
          tl.container_id,
          tl.received_at
        FROM telemetry_latest tl
        JOIN tenants t
          ON t.id = tl.tenant_id
        WHERE ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR tl.tenant_id = $2)
      ),
      device_scope AS (
        SELECT
          dr.device_type,
          dr.last_seen_at
        FROM device_registry dr
        JOIN tenants t
          ON t.id = dr.tenant_id
        WHERE dr.active_flag = TRUE
          AND ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR dr.tenant_id = $2)
      )
      SELECT
        (SELECT COUNT(*)::int FROM latest_scope) AS tracked_units,
        (
          SELECT COUNT(*)::int
          FROM latest_scope ls
          WHERE (EXTRACT(EPOCH FROM (NOW() - ls.received_at)) * 1000) <= $3
        ) AS online_units,
        (
          SELECT COUNT(*)::int
          FROM latest_scope ls
          WHERE (EXTRACT(EPOCH FROM (NOW() - ls.received_at)) * 1000) > $3
        ) AS offline_units,
        (SELECT MAX(received_at) FROM latest_scope) AS latest_telemetry_at,
        (SELECT COUNT(*)::int FROM device_scope) AS active_devices,
        (
          SELECT COUNT(*)::int
          FROM device_scope ds
          WHERE ds.device_type = 'SENSOR_NODE'
        ) AS active_sensor_devices,
        (
          SELECT COUNT(*)::int
          FROM device_scope ds
          WHERE ds.device_type = 'GATEWAY_NODE'
        ) AS active_gateway_devices,
        (
          SELECT COUNT(*)::int
          FROM device_scope ds
          WHERE ds.last_seen_at IS NULL
            OR (EXTRACT(EPOCH FROM (NOW() - ds.last_seen_at)) * 1000) > $3
        ) AS stale_devices
    `,
    [tenantCode, tenantId, offlineThresholdMs]
  );

  const offlineUnitsResult = await pool.query(
    `
      SELECT
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        tl.received_at,
        ROUND((EXTRACT(EPOCH FROM (NOW() - tl.received_at)) / 60.0)::numeric, 2)
          AS minutes_since_last_telemetry
      FROM telemetry_latest tl
      JOIN tenants t
        ON t.id = tl.tenant_id
      JOIN trucks tr
        ON tr.id = tl.truck_id
       AND tr.tenant_id = tl.tenant_id
      JOIN containers c
        ON c.id = tl.container_id
       AND c.tenant_id = tl.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::uuid IS NULL OR tl.tenant_id = $2)
        AND (EXTRACT(EPOCH FROM (NOW() - tl.received_at)) * 1000) > $3
      ORDER BY tl.received_at ASC
      LIMIT $4
    `,
    [tenantCode, tenantId, offlineThresholdMs, limit]
  );

  return {
    summary: summaryResult.rows[0] || null,
    offlineUnits: offlineUnitsResult.rows,
  };
}

async function getContainerDayTelemetrySummary(pool, filters) {
  const {
    tenantCode = null,
    truckCode,
    containerCode,
    from,
    to,
    bucketInterval,
    maxPoints,
    managerUserId = null,
  } = filters;

  const metricsResult = await pool.query(
    `
      WITH scoped AS (
        SELECT
          th.occurred_at,
          th.received_at,
          th.temperature_c,
          th.humidity_pct,
          th.pressure_hpa,
          th.speed_kph,
          th.tilt_deg,
          th.gas_raw,
          th.gas_alert,
          th.shock,
          th.gps_fix
        FROM telemetry_history th
        JOIN tenants t
          ON t.id = th.tenant_id
        JOIN trucks tr
          ON tr.id = th.truck_id
         AND tr.tenant_id = th.tenant_id
        JOIN containers c
          ON c.id = th.container_id
         AND c.tenant_id = th.tenant_id
        LEFT JOIN fleet_manager_assignments fma
          ON fma.tenant_id = th.tenant_id
         AND fma.container_id = th.container_id
         AND fma.status = 'ACTIVE'
         AND fma.unassigned_at IS NULL
        WHERE tr.truck_code = $1
          AND c.container_code = $2
          AND ($3::text IS NULL OR t.tenant_code = $3)
          AND th.occurred_at >= $4
          AND th.occurred_at < $5
          AND ($6::uuid IS NULL OR fma.manager_user_id = $6)
      )
      SELECT
        COUNT(*)::int AS sample_count,
        MIN(occurred_at) AS first_point_at,
        MAX(occurred_at) AS last_point_at,
        MIN(received_at) AS first_received_at,
        MAX(received_at) AS last_received_at,
        MIN(temperature_c) AS temperature_min,
        AVG(temperature_c) AS temperature_avg,
        MAX(temperature_c) AS temperature_max,
        MIN(humidity_pct) AS humidity_min,
        AVG(humidity_pct) AS humidity_avg,
        MAX(humidity_pct) AS humidity_max,
        MIN(pressure_hpa) AS pressure_min,
        AVG(pressure_hpa) AS pressure_avg,
        MAX(pressure_hpa) AS pressure_max,
        MIN(speed_kph) AS speed_min,
        AVG(speed_kph) AS speed_avg,
        MAX(speed_kph) AS speed_max,
        AVG(gas_raw) AS gas_avg,
        MAX(gas_raw) AS gas_max,
        SUM(CASE WHEN gas_alert THEN 1 ELSE 0 END)::int AS gas_alert_count,
        SUM(CASE WHEN shock THEN 1 ELSE 0 END)::int AS shock_count,
        MAX(tilt_deg) AS tilt_max,
        SUM(CASE WHEN COALESCE(gps_fix, FALSE) THEN 1 ELSE 0 END)::int AS gps_fix_true_count
      FROM scoped
    `,
    [truckCode, containerCode, tenantCode, from, to, managerUserId]
  );

  const timelineResult = await pool.query(
    `
      WITH scoped AS (
        SELECT
          th.occurred_at,
          th.temperature_c,
          th.humidity_pct,
          th.pressure_hpa,
          th.speed_kph,
          th.gas_raw,
          th.gas_alert,
          th.shock,
          th.gps_fix
        FROM telemetry_history th
        JOIN tenants t
          ON t.id = th.tenant_id
        JOIN trucks tr
          ON tr.id = th.truck_id
         AND tr.tenant_id = th.tenant_id
        JOIN containers c
          ON c.id = th.container_id
         AND c.tenant_id = th.tenant_id
        LEFT JOIN fleet_manager_assignments fma
          ON fma.tenant_id = th.tenant_id
         AND fma.container_id = th.container_id
         AND fma.status = 'ACTIVE'
         AND fma.unassigned_at IS NULL
        WHERE tr.truck_code = $1
          AND c.container_code = $2
          AND ($3::text IS NULL OR t.tenant_code = $3)
          AND th.occurred_at >= $4
          AND th.occurred_at < $5
          AND ($6::uuid IS NULL OR fma.manager_user_id = $6)
      )
      SELECT
        date_bin($7::interval, occurred_at, TIMESTAMPTZ '1970-01-01') AS bucket_at,
        COUNT(*)::int AS sample_count,
        AVG(temperature_c) AS temperature_avg,
        AVG(humidity_pct) AS humidity_avg,
        AVG(pressure_hpa) AS pressure_avg,
        AVG(speed_kph) AS speed_avg,
        MAX(gas_raw) AS gas_raw_max,
        BOOL_OR(gas_alert) AS gas_alert,
        BOOL_OR(shock) AS shock,
        BOOL_OR(COALESCE(gps_fix, FALSE)) AS gps_fix_any
      FROM scoped
      GROUP BY bucket_at
      ORDER BY bucket_at ASC
      LIMIT $8
    `,
    [truckCode, containerCode, tenantCode, from, to, managerUserId, bucketInterval, maxPoints]
  );

  const alertResult = await pool.query(
    `
      SELECT
        a.severity,
        COUNT(*)::int AS count
      FROM alerts a
      JOIN tenants t
        ON t.id = a.tenant_id
      JOIN trucks tr
        ON tr.id = a.truck_id
       AND tr.tenant_id = a.tenant_id
      JOIN containers c
        ON c.id = a.container_id
       AND c.tenant_id = a.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = a.tenant_id
       AND fma.container_id = a.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      WHERE tr.truck_code = $1
        AND c.container_code = $2
        AND ($3::text IS NULL OR t.tenant_code = $3)
        AND a.last_event_at >= $4
        AND a.last_event_at < $5
        AND ($6::uuid IS NULL OR fma.manager_user_id = $6)
      GROUP BY a.severity
      ORDER BY a.severity ASC
    `,
    [truckCode, containerCode, tenantCode, from, to, managerUserId]
  );

  return {
    metrics: metricsResult.rows[0] || null,
    timeline: timelineResult.rows,
    alertsBySeverity: alertResult.rows,
  };
}

module.exports = {
  getFleetSummaryReport,
  getAlertSummaryReport,
  getDeviceHealthSummaryReport,
  getContainerDayTelemetrySummary,
};
