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
3. If using CA mount, set:
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
3. Check latest telemetry:
   - GET http://localhost:5000/api/latest
4. Open frontend dashboard:
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
