# Smart Cargo Monitoring Backend (Enterprise)

Production-style Node.js + Express backend for Smart Cargo Monitoring with:

- EMQX Serverless MQTT TLS ingestion
- PostgreSQL persistence for telemetry, alerts, admin entities
- Service/repository architecture with background jobs
- JWT authentication with refresh tokens and tenant-aware RBAC
- REST APIs for dashboard + admin operations

## Project structure

```
backend/
   migrations/
      001_initial_schema.sql
   seeds/
      001_demo_seed.sql
   src/
      config/
         env.js
         logger.js
      db/
         pool.js
         transaction.js
         migrator.js
         migrate.js
         seed.js
      mqtt/
         client.js
         topicParser.js
      repositories/
         adminRepository.js
         alertRulesRepository.js
         alertsRepository.js
         assetRepository.js
         auditRepository.js
         authRepository.js
         reportsRepository.js
         telemetryRepository.js
      services/
         adminService.js
         alertEngineService.js
         alertsService.js
         authService.js
         fleetService.js
         reportsService.js
         runtimeState.js
         telemetryIngestService.js
      routes/
         adminRoutes.js
         alertsRoutes.js
         authRoutes.js
         fleetRoutes.js
         healthRoutes.js
         index.js
         reportsRoutes.js
         telemetryRoutes.js
      middleware/
         authMiddleware.js
         errorHandler.js
         requestContext.js
      jobs/
         offlineScannerJob.js
      validators/
         historyQueryValidator.js
         telemetryValidator.js
      utils/
         appError.js
         asyncHandler.js
         passwordPolicy.js
         time.js
      app.js
      server.js
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- EMQX Serverless MQTT endpoint

## Environment setup

1. Copy `.env.example` to `.env`
2. Fill PostgreSQL, EMQX, and JWT credentials
3. Ensure the MQTT topic filter remains:
    - `tenant/+/truck/+/container/+/telemetry`

Required JWT variables:

- `JWT_ACCESS_SECRET` (>= 32 characters)
- `JWT_REFRESH_SECRET` (>= 32 characters)
- `JWT_ACCESS_EXPIRES_IN` (default: `15m`)
- `JWT_REFRESH_EXPIRES_IN` (default: `7d`)
- `JWT_ISSUER` (default: `smart-cargo-backend`)
- `JWT_AUDIENCE` (default: `smart-cargo-api`)

AI summary variables (Gemini):

- `GEMINI_API_KEY_BASE64` (required for Gemini output; keep base64-encoded)
- `GEMINI_MODEL` (default: `gemini-flash-lite-latest`)
- `GEMINI_API_BASE_URL` (default: `https://generativelanguage.googleapis.com/v1beta`)
- `AI_TRIP_SUMMARY_ENABLED` (default: `true`)
- `AI_DAILY_SUMMARY_ENABLED` (default: `true`)
- `AI_DAILY_SUMMARY_TIMEOUT_MS` (default: `15000`)
- `AI_DAILY_SUMMARY_MAX_POINTS` (default: `96`)
- `AI_DAILY_SUMMARY_BUCKET_MINUTES` (default: `15`)
- `AI_DAILY_SUMMARY_SYSTEM_PROMPT` (optional override for system prompt)

Note:

- `backend/.env` is for standalone backend runs only.
- Docker Compose runs use root `.env` in the repository root.

## SQL source-of-truth and mirrors

Canonical SQL files:

- `../database/schema.sql`
- `../database/seed.sql`

Backend runtime mirror files (used by migration runner and container packaging):

- `migrations/001_initial_schema.sql`
- `seeds/001_demo_seed.sql`

When canonical SQL changes, sync mirror files:

- PowerShell: `../scripts/sync-db-sql.ps1`
- Bash: `../scripts/sync-db-sql.sh`

## Database bootstrap (migration-based)

1. Install dependencies:

```bash
npm install
```

2. Run schema migrations:

```bash
npm run db:migrate
```

3. Seed baseline demo data:

```bash
npm run db:seed
```

Optional auto-run flags at startup:

- `RUN_MIGRATIONS_ON_BOOT=true`
- `RUN_SEEDS_ON_BOOT=true`

## Run backend

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## MQTT ingest flow

1. Backend connects to EMQX over TLS (`mqtts`) using env credentials.
2. Subscribes to: `tenant/+/truck/+/container/+/telemetry`
3. Each message is queued through a bounded concurrent ingest queue.
4. Topic is parsed to extract tenant/truck/container codes.
5. Payload is validated (`env.temperatureC`, `gas.mq2Raw`, `motion.shock` required).
6. Tenant/fleet/truck/container references are resolved from PostgreSQL.
7. In one transaction:
    - insert into `telemetry_history`
    - upsert into `telemetry_latest`
    - evaluate/open/update/resolve alerts
    - write `alert_events` on state transitions

This keeps MQTT handling non-blocking and isolates DB-heavy logic in service/repository layers.

## Alert engine design

Implemented rules:

- `HIGH_TEMPERATURE`: open/update when `env.temperatureC > threshold`
- `GAS_SPIKE`: open/update when `gas.mq2Raw > threshold`
- `SHOCK_DETECTED`: open/update when `motion.shock == true`
- `GPS_LOST`: open/update when `gpsFix == false`
- `OFFLINE`: opened by scanner when no telemetry for `OFFLINE_THRESHOLD_MS`

Resolution behavior:

- High temperature, gas spike, gps lost, offline auto-resolve when condition clears.
- Shock auto-resolve controlled by `ALERT_AUTO_RESOLVE_SHOCK` (default false).

Rule sources:

- Uses `alert_rules` rows when configured/enabled.
- Falls back to env defaults when no rule exists.

## Offline scanner job

- Runs every `OFFLINE_SCAN_INTERVAL_MS`.
- Scans `telemetry_latest` for stale units.
- Opens/updates `OFFLINE` alerts transactionally.

## REST API endpoints

Authentication:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`

Public endpoint:

- `GET /api/health`

All other endpoints require `Authorization: Bearer <accessToken>`.

Telemetry and dashboard:

- `GET /api/fleet/summary`
- `GET /api/fleet/units`
- `GET /api/trucks/:truckId/containers/:containerId/latest`
- `GET /api/trucks/:truckId/containers/:containerId/history`
- `GET /api/alerts`
- `GET /api/alerts/:alertId/events`
- `GET /api/alerts/history`
- `PATCH /api/alerts/:alertId` (body: action=ACKNOWLEDGE|RESOLVE, optional message)
- `GET /api/reports/fleet-summary`
- `GET /api/reports/alert-summary`
- `GET /api/reports/device-health-summary`
- `POST /api/reports/container-day-summary` (body: truckId, containerId, cargoType, day)

Admin and business:

- `GET /api/admin/tenants`
- `GET /api/admin/roles`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`
- `GET /api/admin/device-registry`
- `GET /api/admin/audit-logs`

Compatibility endpoints retained for existing frontend:

- `GET /api/latest`
- `GET /api/latest/:truckId/:containerId`
- `GET /api/history/:truckId/:containerId`
- `GET /api/history?truckId=...&containerId=...`
- `GET /api/telemetry/history/:truckId/:containerId`

## RBAC model

- `super_admin`: full cross-tenant access.
- `tenant_admin`: tenant-scoped user/admin management and read/write alert operations.
- `fleet_manager`: tenant-scoped telemetry/fleet/alert reads and alert state transitions.
- `viewer`: tenant-scoped read-only access.

Note: `admin` role is still accepted for backward compatibility and treated as tenant admin scope.

Tenant scope rules:

- Non-super users are automatically constrained to their own tenant.
- Super admins may query across tenants by setting `tenantCode`.
- Cross-tenant requests by non-super users are rejected with `403`.

## History query parameters

`GET /api/trucks/:truckId/containers/:containerId/history`

- `from` (ISO timestamp)
- `to` (ISO timestamp)
- `limit` (clamped by `HISTORY_MAX_LIMIT`)
- `bucketMinutes` (chart bucket size in minutes)
- `interval` (`5m`, `15m`, `1h`, or text like `5 minutes`)

Behavior:

- Without `bucketMinutes/interval`: raw time-ordered points.
- With `bucketMinutes` or `interval`: bucketed/aggregated points optimized for charts.

`GET /api/alerts/history` query params:

- `status` (CSV: `OPEN,ACKNOWLEDGED,RESOLVED`)
- `severity` (CSV: `INFO,WARNING,CRITICAL`)
- `tenantId` (UUID, super admin support)
- `truckId`
- `containerId`
- `from`
- `to`
- `limit` (clamped by `HISTORY_MAX_LIMIT`)

`GET /api/reports/*` query params:

- `tenantId` (UUID, optional for super admin)
- `from` and `to` for time-windowed summaries (fleet/alert)
- `bucketMinutes` for timeline series density (fleet/alert)
- `offlineMinutes` and `limit` for device health summary

## Operational notes

- Admin write operations and password resets generate `audit_logs` entries.
- Alert transitions and ingestion writes run in DB transactions.
- Runtime health includes DB status, MQTT status, queue backlog, and offline scanner telemetry.

Detailed reporting query explanations and response examples:

- `docs/reporting-and-history-apis.md`
