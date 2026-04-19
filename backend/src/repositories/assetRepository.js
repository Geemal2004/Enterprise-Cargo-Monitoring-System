async function resolveAssetContextByCodes(executor, identifiers) {
  const { tenantCode, truckCode, containerCode } = identifiers;

  const result = await executor.query(
    `
      SELECT
        t.id AS tenant_id,
        t.tenant_code,
        f.id AS fleet_id,
        f.fleet_code,
        tr.id AS truck_id,
        tr.truck_code,
        c.id AS container_id,
        c.container_code,
        active_trip.id AS trip_id
      FROM tenants t
      JOIN trucks tr
        ON tr.tenant_id = t.id
       AND tr.truck_code = $2
       AND tr.is_active = TRUE
      JOIN containers c
        ON c.tenant_id = t.id
       AND c.container_code = $3
       AND c.is_active = TRUE
      LEFT JOIN fleets f
        ON f.id = tr.fleet_id
       AND f.tenant_id = t.id
      LEFT JOIN LATERAL (
        SELECT tp.id
        FROM trips tp
        WHERE tp.tenant_id = t.id
          AND tp.truck_id = tr.id
          AND tp.container_id = c.id
          AND tp.status IN ('PLANNED', 'IN_PROGRESS')
        ORDER BY COALESCE(tp.actual_start_at, tp.planned_start_at, tp.created_at) DESC
        LIMIT 1
      ) active_trip ON TRUE
      WHERE t.tenant_code = $1
        AND t.is_active = TRUE
      LIMIT 1
    `,
    [tenantCode, truckCode, containerCode]
  );

  return result.rows[0] || null;
}

async function resolveTenantByCode(executor, tenantCode) {
  const result = await executor.query(
    `SELECT id, tenant_code, name, is_active FROM tenants WHERE tenant_code = $1 LIMIT 1`,
    [tenantCode]
  );
  return result.rows[0] || null;
}

module.exports = {
  resolveAssetContextByCodes,
  resolveTenantByCode,
};
