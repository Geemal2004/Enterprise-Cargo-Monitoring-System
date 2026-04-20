async function listTrips(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const status = options.status || null;
  const truckCode = options.truckCode || null;
  const containerCode = options.containerCode || null;
  const managerUserId = options.managerUserId || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        tp.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code,
        f.name AS fleet_name
      FROM trips tp
      JOIN tenants t
        ON t.id = tp.tenant_id
      JOIN trucks tr
        ON tr.id = tp.truck_id
       AND tr.tenant_id = tp.tenant_id
      JOIN containers c
        ON c.id = tp.container_id
       AND c.tenant_id = tp.tenant_id
      LEFT JOIN fleets f
        ON f.id = tp.fleet_id
       AND f.tenant_id = tp.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = tp.tenant_id
       AND fma.container_id = tp.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::trip_status_enum IS NULL OR tp.status = $2::trip_status_enum)
        AND ($3::text IS NULL OR tr.truck_code = $3)
        AND ($4::text IS NULL OR c.container_code = $4)
        AND ($5::uuid IS NULL OR fma.manager_user_id = $5)
      ORDER BY COALESCE(tp.actual_start_at, tp.planned_start_at, tp.created_at) DESC
      LIMIT $6
    `,
    [tenantCode, status, truckCode, containerCode, managerUserId, limit]
  );

  return result.rows;
}

async function getTripById(pool, options = {}) {
  const tripId = options.tripId;
  const tenantCode = options.tenantCode || null;
  const managerUserId = options.managerUserId || null;

  const result = await pool.query(
    `
      SELECT
        tp.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code,
        f.name AS fleet_name
      FROM trips tp
      JOIN tenants t
        ON t.id = tp.tenant_id
      JOIN trucks tr
        ON tr.id = tp.truck_id
       AND tr.tenant_id = tp.tenant_id
      JOIN containers c
        ON c.id = tp.container_id
       AND c.tenant_id = tp.tenant_id
      LEFT JOIN fleets f
        ON f.id = tp.fleet_id
       AND f.tenant_id = tp.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = tp.tenant_id
       AND fma.container_id = tp.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      WHERE tp.id = $1
        AND ($2::text IS NULL OR t.tenant_code = $2)
        AND ($3::uuid IS NULL OR fma.manager_user_id = $3)
      LIMIT 1
    `,
    [tripId, tenantCode, managerUserId]
  );

  return result.rows[0] || null;
}

async function getActiveTripByAsset(executor, input) {
  const result = await executor.query(
    `
      SELECT id, status
      FROM trips
      WHERE tenant_id = $1
        AND truck_id = $2
        AND container_id = $3
        AND status IN ('PLANNED', 'IN_PROGRESS')
      ORDER BY COALESCE(actual_start_at, planned_start_at, created_at) DESC
      LIMIT 1
    `,
    [input.tenantId, input.truckId, input.containerId]
  );

  return result.rows[0] || null;
}

async function getActiveManagerAssignment(executor, input) {
  const result = await executor.query(
    `
      SELECT id
      FROM fleet_manager_assignments
      WHERE tenant_id = $1
        AND container_id = $2
        AND manager_user_id = $3
        AND status = 'ACTIVE'
        AND unassigned_at IS NULL
      LIMIT 1
    `,
    [input.tenantId, input.containerId, input.managerUserId]
  );

  return result.rows[0] || null;
}

async function createTrip(executor, input) {
  const result = await executor.query(
    `
      INSERT INTO trips (
        tenant_id,
        trip_code,
        fleet_id,
        truck_id,
        container_id,
        route_id,
        origin_name,
        destination_name,
        planned_start_at,
        planned_end_at,
        status,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      input.tenantId,
      input.tripCode,
      input.fleetId || null,
      input.truckId,
      input.containerId,
      input.routeId || null,
      input.originName,
      input.destinationName,
      input.plannedStartAt || null,
      input.plannedEndAt || null,
      input.status || "PLANNED",
      JSON.stringify(input.metadata || {}),
    ]
  );

  return result.rows[0];
}

async function startTrip(executor, input) {
  const result = await executor.query(
    `
      UPDATE trips
      SET
        status = 'IN_PROGRESS',
        actual_start_at = COALESCE(actual_start_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
        AND status = 'PLANNED'
      RETURNING *
    `,
    [input.tripId, input.tenantId]
  );

  return result.rows[0] || null;
}

async function completeTrip(executor, input) {
  const result = await executor.query(
    `
      UPDATE trips
      SET
        status = 'COMPLETED',
        actual_end_at = COALESCE(actual_end_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
        AND status = 'IN_PROGRESS'
      RETURNING *
    `,
    [input.tripId, input.tenantId]
  );

  return result.rows[0] || null;
}

module.exports = {
  listTrips,
  getTripById,
  getActiveTripByAsset,
  getActiveManagerAssignment,
  createTrip,
  startTrip,
  completeTrip,
};
