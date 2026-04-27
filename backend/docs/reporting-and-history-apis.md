# Reporting, History, and Timeline APIs

This document describes the enterprise telemetry history, alert timeline, and reporting APIs added for dashboard and chart workloads.

## Performance Guardrails

- All list/history APIs enforce a bounded `limit`.
- History endpoints support range filtering with `from`/`to`.
- Time-series aggregation supports `bucketMinutes` for chart density control.
- Dashboard reads prefer `telemetry_latest` for latest-only views.
- Summary endpoints use grouped SQL and lightweight payloads.

## API Endpoints

## 1) Telemetry History

### GET /api/trucks/:truckId/containers/:containerId/history

Query params:

- `from` (ISO timestamp)
- `to` (ISO timestamp)
- `limit` (clamped to `HISTORY_MAX_LIMIT`)
- `bucketMinutes` (optional integer, e.g. `15`)
- `interval` (legacy-compatible alternative, e.g. `15m`, `1 hour`)

Behavior:

- No bucket parameter: returns raw points in ascending time order.
- With bucket parameter: returns aggregated points per time bucket.

Example response (bucketed):

```json
{
  "truckId": "TRUCK01",
  "containerId": "CONT01",
  "count": 24,
  "bucketMinutes": 60,
  "interval": "60 minutes",
  "from": "2026-04-18T00:00:00.000Z",
  "to": "2026-04-19T00:00:00.000Z",
  "items": [
    {
      "ts": "2026-04-18T01:00:00.000Z",
      "occurredAt": "2026-04-18T01:00:00.000Z",
      "env": { "temperatureC": 7.21, "humidityPct": 54.12, "pressureHpa": 1004.22 },
      "gas": { "mq2Raw": 1320, "alert": false },
      "motion": { "shock": false, "tiltDeg": 1.12 },
      "gps": { "lat": 6.92, "lon": 79.84, "speedKph": 42.1, "gpsFix": true },
      "sampleCount": 18
    }
  ]
}
```

## 2) Alert Timeline

### GET /api/alerts/:alertId/events

Query params:

- `limit` (optional)
- `tenantId` (optional UUID for super-admin scoped views)

Example response:

```json
{
  "count": 3,
  "alertId": "15f4263b-8f8f-4332-9f6f-80d9ce5c9b14",
  "items": [
    {
      "id": "fa771b8d-1d27-4eb6-aa95-2955ca636ce8",
      "alertId": "15f4263b-8f8f-4332-9f6f-80d9ce5c9b14",
      "tenantCode": "demo",
      "eventType": "ACKNOWLEDGED",
      "fromStatus": "OPEN",
      "toStatus": "ACKNOWLEDGED",
      "actorUserId": "da532819-46bd-47d6-bf4b-d5c954ff9986",
      "actorEmail": "admin@demo.local",
      "actorName": "Demo Admin",
      "eventAt": "2026-04-19T02:00:44.120Z",
      "message": "Reviewed by operations",
      "metadata": { "source": "manual_transition" }
    }
  ]
}
```

### GET /api/alerts/history

Query params:

- `status` (CSV)
- `severity` (CSV)
- `tenantId` (UUID)
- `truckId`
- `containerId`
- `from`
- `to`
- `limit`

Example response:

```json
{
  "count": 2,
  "filters": {
    "status": ["OPEN", "ACKNOWLEDGED"],
    "severity": ["WARNING", "CRITICAL"],
    "tenantId": null,
    "truckId": "TRUCK01",
    "containerId": "CONT01",
    "from": "2026-04-18T00:00:00.000Z",
    "to": "2026-04-19T00:00:00.000Z"
  },
  "items": [
    {
      "key": "TRUCK01::CONT01",
      "id": "15f4263b-8f8f-4332-9f6f-80d9ce5c9b14",
      "tenantId": "0d7f95dd-ad42-4d92-8f44-52d2942c579b",
      "tenantCode": "demo",
      "fleetId": "fleet-01",
      "truckId": "TRUCK01",
      "containerId": "CONT01",
      "alertType": "HIGH_TEMPERATURE",
      "severity": "WARNING",
      "status": "OPEN",
      "title": "High temperature detected",
      "message": "Temperature exceeded threshold",
      "openedAt": "2026-04-18T09:12:00.000Z",
      "acknowledgedAt": null,
      "resolvedAt": null,
      "lastEventAt": "2026-04-18T09:13:00.000Z",
      "latestValueNumeric": 35.8,
      "latestValueBoolean": null,
      "thresholdValueNumeric": 35,
      "metadata": { "source": "rule_engine" }
    }
  ]
}
```

## 3) Fleet Reporting

### GET /api/reports/fleet-summary

Query params:

- `from`, `to`
- `bucketMinutes`
- `tenantId` (UUID)

Example response:

```json
{
  "window": {
    "from": "2026-04-18T00:00:00.000Z",
    "to": "2026-04-19T00:00:00.000Z",
    "bucketMinutes": 60
  },
  "overview": {
    "telemetryPoints": 865,
    "activeUnitsInWindow": 18,
    "onlineUnitsCurrent": 16,
    "offlineUnitsCurrent": 2,
    "gasAlertSamples": 9,
    "shockSamples": 3,
    "firstPointAt": "2026-04-18T00:00:03.000Z",
    "lastPointAt": "2026-04-18T23:59:41.000Z",
    "latestTelemetryAt": "2026-04-19T00:00:11.000Z"
  },
  "metrics": {
    "avgTemperatureC": 6.9,
    "maxTemperatureC": 10.4,
    "avgHumidityPct": 57.1,
    "avgSpeedKph": 38.4
  },
  "trend": [
    {
      "bucketAt": "2026-04-18T01:00:00.000Z",
      "sampleCount": 37,
      "avgTemperatureC": 6.8,
      "maxTemperatureC": 7.2,
      "avgHumidityPct": 55.1,
      "avgSpeedKph": 40.0
    }
  ]
}
```

### GET /api/reports/alert-summary

Query params:

- `status`, `severity`
- `truckId`, `containerId`
- `from`, `to`
- `bucketMinutes`
- `tenantId`

### GET /api/reports/device-health-summary

Query params:

- `offlineMinutes` (default 15)
- `limit` (default 50, max 200)
- `tenantId`

Example response:

```json
{
  "generatedAt": "2026-04-19T02:08:39.218Z",
  "offlineThresholdMinutes": 15,
  "overview": {
    "trackedUnits": 25,
    "onlineUnits": 20,
    "offlineUnits": 5,
    "activeDevices": 50,
    "staleDevices": 7,
    "latestTelemetryAt": "2026-04-19T02:08:01.000Z"
  },
  "devicesByType": {
    "sensorNodes": 25,
    "gatewayNodes": 25
  },
  "offlineUnits": [
    {
      "tenantCode": "demo",
      "truckId": "TRUCK07",
      "containerId": "CONT07",
      "lastTelemetryAt": "2026-04-19T01:49:02.000Z",
      "minutesSinceLastTelemetry": 19.63
    }
  ]
}
```

### POST /api/reports/container-day-summary

Body params:

- `truckId` (required)
- `containerId` (required)
- `cargoType` (required)
- `day` (`YYYY-MM-DD`, optional; defaults to current UTC day)
- `bucketMinutes` (optional, default 15)
- `maxPoints` (optional, default 96)

Behavior:

- Fetches exactly one day of telemetry history for the selected truck/container.
- Aggregates telemetry into time buckets to keep AI input feasible.
- Uses Gemini (base64 key via `GEMINI_API_KEY_BASE64`) with rule-based fallback.
- Returns a single paragraph in `aiSummary.summary`.

Example response:

```json
{
  "truckId": "TRUCK01",
  "containerId": "CONT01",
  "cargoType": "PERISHABLE_FOOD",
  "window": {
    "day": "2026-04-19",
    "from": "2026-04-19T00:00:00.000Z",
    "to": "2026-04-20T00:00:00.000Z",
    "bucketMinutes": 15
  },
  "telemetry": {
    "sampleCount": 1242,
    "timelinePointsAnalyzed": 96,
    "occurredAtStart": "2026-04-19T00:00:04.000Z",
    "occurredAtEnd": "2026-04-19T23:59:52.000Z",
    "metrics": {
      "temperature": { "min": 4.2, "avg": 6.1, "max": 8.4 },
      "humidity": { "min": 52.0, "avg": 58.8, "max": 67.1 },
      "pressure": { "min": 1001.5, "avg": 1005.1, "max": 1010.0 },
      "speed": { "min": 0.0, "avg": 37.5, "max": 66.2 },
      "motion": { "shockCount": 3, "tiltMax": 8.1 },
      "gas": { "maxRaw": 1440, "avgRaw": 790.3, "gasAlertCount": 0 },
      "gps": { "fixRatePct": 97.5 }
    },
    "alerts": {
      "count": 1,
      "bySeverity": { "WARNING": 1 }
    }
  },
  "aiSummary": {
    "provider": "gemini",
    "model": "gemini-flash-lite-latest",
    "generatedAt": "2026-04-20T00:01:13.512Z",
    "summary": "The container carried perishable food under mostly stable thermal conditions..."
  }
}
```

## SQL Query Explanations

- Telemetry history uses `telemetry_history` + `(tenant_id, truck_id, container_id, occurred_at DESC)` index for bounded time windows and ordered scans.
- Bucketed trends use `date_bin(interval, occurred_at, anchor)` to aggregate directly in SQL and reduce API payload volume.
- Latest-only dashboard reads use `telemetry_latest` to avoid scanning append-only history for current status cards.
- Alert timeline/history uses `alerts.last_event_at` and `alert_events.event_at` indexes to support descending, recent-first retrieval.
- Device health summary uses age checks against `telemetry_latest.received_at` and `device_registry.last_seen_at`.

## Example SQL Snippets

### Hourly telemetry trend

```sql
SELECT
  date_bin('1 hour', th.occurred_at, TIMESTAMPTZ '1970-01-01') AS bucket_at,
  COUNT(*)::int AS sample_count,
  AVG(th.temperature_c)::numeric(10,2) AS avg_temperature_c,
  AVG(th.humidity_pct)::numeric(10,2) AS avg_humidity_pct
FROM telemetry_history th
WHERE th.tenant_id = $1
  AND th.occurred_at >= $2
  AND th.occurred_at <= $3
GROUP BY bucket_at
ORDER BY bucket_at ASC;
```

### Alerts by severity

```sql
SELECT
  a.severity,
  COUNT(*)::int AS count
FROM alerts a
WHERE a.tenant_id = $1
  AND a.last_event_at >= $2
  AND a.last_event_at <= $3
GROUP BY a.severity
ORDER BY a.severity;
```

### Devices offline in last N minutes

```sql
SELECT
  tr.truck_code,
  c.container_code,
  tl.received_at,
  ROUND((EXTRACT(EPOCH FROM (NOW() - tl.received_at)) / 60.0)::numeric, 2)
    AS minutes_since_last_telemetry
FROM telemetry_latest tl
JOIN trucks tr ON tr.id = tl.truck_id AND tr.tenant_id = tl.tenant_id
JOIN containers c ON c.id = tl.container_id AND c.tenant_id = tl.tenant_id
WHERE tl.tenant_id = $1
  AND (EXTRACT(EPOCH FROM (NOW() - tl.received_at)) * 1000) > ($2 * 60 * 1000)
ORDER BY tl.received_at ASC
LIMIT $3;
```

### Top containers with repeated alerts

```sql
SELECT
  tr.truck_code,
  c.container_code,
  COUNT(*)::int AS alert_count,
  MAX(a.last_event_at) AS last_alert_at
FROM alerts a
JOIN trucks tr ON tr.id = a.truck_id AND tr.tenant_id = a.tenant_id
JOIN containers c ON c.id = a.container_id AND c.tenant_id = a.tenant_id
WHERE a.tenant_id = $1
  AND a.last_event_at >= $2
  AND a.last_event_at <= $3
GROUP BY tr.truck_code, c.container_code
ORDER BY alert_count DESC, last_alert_at DESC
LIMIT 10;
```

## Migration Additions

`backend/migrations/002_reporting_performance_indexes.sql` adds:

- `idx_alerts_tenant_last_event`
- `idx_alerts_tenant_status_severity_last_event`
- `idx_alerts_tenant_container_last_event`
- `idx_alert_events_tenant_alert_time`
