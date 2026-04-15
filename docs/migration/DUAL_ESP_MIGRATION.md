# Dual-ESP Smart Cargo Migration

## 1. Reusable files from old repo

The following modules were adapted instead of rewritten:

- `backend/src/server.js`
- `backend/src/db.js`
- `backend/src/routes/authRoutes.js`
- `backend/src/middleware/authMiddleware.js`
- `frontend/src/main.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Dashboard.jsx` (kept layout, updated thresholds/labels)
- `frontend/src/pages/AlertsHistory.jsx` (kept table flow, updated identity field)
- `frontend/src/store/useStore.js` (added schema normalization layer)
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`

## 2. Migration plan (adapt-first)

1. Freeze canonical contracts:
   - ESP-NOW `CargoPacket`
   - MQTT topic: `tenant/{tenantId}/truck/{truckId}/container/{containerId}/telemetry`
   - Canonical JSON payload
2. Split firmware by responsibility:
   - Container node: sensor read + SD + ESP-NOW TX
   - Gateway node: ESP-NOW RX + GPS + SIM800L Mobitel + MQTT TLS publish
3. Replace broker runtime from local Mosquitto to EMQX Serverless config.
4. Upgrade backend ingestion to parse canonical topic/payload and persist by `device_key = truckId/containerId`.
5. Apply MVP alert rules in backend:
   - `temperatureC > 35.0`
   - `gasRaw > 1500`
   - `shock == true`
   - no telemetry `> 30s` (offline)
6. Preserve frontend shell and routes, adapt data layer with normalization to avoid full UI rewrite.
7. Remove legacy single-board firmware entrypoint and Mosquitto-specific setup scripts.

## 3. Telemetry schema update

Old key fields:
- `device_id, temp, hum, vib_score, ac_alert, lat, lon, sd_status`

New persisted telemetry fields:
- `device_key, tenantId, fleetId, truckId, containerId`
- `gatewayMac, sensorNodeMac, seq`
- `gps.{lat, lon, speedKph}`
- `env.{temperatureC, humidityPct, pressureHpa}`
- `motion.{tiltDeg, shock}`
- `gas.{mq2Raw, alert}`
- `status.{sdOk, gpsFix, uplink}`
- `ts, received_at`

Compatibility note:
- Frontend consumes canonical schema fields directly (`env`, `motion`, `gas`, `gps`, `status`) with only default-value normalization.

## 4. Final repo tree (post-migration)

```text
.
├── backend/
│   └── src/
│       ├── db.js
│       ├── middleware/
│       │   └── authMiddleware.js
│       ├── models/
│       │   ├── Alert.js
│       │   ├── Telemetry.js
│       │   └── User.js
│       ├── mqttHandler.js
│       ├── routes/
│       │   ├── alertRoutes.js
│       │   ├── authRoutes.js
│       │   ├── deviceRoutes.js
│       │   └── telemetryRoutes.js
│       └── server.js
├── docs/
│   └── migration/
│       └── DUAL_ESP_MIGRATION.md
├── firmware/
│   ├── container-node/
│   │   ├── CargoPacket.h
│   │   └── cargo_container_s3.ino
│   └── gateway-node/
│       ├── CargoPacket.h
│       └── cargo_gateway_esp32.ino
├── frontend/
│   └── src/
│       ├── components/
│       │   └── Layout.jsx
│       ├── pages/
│       │   ├── AlertsHistory.jsx
│       │   ├── Dashboard.jsx
│       │   └── Login.jsx
│       └── store/
│           └── useStore.js
├── docker-compose.yml
├── setup.sh
└── .env.template
```

## 5. Breaking changes

1. MQTT broker model changed:
   - Local Mosquitto container removed from compose workflow.
   - Backend now expects external EMQX Serverless TLS endpoint.
2. MQTT topic changed:
   - From legacy `logistics_co/...`
   - To canonical `tenant/.../truck/.../container/.../telemetry`
3. Telemetry identity changed:
   - From `device_id`
   - To `device_key` (`truckId/containerId`) + explicit `truckId`/`containerId`
4. Alert types changed:
   - Legacy acoustic/vibration thresholds removed
   - New `temperature`, `gas`, `impact`, `offline`
5. Firmware entrypoint changed:
   - Legacy single-board `cargo_monitor_phase1.ino` removed
   - Split into container and gateway firmware modules
6. Environment variable keys changed:
   - `MQTT_BROKER` / `MQTT_USER` -> `MQTT_BROKER_URL` / `MQTT_USERNAME`
   - Added `MQTT_TLS_ENABLED` and `MQTT_REJECT_UNAUTHORIZED`

## 6. Changed files summary

- `docker-compose.yml`
- `.env.template`
- `.gitignore`
- `setup.sh`
- `backend/.env.example`
- `backend/src/models/Telemetry.js`
- `backend/src/models/Alert.js`
- `backend/src/models/User.js`
- `backend/src/mqttHandler.js`
- `backend/src/routes/telemetryRoutes.js`
- `backend/src/routes/deviceRoutes.js`
- `backend/src/routes/alertRoutes.js`
- `frontend/src/store/useStore.js`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/AlertsHistory.jsx`
- `cargo_monitor_phase1.ino` (deleted)
- `firmware/container-node/CargoPacket.h` (new)
- `firmware/container-node/cargo_container_s3.ino` (new)
- `firmware/gateway-node/CargoPacket.h` (new)
- `firmware/gateway-node/cargo_gateway_esp32.ino` (new)
