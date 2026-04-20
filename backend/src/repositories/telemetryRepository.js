async function insertTelemetryHistory(client, telemetry) {
  await client.query(
    `
      INSERT INTO telemetry_history (
        tenant_id,
        fleet_id,
        truck_id,
        container_id,
        trip_id,
        gateway_device_id,
        sensor_device_id,
        mqtt_topic,
        seq,
        occurred_at,
        received_at,
        gps_lat,
        gps_lon,
        speed_kph,
        temperature_c,
        humidity_pct,
        pressure_hpa,
        tilt_deg,
        shock,
        gas_raw,
        gas_alert,
        sd_ok,
        gps_fix,
        uplink,
        raw_payload
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25
      )
    `,
    [
      telemetry.tenantId,
      telemetry.fleetId,
      telemetry.truckId,
      telemetry.containerId,
      telemetry.tripId,
      telemetry.gatewayDeviceId,
      telemetry.sensorDeviceId,
      telemetry.mqttTopic,
      telemetry.seq,
      telemetry.sourceTs,
      telemetry.receivedAt,
      telemetry.gpsLat,
      telemetry.gpsLon,
      telemetry.speedKph,
      telemetry.temperatureC,
      telemetry.humidityPct,
      telemetry.pressureHpa,
      telemetry.tiltDeg,
      telemetry.shock,
      telemetry.gasRaw,
      telemetry.gasAlert,
      telemetry.sdOk,
      telemetry.gpsFix,
      telemetry.uplink,
      JSON.stringify(telemetry.rawPayload),
    ]
  );
}

async function upsertTelemetryLatest(client, telemetry) {
  await client.query(
    `
      INSERT INTO telemetry_latest (
        tenant_id,
        fleet_id,
        truck_id,
        container_id,
        trip_id,
        gateway_device_id,
        sensor_device_id,
        mqtt_topic,
        seq,
        source_ts,
        received_at,
        gps_lat,
        gps_lon,
        speed_kph,
        temperature_c,
        humidity_pct,
        pressure_hpa,
        tilt_deg,
        shock,
        gas_raw,
        gas_alert,
        sd_ok,
        gps_fix,
        uplink,
        raw_payload
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25
      )
      ON CONFLICT (tenant_id, truck_id, container_id)
      DO UPDATE SET
        fleet_id = EXCLUDED.fleet_id,
        trip_id = EXCLUDED.trip_id,
        gateway_device_id = EXCLUDED.gateway_device_id,
        sensor_device_id = EXCLUDED.sensor_device_id,
        mqtt_topic = EXCLUDED.mqtt_topic,
        seq = EXCLUDED.seq,
        source_ts = EXCLUDED.source_ts,
        received_at = EXCLUDED.received_at,
        gps_lat = EXCLUDED.gps_lat,
        gps_lon = EXCLUDED.gps_lon,
        speed_kph = EXCLUDED.speed_kph,
        temperature_c = EXCLUDED.temperature_c,
        humidity_pct = EXCLUDED.humidity_pct,
        pressure_hpa = EXCLUDED.pressure_hpa,
        tilt_deg = EXCLUDED.tilt_deg,
        shock = EXCLUDED.shock,
        gas_raw = EXCLUDED.gas_raw,
        gas_alert = EXCLUDED.gas_alert,
        sd_ok = EXCLUDED.sd_ok,
        gps_fix = EXCLUDED.gps_fix,
        uplink = EXCLUDED.uplink,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `,
    [
      telemetry.tenantId,
      telemetry.fleetId,
      telemetry.truckId,
      telemetry.containerId,
      telemetry.tripId,
      telemetry.gatewayDeviceId,
      telemetry.sensorDeviceId,
      telemetry.mqttTopic,
      telemetry.seq,
      telemetry.sourceTs,
      telemetry.receivedAt,
      telemetry.gpsLat,
      telemetry.gpsLon,
      telemetry.speedKph,
      telemetry.temperatureC,
      telemetry.humidityPct,
      telemetry.pressureHpa,
      telemetry.tiltDeg,
      telemetry.shock,
      telemetry.gasRaw,
      telemetry.gasAlert,
      telemetry.sdOk,
      telemetry.gpsFix,
      telemetry.uplink,
      JSON.stringify(telemetry.rawPayload),
    ]
  );
}

async function getLatestSnapshot(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const limit = options.limit || 2000;
  const managerUserId = options.managerUserId || null;

  const result = await pool.query(
    `
      SELECT
        tl.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code
      FROM telemetry_latest tl
      JOIN tenants t
        ON t.id = tl.tenant_id
      JOIN trucks tr
        ON tr.id = tl.truck_id
       AND tr.tenant_id = tl.tenant_id
      JOIN containers c
        ON c.id = tl.container_id
       AND c.tenant_id = tl.tenant_id
      LEFT JOIN fleets f
        ON f.id = tl.fleet_id
       AND f.tenant_id = tl.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = tl.tenant_id
       AND fma.container_id = tl.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($3::uuid IS NULL OR fma.manager_user_id = $3)
      ORDER BY tl.received_at DESC
      LIMIT $2
    `,
    [tenantCode, limit, managerUserId]
  );

  return result.rows;
}

async function getLatestByCodes(pool, identifiers) {
  const { tenantCode = null, truckCode, containerCode, managerUserId = null } = identifiers;

  const result = await pool.query(
    `
      SELECT
        tl.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code
      FROM telemetry_latest tl
      JOIN tenants t
        ON t.id = tl.tenant_id
      JOIN trucks tr
        ON tr.id = tl.truck_id
       AND tr.tenant_id = tl.tenant_id
      JOIN containers c
        ON c.id = tl.container_id
       AND c.tenant_id = tl.tenant_id
      LEFT JOIN fleets f
        ON f.id = tl.fleet_id
       AND f.tenant_id = tl.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = tl.tenant_id
       AND fma.container_id = tl.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      WHERE tr.truck_code = $1
        AND c.container_code = $2
        AND ($3::text IS NULL OR t.tenant_code = $3)
        AND ($4::uuid IS NULL OR fma.manager_user_id = $4)
      ORDER BY tl.received_at DESC
      LIMIT 1
    `,
    [truckCode, containerCode, tenantCode, managerUserId]
  );

  return result.rows[0] || null;
}

async function getHistoryByCodes(pool, options) {
  const {
    tenantCode = null,
    truckCode,
    containerCode,
    from = null,
    to = null,
    limit = 240,
    interval = null,
    managerUserId = null,
  } = options;

  if (interval) {
    const aggregated = await pool.query(
      `
        SELECT
          date_bin($6::interval, th.occurred_at, TIMESTAMPTZ '1970-01-01') AS bucket_at,
          MAX(t.tenant_code) AS tenant_code,
          MAX(tr.truck_code) AS truck_code,
          MAX(c.container_code) AS container_code,
          AVG(th.temperature_c) AS temperature_c,
          AVG(th.humidity_pct) AS humidity_pct,
          AVG(th.pressure_hpa) AS pressure_hpa,
          AVG(th.speed_kph) AS speed_kph,
          AVG(th.gps_lat) AS gps_lat,
          AVG(th.gps_lon) AS gps_lon,
          AVG(th.tilt_deg) AS tilt_deg,
          MAX(th.gas_raw) AS gas_raw,
          BOOL_OR(th.gas_alert) AS gas_alert,
          BOOL_OR(th.shock) AS shock,
          BOOL_OR(COALESCE(th.gps_fix, FALSE) = FALSE) AS gps_lost,
          MAX(th.received_at) AS received_at,
          COUNT(*)::int AS sample_count
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
          AND ($4::timestamptz IS NULL OR th.occurred_at >= $4)
          AND ($5::timestamptz IS NULL OR th.occurred_at <= $5)
          AND ($7::uuid IS NULL OR fma.manager_user_id = $7)
        GROUP BY bucket_at
        ORDER BY bucket_at ASC
        LIMIT $8
      `,
      [truckCode, containerCode, tenantCode, from, to, interval, managerUserId, limit]
    );

    return aggregated.rows;
  }

  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT
          th.*,
          t.tenant_code,
          tr.truck_code,
          c.container_code
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
          AND ($4::timestamptz IS NULL OR th.occurred_at >= $4)
          AND ($5::timestamptz IS NULL OR th.occurred_at <= $5)
          AND ($7::uuid IS NULL OR fma.manager_user_id = $7)
        ORDER BY th.occurred_at DESC
        LIMIT $6
      ) latest_window
      ORDER BY occurred_at ASC
    `,
    [truckCode, containerCode, tenantCode, from, to, limit, managerUserId]
  );

  return result.rows;
}

async function findOfflineCandidates(pool, thresholdMs, tenantCode = null, limit = 500) {
  const result = await pool.query(
    `
      SELECT
        tl.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code
      FROM telemetry_latest tl
      JOIN tenants t
        ON t.id = tl.tenant_id
      JOIN trucks tr
        ON tr.id = tl.truck_id
       AND tr.tenant_id = tl.tenant_id
      JOIN containers c
        ON c.id = tl.container_id
       AND c.tenant_id = tl.tenant_id
      LEFT JOIN fleets f
        ON f.id = tl.fleet_id
       AND f.tenant_id = tl.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND (EXTRACT(EPOCH FROM (NOW() - tl.received_at)) * 1000) > $2
      ORDER BY tl.received_at ASC
      LIMIT $3
    `,
    [tenantCode, thresholdMs, limit]
  );

  return result.rows;
}

async function getFleetSummary(pool, thresholdMs, tenantCode = null, managerUserId = null) {
  const result = await pool.query(
    `
      WITH scoped_trucks AS (
        SELECT DISTINCT tr.id
        FROM trucks tr
        JOIN tenants t
          ON t.id = tr.tenant_id
        LEFT JOIN fleet_manager_assignments fma
          ON fma.tenant_id = tr.tenant_id
         AND fma.truck_id = tr.id
         AND fma.status = 'ACTIVE'
         AND fma.unassigned_at IS NULL
        WHERE tr.is_active = TRUE
          AND ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR fma.manager_user_id = $2)
      ),
      latest_scope AS (
        SELECT tl.*
        FROM telemetry_latest tl
        JOIN tenants t
          ON t.id = tl.tenant_id
        LEFT JOIN fleet_manager_assignments fma
          ON fma.tenant_id = tl.tenant_id
         AND fma.container_id = tl.container_id
         AND fma.status = 'ACTIVE'
         AND fma.unassigned_at IS NULL
        WHERE ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR fma.manager_user_id = $2)
      ),
      active_alerts AS (
        SELECT a.*
        FROM alerts a
        JOIN tenants t
          ON t.id = a.tenant_id
        LEFT JOIN fleet_manager_assignments fma
          ON fma.tenant_id = a.tenant_id
         AND fma.container_id = a.container_id
         AND fma.status = 'ACTIVE'
         AND fma.unassigned_at IS NULL
        WHERE a.status IN ('OPEN', 'ACKNOWLEDGED')
          AND ($1::text IS NULL OR t.tenant_code = $1)
          AND ($2::uuid IS NULL OR fma.manager_user_id = $2)
      ),
      severity_counts AS (
        SELECT severity, COUNT(*)::int AS count
        FROM active_alerts
        GROUP BY severity
      )
      SELECT
        (SELECT COUNT(*)::int FROM scoped_trucks) AS total_trucks,
        (
          SELECT COUNT(DISTINCT truck_id)::int
          FROM latest_scope ls
          WHERE (EXTRACT(EPOCH FROM (NOW() - ls.received_at)) * 1000) <= $3
        ) AS online_trucks,
        (SELECT COUNT(*)::int FROM active_alerts) AS active_alerts,
        (
          SELECT COUNT(DISTINCT container_id)::int
          FROM active_alerts
          WHERE severity IN ('WARNING', 'CRITICAL')
        ) AS containers_in_warning,
        (SELECT MAX(received_at) FROM latest_scope) AS last_update_time,
        COALESCE((SELECT count FROM severity_counts WHERE severity = 'INFO'), 0)::int AS info_alerts,
        COALESCE((SELECT count FROM severity_counts WHERE severity = 'WARNING'), 0)::int AS warning_alerts,
        COALESCE((SELECT count FROM severity_counts WHERE severity = 'CRITICAL'), 0)::int AS critical_alerts
    `,
    [tenantCode, managerUserId, thresholdMs]
  );

  return result.rows[0];
}

async function listFleetUnits(pool, thresholdMs, tenantCode = null, limit = 2000, managerUserId = null) {
  const result = await pool.query(
    `
      SELECT
        tl.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code,
        COALESCE(aa.active_alerts, 0) AS active_alerts,
        CASE COALESCE(aa.max_severity_rank, 0)
          WHEN 3 THEN 'CRITICAL'
          WHEN 2 THEN 'WARNING'
          WHEN 1 THEN 'INFO'
          ELSE NULL
        END AS highest_alert_severity,
        CASE
          WHEN (EXTRACT(EPOCH FROM (NOW() - tl.received_at)) * 1000) <= $2 THEN TRUE
          ELSE FALSE
        END AS is_online
      FROM telemetry_latest tl
      JOIN tenants t
        ON t.id = tl.tenant_id
      JOIN trucks tr
        ON tr.id = tl.truck_id
       AND tr.tenant_id = tl.tenant_id
      JOIN containers c
        ON c.id = tl.container_id
       AND c.tenant_id = tl.tenant_id
      LEFT JOIN fleets f
        ON f.id = tl.fleet_id
       AND f.tenant_id = tl.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = tl.tenant_id
       AND fma.container_id = tl.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS active_alerts,
          MAX(
            CASE a.severity
              WHEN 'CRITICAL' THEN 3
              WHEN 'WARNING' THEN 2
              WHEN 'INFO' THEN 1
              ELSE 0
            END
          ) AS max_severity_rank
        FROM alerts a
        WHERE a.tenant_id = tl.tenant_id
          AND a.truck_id = tl.truck_id
          AND a.container_id = tl.container_id
          AND a.status IN ('OPEN', 'ACKNOWLEDGED')
      ) aa ON TRUE
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($4::uuid IS NULL OR fma.manager_user_id = $4)
      ORDER BY tl.received_at DESC
      LIMIT $3
    `,
    [tenantCode, thresholdMs, limit, managerUserId]
  );

  return result.rows;
}

module.exports = {
  insertTelemetryHistory,
  upsertTelemetryLatest,
  getLatestSnapshot,
  getLatestByCodes,
  getHistoryByCodes,
  findOfflineCandidates,
  getFleetSummary,
  listFleetUnits,
};
