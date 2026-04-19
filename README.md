# Smart Cargo Monitoring System Integration

This repository is integrated as two local services:

- Backend: Node.js + Express + mqtt.js
- Frontend: React + Vite served by Nginx

EMQX Serverless is external and is not containerized here.

## Deliverables in this integration layer

- docker-compose.yml for backend + frontend
- backend Dockerfile
- frontend Dockerfile
- frontend Nginx API proxy config
- root and service env examples
- local and docker helper scripts

## Services and API path

Frontend calls a simple API base URL:

- Docker: /api (proxied by Nginx to backend:5000)
- Local dev: http://localhost:5000/api

## Environment file ownership

- Root `.env`:
   - Canonical env source for `docker-compose.yml`.
   - Contains backend runtime variables used in containerized runs.
   - Includes required JWT variables (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
- Root `.env.example`:
   - Template for root `.env`.
- `backend/.env` and `backend/.env.example`:
   - Used only for standalone backend runs (`cd backend && npm run dev`).
- `frontend/.env` and `frontend/.env.example`:
   - Used only for standalone frontend Vite runs (`cd frontend && npm run dev`).

## SQL source of truth

- Canonical schema and seed files are:
   - `database/schema.sql`
   - `database/seed.sql`
- Backend keeps mirrored runtime copies for migration tooling and container packaging:
   - `backend/migrations/001_initial_schema.sql`
   - `backend/seeds/001_demo_seed.sql`
- Sync mirrors from canonical source:
   - PowerShell: `./scripts/sync-db-sql.ps1`
   - Bash: `./scripts/sync-db-sql.sh`

## EMQX CA certificate mount (backend container)

docker-compose.yml mounts a host directory into backend:

- Host directory: EMQX_CA_CERT_DIR (default ./certs)
- Container directory: /run/certs

To use certificate pinning/validation with a downloaded CA file:

1. Place certificate file at ./certs/emqx-ca.crt
2. Set MQTT_CA_PATH=/run/certs/emqx-ca.crt in root .env
3. Start containers with docker compose

If MQTT_CA_PATH is empty, backend runs without a mounted custom CA path.

## Scripts

PowerShell:

- scripts/dev-local.ps1
- scripts/dev-docker.ps1

Bash:

- scripts/dev-local.sh
- scripts/dev-docker.sh

## Clear boot order

1. Create EMQX deployment
2. Download CA cert
3. Set env vars
4. Start backend
5. Start frontend
6. Flash firmware
7. Test publish path

## Boot order details

### 1) Create EMQX deployment

Create your EMQX Serverless deployment and copy:

- Broker host
- Port (typically 8883)
- Username
- Password

### 2) Download CA cert

Download the EMQX CA certificate and save it as:

- certs/emqx-ca.crt

### 3) Set env vars

1. Copy root env template:
   - Copy .env.example to .env
2. Fill EMQX values in .env:
   - MQTT_BROKER_HOST
   - MQTT_BROKER_PORT
   - MQTT_USERNAME
   - MQTT_PASSWORD
3. Fill JWT values in .env:
   - JWT_ACCESS_SECRET (>= 32 chars)
   - JWT_REFRESH_SECRET (>= 32 chars)
   - Optional: JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
4. If using CA mount, set:
   - MQTT_CA_PATH=/run/certs/emqx-ca.crt

### 4) Start backend

Local:

- cd backend
- npm install
- npm run dev

Docker:

- docker compose up --build backend

### 5) Start frontend

Local:

- cd frontend
- npm install
- npm run dev

Docker:

- docker compose up --build frontend

### 6) Flash firmware

Flash container and gateway firmware with matching IDs/topic and EMQX credentials.

### 7) Test publish path

1. Confirm gateway logs show successful MQTT publish.
2. Check backend health:
   - GET http://localhost:5000/api/health
3. Authenticate and capture token:
   - POST http://localhost:5000/api/auth/login
4. Check latest telemetry with bearer token:
   - GET http://localhost:5000/api/latest
5. Open frontend dashboard:
   - http://localhost

## One-command helper usage

PowerShell local dev:

- ./scripts/dev-local.ps1

PowerShell docker dev:

- ./scripts/dev-docker.ps1

Bash local dev:

- ./scripts/dev-local.sh

Bash docker dev:

- ./scripts/dev-docker.sh
