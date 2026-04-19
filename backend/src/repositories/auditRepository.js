async function insertAuditLog(executor, entry) {
  const result = await executor.query(
    `
      INSERT INTO audit_logs (
        tenant_id,
        actor_user_id,
        action,
        target_type,
        target_id,
        metadata_json,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      entry.tenantId || null,
      entry.actorUserId || null,
      entry.action,
      entry.targetType,
      entry.targetId || null,
      JSON.stringify(entry.metadata || {}),
      entry.ipAddress || null,
      entry.userAgent || null,
    ]
  );

  return result.rows[0];
}

module.exports = {
  insertAuditLog,
};
