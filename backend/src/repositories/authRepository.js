async function findUserAuthByEmail(executor, email) {
  const result = await executor.query(
    `
      SELECT
        u.id,
        u.tenant_id,
        u.email,
        u.full_name,
        u.password_hash,
        u.status,
        u.is_active,
        u.deleted_at,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        t.tenant_code,
        t.name AS tenant_name,
        t.is_active AS tenant_is_active,
        COALESCE(array_remove(array_agg(r.role_code), NULL), '{}') AS roles
      FROM users u
      JOIN tenants t
        ON t.id = u.tenant_id
      LEFT JOIN user_roles ur
        ON ur.user_id = u.id
       AND ur.tenant_id = u.tenant_id
      LEFT JOIN roles r
        ON r.id = ur.role_id
      WHERE lower(u.email) = lower($1)
      GROUP BY u.id, t.id
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function getUserAuthById(executor, userId) {
  const result = await executor.query(
    `
      SELECT
        u.id,
        u.tenant_id,
        u.email,
        u.full_name,
        u.password_hash,
        u.status,
        u.is_active,
        u.deleted_at,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        t.tenant_code,
        t.name AS tenant_name,
        t.is_active AS tenant_is_active,
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
      GROUP BY u.id, t.id
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function touchLastLoginAt(executor, userId) {
  await executor.query(
    `
      UPDATE users
      SET
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [userId]
  );
}

module.exports = {
  findUserAuthByEmail,
  getUserAuthById,
  touchLastLoginAt,
};
