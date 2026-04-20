async function listTenants(pool, limit = 500) {
  const result = await pool.query(
    `
      SELECT id, tenant_code, name, is_active, created_at, updated_at
      FROM tenants
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function findTenantByCode(executor, tenantCode) {
  const result = await executor.query(
    `
      SELECT id, tenant_code, name, is_active
      FROM tenants
      WHERE tenant_code = $1
      LIMIT 1
    `,
    [tenantCode]
  );

  return result.rows[0] || null;
}

async function listUsers(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.tenant_id,
        t.tenant_code,
        u.email,
        u.full_name,
        u.status,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        COALESCE(array_remove(array_agg(r.role_code), NULL), '{}') AS roles
      FROM users u
      JOIN tenants t
        ON t.id = u.tenant_id
      LEFT JOIN user_roles ur
        ON ur.user_id = u.id
       AND ur.tenant_id = u.tenant_id
      LEFT JOIN roles r
        ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
        AND ($1::text IS NULL OR t.tenant_code = $1)
      GROUP BY u.id, u.tenant_id, t.tenant_code
      ORDER BY u.created_at DESC
      LIMIT $2
    `,
    [tenantCode, limit]
  );

  return result.rows;
}

async function createUser(executor, input) {
  const result = await executor.query(
    `
      INSERT INTO users (
        tenant_id,
        email,
        full_name,
        password_hash,
        status,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tenant_id, email, full_name, status, is_active, created_at, updated_at
    `,
    [
      input.tenantId,
      input.email,
      input.fullName,
      input.passwordHash,
      input.status,
      input.isActive,
    ]
  );

  return result.rows[0];
}

async function patchUser(executor, userId, input) {
  const result = await executor.query(
    `
      UPDATE users
      SET
        full_name = COALESCE($2, full_name),
        password_hash = COALESCE($3, password_hash),
        status = COALESCE($4, status),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, tenant_id, email, full_name, status, is_active, created_at, updated_at
    `,
    [
      userId,
      input.fullName ?? null,
      input.passwordHash ?? null,
      input.status ?? null,
      input.isActive ?? null,
    ]
  );

  return result.rows[0] || null;
}

async function replaceUserRoles(executor, input) {
  await executor.query(
    `
      DELETE FROM user_roles
      WHERE tenant_id = $1
        AND user_id = $2
    `,
    [input.tenantId, input.userId]
  );

  if (!input.roleCodes || input.roleCodes.length === 0) {
    return [];
  }

  await executor.query(
    `
      INSERT INTO user_roles (tenant_id, user_id, role_id)
      SELECT $1, $2, r.id
      FROM roles r
      WHERE r.role_code = ANY($3::text[])
      ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING
      RETURNING role_id
    `,
    [input.tenantId, input.userId, input.roleCodes]
  );

  const roles = await executor.query(
    `
      SELECT r.role_code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.tenant_id = $1
        AND ur.user_id = $2
      ORDER BY r.role_code
    `,
    [input.tenantId, input.userId]
  );

  return roles.rows.map((row) => row.role_code);
}

async function getUserById(executor, userId) {
  const result = await executor.query(
    `
      SELECT
        u.id,
        u.tenant_id,
        t.tenant_code,
        u.email,
        u.full_name,
        u.status,
        u.is_active,
        u.deleted_at,
        u.created_at,
        u.updated_at,
        COALESCE(array_remove(array_agg(r.role_code), NULL), '{}') AS roles
      FROM users u
      JOIN tenants t
        ON t.id = u.tenant_id
      LEFT JOIN user_roles ur
        ON ur.user_id = u.id
       AND ur.tenant_id = u.tenant_id
      LEFT JOIN roles r
        ON r.id = ur.role_id
      WHERE u.id = $1
        AND u.deleted_at IS NULL
      GROUP BY u.id, t.tenant_code
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function updateUserPassword(executor, userId, passwordHash) {
  const result = await executor.query(
    `
      UPDATE users
      SET
        password_hash = $2,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, tenant_id, email, full_name, status, is_active, created_at, updated_at
    `,
    [userId, passwordHash]
  );

  return result.rows[0] || null;
}

async function listRoles(executor) {
  const result = await executor.query(
    `
      SELECT id, role_code, role_name, description, created_at, updated_at
      FROM roles
      ORDER BY role_code ASC
    `
  );

  return result.rows;
}

async function getExistingRoleCodes(executor, roleCodes) {
  if (!roleCodes || roleCodes.length === 0) {
    return [];
  }

  const result = await executor.query(
    `
      SELECT role_code
      FROM roles
      WHERE role_code = ANY($1::text[])
      ORDER BY role_code ASC
    `,
    [roleCodes]
  );

  return result.rows.map((row) => row.role_code);
}

async function listDeviceRegistry(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        dr.*,
        t.tenant_code,
        tr.truck_code,
        c.container_code,
        f.fleet_code
      FROM device_registry dr
      JOIN tenants t
        ON t.id = dr.tenant_id
      LEFT JOIN trucks tr
        ON tr.id = dr.truck_id
       AND tr.tenant_id = dr.tenant_id
      LEFT JOIN containers c
        ON c.id = dr.container_id
       AND c.tenant_id = dr.tenant_id
      LEFT JOIN fleets f
        ON f.id = dr.fleet_id
       AND f.tenant_id = dr.tenant_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
      ORDER BY dr.updated_at DESC
      LIMIT $2
    `,
    [tenantCode, limit]
  );

  return result.rows;
}

async function listAuditLogs(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        al.*,
        t.tenant_code,
        u.email AS actor_email,
        u.full_name AS actor_name
      FROM audit_logs al
      LEFT JOIN tenants t
        ON t.id = al.tenant_id
      LEFT JOIN users u
        ON u.id = al.actor_user_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
      ORDER BY al.created_at DESC
      LIMIT $2
    `,
    [tenantCode, limit]
  );

  return result.rows;
}

async function listFleetManagers(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.tenant_id,
        t.tenant_code,
        u.email,
        u.full_name,
        u.status,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      JOIN tenants t
        ON t.id = u.tenant_id
      JOIN user_roles ur
        ON ur.user_id = u.id
       AND ur.tenant_id = u.tenant_id
      JOIN roles r
        ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
        AND r.role_code = 'fleet_manager'
        AND ($1::text IS NULL OR t.tenant_code = $1)
      ORDER BY u.full_name ASC
      LIMIT $2
    `,
    [tenantCode, limit]
  );

  return result.rows;
}

async function listAssignablePairs(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        tca.id AS assignment_id,
        tca.tenant_id,
        t.tenant_code,
        tca.truck_id,
        tr.truck_code,
        tca.container_id,
        c.container_code,
        f.fleet_code,
        f.name AS fleet_name,
        tca.assigned_at
      FROM truck_container_assignments tca
      JOIN tenants t
        ON t.id = tca.tenant_id
      JOIN trucks tr
        ON tr.id = tca.truck_id
       AND tr.tenant_id = tca.tenant_id
      JOIN containers c
        ON c.id = tca.container_id
       AND c.tenant_id = tca.tenant_id
      LEFT JOIN fleets f
        ON f.id = tr.fleet_id
       AND f.tenant_id = tca.tenant_id
      LEFT JOIN fleet_manager_assignments fma
        ON fma.tenant_id = tca.tenant_id
       AND fma.container_id = tca.container_id
       AND fma.status = 'ACTIVE'
       AND fma.unassigned_at IS NULL
      WHERE tca.status = 'ACTIVE'
        AND tca.unassigned_at IS NULL
        AND ($1::text IS NULL OR t.tenant_code = $1)
        AND fma.id IS NULL
      ORDER BY tca.assigned_at DESC
      LIMIT $2
    `,
    [tenantCode, limit]
  );

  return result.rows;
}

async function listFleetManagerAssignments(pool, options = {}) {
  const tenantCode = options.tenantCode || null;
  const status = options.status || null;
  const limit = options.limit || 500;

  const result = await pool.query(
    `
      SELECT
        fma.id,
        fma.tenant_id,
        t.tenant_code,
        fma.truck_id,
        tr.truck_code,
        fma.container_id,
        c.container_code,
        f.fleet_code,
        f.name AS fleet_name,
        fma.manager_user_id,
        manager.full_name AS manager_name,
        manager.email AS manager_email,
        fma.assigned_by_user_id,
        assigner.full_name AS assigned_by_name,
        assigner.email AS assigned_by_email,
        fma.assigned_at,
        fma.unassigned_at,
        fma.status,
        fma.notes,
        fma.created_at,
        fma.updated_at
      FROM fleet_manager_assignments fma
      JOIN tenants t
        ON t.id = fma.tenant_id
      JOIN trucks tr
        ON tr.id = fma.truck_id
       AND tr.tenant_id = fma.tenant_id
      JOIN containers c
        ON c.id = fma.container_id
       AND c.tenant_id = fma.tenant_id
      LEFT JOIN fleets f
        ON f.id = tr.fleet_id
       AND f.tenant_id = fma.tenant_id
      JOIN users manager
        ON manager.id = fma.manager_user_id
      LEFT JOIN users assigner
        ON assigner.id = fma.assigned_by_user_id
      WHERE ($1::text IS NULL OR t.tenant_code = $1)
        AND ($2::text IS NULL OR fma.status = $2::assignment_status_enum)
      ORDER BY fma.assigned_at DESC
      LIMIT $3
    `,
    [tenantCode, status, limit]
  );

  return result.rows;
}

async function getActiveTruckContainerAssignment(executor, input) {
  const result = await executor.query(
    `
      SELECT *
      FROM truck_container_assignments
      WHERE tenant_id = $1
        AND truck_id = $2
        AND container_id = $3
        AND status = 'ACTIVE'
        AND unassigned_at IS NULL
      LIMIT 1
    `,
    [input.tenantId, input.truckId, input.containerId]
  );

  return result.rows[0] || null;
}

async function getFleetManagerAssignmentById(executor, assignmentId) {
  const result = await executor.query(
    `
      SELECT
        fma.*,
        t.tenant_code,
        manager.full_name AS manager_name,
        manager.email AS manager_email
      FROM fleet_manager_assignments fma
      JOIN tenants t
        ON t.id = fma.tenant_id
      JOIN users manager
        ON manager.id = fma.manager_user_id
      WHERE fma.id = $1
      LIMIT 1
    `,
    [assignmentId]
  );

  return result.rows[0] || null;
}

async function createFleetManagerAssignment(executor, input) {
  const result = await executor.query(
    `
      INSERT INTO fleet_manager_assignments (
        tenant_id,
        truck_id,
        container_id,
        manager_user_id,
        assigned_by_user_id,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      input.tenantId,
      input.truckId,
      input.containerId,
      input.managerUserId,
      input.assignedByUserId || null,
      input.notes || null,
    ]
  );

  return result.rows[0];
}

async function endFleetManagerAssignment(executor, assignmentId, input = {}) {
  const result = await executor.query(
    `
      UPDATE fleet_manager_assignments
      SET
        status = 'ENDED',
        unassigned_at = NOW(),
        notes = COALESCE($2, notes)
      WHERE id = $1
        AND status = 'ACTIVE'
        AND unassigned_at IS NULL
      RETURNING *
    `,
    [assignmentId, input.notes ?? null]
  );

  return result.rows[0] || null;
}

module.exports = {
  listTenants,
  findTenantByCode,
  listUsers,
  createUser,
  patchUser,
  replaceUserRoles,
  getUserById,
  updateUserPassword,
  listRoles,
  getExistingRoleCodes,
  listDeviceRegistry,
  listAuditLogs,
  listFleetManagers,
  listAssignablePairs,
  listFleetManagerAssignments,
  getActiveTruckContainerAssignment,
  getFleetManagerAssignmentById,
  createFleetManagerAssignment,
  endFleetManagerAssignment,
};
