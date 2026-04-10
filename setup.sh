#!/bin/bash
set -e

echo "1. Creating folder structure..."
mkdir -p mosquitto/config mosquitto/data mosquitto/log mosquitto/certs

echo "2. Generating self-signed certificates..."
# Generate CA
openssl req -new -x509 -days 3650 -extensions v3_ca -keyout mosquitto/certs/ca.key -out mosquitto/certs/ca.crt -nodes -subj "/C=US/ST=State/L=City/O=LogisticsCo/CN=MosquittoCA"

# Generate Server Key & CSR
openssl genrsa -out mosquitto/certs/server.key 2048
openssl req -new -key mosquitto/certs/server.key -out mosquitto/certs/server.csr -subj "/C=US/ST=State/L=City/O=LogisticsCo/CN=localhost"

# Generate Server Cert signed by CA
openssl x509 -req -in mosquitto/certs/server.csr -CA mosquitto/certs/ca.crt -CAkey mosquitto/certs/ca.key -CAcreateserial -out mosquitto/certs/server.crt -days 3650

# Ensure permissions are open enough for mosquitto user inside the container
chmod 644 mosquitto/certs/server.key mosquitto/certs/server.crt mosquitto/certs/ca.crt || true

echo "3. Generating Mosquitto password file..."
touch mosquitto/config/passwd

# Using docker to run mosquitto_passwd to avoid requiring local installation
# Format: mosquitto_passwd -b [file] [user] [pass]
docker run --rm -v "$(pwd)/mosquitto/config:/mosquitto/config" eclipse-mosquitto:2 mosquitto_passwd -b -c /mosquitto/config/passwd cargo_device your_password
docker run --rm -v "$(pwd)/mosquitto/config:/mosquitto/config" eclipse-mosquitto:2 mosquitto_passwd -b /mosquitto/config/passwd cargo_dashboard dashboard_password
echo "Passwords created! (cargo_device / your_password) & (cargo_dashboard / dashboard_password)"

echo "4. Starting the Mosquitto broker container..."
docker compose up -d

echo "✅ Setup complete! MQTT Broker is running."
