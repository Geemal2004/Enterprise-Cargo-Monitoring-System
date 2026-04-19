#!/bin/bash
set -e

echo "1. Validating root .env..."
if [ ! -f .env ]; then
	echo "Missing .env file. Copy .env.example to .env and set EMQX credentials first."
	exit 1
fi

if ! grep -q "MQTT_BROKER_HOST=" .env; then
	echo "MQTT_BROKER_HOST must be set in .env"
	exit 1
fi

if ! grep -q "DATABASE_URL=" .env; then
	echo "DATABASE_URL must be set in .env"
	exit 1
fi

if ! grep -q "JWT_ACCESS_SECRET=" .env; then
	echo "JWT_ACCESS_SECRET must be set in .env"
	exit 1
fi

if ! grep -q "JWT_REFRESH_SECRET=" .env; then
	echo "JWT_REFRESH_SECRET must be set in .env"
	exit 1
fi

echo "2. Starting backend and frontend containers..."
docker compose up -d

echo "3. Verifying service status..."
docker compose ps

echo "Setup complete. Frontend should be reachable on FRONTEND_PORT and backend on BACKEND_PORT."
