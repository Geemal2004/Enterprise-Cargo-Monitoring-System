async function getEnabledAlertRules(executor, tenantId, fleetId = null) {
  const result = await executor.query(
    `
      SELECT *
      FROM alert_rules
      WHERE tenant_id = $1
        AND enabled = TRUE
        AND (fleet_id IS NULL OR fleet_id = $2)
      ORDER BY (fleet_id IS NULL), updated_at DESC, created_at DESC
    `,
    [tenantId, fleetId]
  );

  return result.rows;
}

async function getAlertRuleMap(executor, tenantId, fleetId = null) {
  const rules = await getEnabledAlertRules(executor, tenantId, fleetId);
  const map = new Map();

  for (const rule of rules) {
    if (!map.has(rule.alert_type)) {
      map.set(rule.alert_type, rule);
    }
  }

  return map;
}

module.exports = {
  getEnabledAlertRules,
  getAlertRuleMap,
};
