# Smart Cargo Monitoring Backend

Node.js + Express backend for telemetry ingestion from EMQX Serverless over TLS.

## Features

- MQTT TLS consumer using mqtt.js
- Subscribes to tenant/+/truck/+/container/+/telemetry
- Validates telemetry JSON payloads
- Keeps latest telemetry in memory by truckId::containerId
- Computes alerts:
  - Temperature above 35C
  - Gas mq2Raw above 1500
  - Shock detected
  - Offline if no update for 30 seconds
- REST APIs:
  - GET /api/latest
  - GET /api/latest/:truckId/:containerId
  - GET /api/alerts
  - GET /api/health
- Background offline scanner refreshes alert state every few seconds

## Environment setup

Copy .env.example to .env and update values.

## Run locally

1. Install dependencies

   npm install

2. Start server

   npm run dev

3. Production start

   npm start

Backend listens on PORT (default 5000).

## MQTT topic expectation

The backend consumes:

- tenant/{tenantId}/truck/{truckId}/container/{containerId}/telemetry

and validates message body for required fields:

- env.temperatureC
- gas.mq2Raw
- motion.shock
