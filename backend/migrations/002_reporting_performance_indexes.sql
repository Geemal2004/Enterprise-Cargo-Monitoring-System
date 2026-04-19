BEGIN;

-- Reporting-focused indexes for alert history and dashboard summary scans.
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_last_event
  ON alerts(tenant_id, last_event_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status_severity_last_event
  ON alerts(tenant_id, status, severity, last_event_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_container_last_event
  ON alerts(tenant_id, container_id, last_event_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_tenant_alert_time
  ON alert_events(tenant_id, alert_id, event_at DESC);

COMMIT;
