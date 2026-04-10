---
name: esp32s3-cargo-monitor
description: >
  Full-stack IoT cargo monitoring system built on the ESP32-S3 N16R8. Use this
  skill whenever the user asks about any part of this project — firmware,
  wiring, sensors, MQTT, backend, frontend, Docker, or debugging. Covers Phase 1
  bench validation (Wi-Fi + local MQTT) through to Phase 3 MVP (4G LTE + MQTTS +
  React dashboard). Trigger this skill for any question involving: ESP32-S3
  cargo monitor, DHT22, MPU6050, KY-037, NEO-M8N GPS, Mosquitto broker, cargo
  telemetry, vibration scoring, acoustic anomaly detection, SD card buffer,
  Node.js telemetry API, Socket.io live dashboard, Leaflet GPS map, or the
  docker-compose stack for this project. Even if the user only mentions one
  component (e.g. "fix my GPS code" or "why is my SD card failing"), use this
  skill — it contains the authoritative pin assignments, payload schema, and
  architectural decisions that must stay consistent across all components.
---

# ESP32-S3 Acoustic Edge AI Cargo Monitor

End-to-end IIoT cargo monitoring system. Three deployment phases:

| Phase | Name | Connectivity | Power | Security |
|-------|------|-------------|-------|----------|
| 1 | Bench | Wi-Fi + local MQTT | USB 5V | No auth |
| 2 | Prototype | 4G SIM7600 | 3.7V LiPo + bench supply | MQTT user/pass |
| 3 | MVP | 4G + MQTTS | LiPo + MP1584 buck (IP67) | X.509 certs |

**Current status: Phase 1 complete and validated.**

---

## Hardware

| Component | Model | Role |
|-----------|-------|------|
| MCU | ESP32-S3 N16R8 | Dual-core 240MHz, 16MB Flash, 8MB OPI PSRAM |
| IMU | MPU6050 | 6-axis vibration RMS scoring |
| Climate | DHT22 | Temp ±0.5°C, humidity |
| Microphone | KY-037 | Analog (AO) + digital threshold (DO) output |
| GPS | NEO-M8N | UART1, TinyGPS++, 4-decimal precision |
| Storage | MicroSD (SPI) | Offline circular buffer — 1000 record limit |
| Alert | Active buzzer | NPN-driven if >30mA draw |

### Confirmed GPIO pinout (do NOT change without updating all layers)

| GPIO | Signal | Module | Protocol | Notes |
|------|--------|--------|----------|-------|
| 4 | MIC_AO | KY-037 AO | ADC | Analog audio level |
| 5 | MIC_DO | KY-037 DO | Digital in | Hardware threshold trigger |
| 6 | DHT_DATA | DHT22 | 1-wire | 10kΩ pull-up to 3.3V required |
| 7 | BUZZER | Active buzzer | Digital out | Via S8050 NPN + 1kΩ base resistor |
| 8 | I2C_SDA | MPU6050 | I2C | 4.7kΩ pull-up to 3.3V |
| 9 | I2C_SCL | MPU6050 | I2C | 4.7kΩ pull-up to 3.3V |
| 10 | SD_CS | MicroSD | SPI | |
| 11 | SD_MOSI | MicroSD | SPI | |
| 12 | SD_MISO | MicroSD | SPI | |
| 13 | SD_SCK | MicroSD | SPI | |
| 18 | GPS_TX (UART1 TX) | NEO-M8N RX | UART1 9600 | |
| 19 | GPS_RX (UART1 RX) | NEO-M8N TX | UART1 9600 | |

**Phase 2 reserved — never use in Phase 1 firmware:**
- GPIO 4 → SIM7600 PWRKEY (conflict with KY-037 AO — must remap mic before Phase 2)
- GPIO 5 → SIM7600 RESET
- GPIO 16 → SIM7600 UART2 RX
- GPIO 17 → SIM7600 UART2 TX

### Arduino IDE board settings for ESP32-S3 N16R8

| Setting | Value |
|---------|-------|
| Board | ESP32S3 Dev Module |
| Flash Size | 16MB (128Mb) |
| Partition Scheme | Huge APP (3MB No OTA/1MB SPIFFS) |
| PSRAM | **OPI PSRAM** ← critical, wrong value = boot hang |
| USB CDC On Boot | Disabled |
| Upload Mode | UART0 / Hardware CDC |
| Flash Mode | QIO 80MHz |
| CPU Frequency | 240MHz |

---

## Canonical JSON Telemetry Payload

Every layer of the stack (firmware, MQTT, backend, frontend) uses this exact schema:

```json
{
  "device_id": "ESP32-S3-BENCH-01",
  "temp": 30.30,
  "hum": 99.90,
  "vib_score": 0,
  "ac_alert": true,
  "lat": 6.6896,
  "lon": 80.0370,
  "sd_status": "OK",
  "ts": "2026-04-01T18:43:49Z"
}
```

- All floats: 2 decimal places
- GPS: 4 decimal places (Phase 1); truncate to 2 in Phase 2 to save cellular bytes
- `ts`: ISO 8601 UTC from GPS clock; fallback to `1970-01-01T{millis/1000}Z` when no fix
- `vib_score`: 0–100 integer (RMS normalised)
- `ac_alert`: boolean

---

## MQTT Architecture

### Topic hierarchy
```
logistics_co/{vehicle_id}/telemetry    ← QoS 1, all telemetry
logistics_co/{vehicle_id}/alerts       ← QoS 2, retain=true, alert events only
```

Example device: `logistics_co/truck_01/telemetry`

### Broker

**Phase 1:** Self-hosted Mosquitto 2.x via Docker on local network
- Port 1883 (MQTT, authenticated)
- Port 8883 (MQTTS/TLS, self-signed cert)
- Port 9001 (WebSocket)
- Users: `cargo_device` (publish), `cargo_dashboard` (subscribe)
- Anonymous access: disabled

**Phase 3:** MQTTS port 8883 with X.509 mutual auth, unique cert per device

### Firmware MQTT credentials
```cpp
#define MQTT_BROKER   "192.168.x.x"   // Docker host LAN IP
#define MQTT_PORT     1883
#define MQTT_USER     "cargo_device"
#define MQTT_PASSWORD "your_password"
```
Connection call: `mqtt.connect(clientId, MQTT_USER, MQTT_PASSWORD)`

---

## Firmware Architecture

**File:** `cargo_monitor_phase1.ino`

**Required libraries (Arduino Library Manager):**
- DHT sensor library (Adafruit)
- Adafruit Unified Sensor (Adafruit)
- MPU6050 (Electronic Cats)
- TinyGPS++ (Mikal Hart)
- PubSubClient (Nick O'Leary)
- ArduinoJson (Benoit Blanchon)
- SD (built-in)

**30-second duty cycle:**
1. Wake / re-init buses
2. Sample MPU6050 @ 1kHz (100 samples), KY-037, DHT22, GPS
3. Compute vibration RMS → normalise 0–100
4. Acoustic baseline vs spike ratio check + DO pin check
5. Threshold gates (temp, acoustic)
6. Build JSON payload
7. SD log (if mounted)
8. MQTT publish QoS 1 (or buffer to SD if offline)
9. Flush SD buffer on reconnect

### Sensor algorithms

**Vibration RMS (MPU6050):**
```
rms = sqrt(mean(ax² + ay² + az²))   // raw /16384 → g
score = clamp((rms - 1.0) / 2.0 * 100, 0, 100)
```
Score = 0 at rest (gravity = ~1g). Tap sensor to verify it rises.

**Acoustic anomaly (KY-037):**
- Phase A (256 samples): establish baseline ADC average
- Phase B (256 samples): watch for spike > `ACOUSTIC_ALERT_RATIO × baseline`
- Also triggers if DO pin is HIGH
- Tune: rotate onboard pot clockwise to reduce DO sensitivity

**GPS validation gates:**
- `gps.location.isValid()` must be true
- `gps.location.age()` must be < 5000ms
- NMEA checksum verified by TinyGPS++ automatically

### Calibration constants (tune per deployment)
```cpp
#define TEMP_ALERT_THRESHOLD   8.0f    // °C — pharma cold-chain
// For bench testing in warm room use 40.0f

#define ACOUSTIC_ALERT_RATIO   1.5f    // spike/baseline multiplier
#define VIB_SAMPLE_COUNT       100     // MPU samples per cycle
#define SD_MAX_RECORDS         1000    // circular buffer limit
```

### Known Phase 1 issues and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ESP-ROM:esp32s3-20210327` then nothing | Wrong USB port or blank flash | Use UART port; hold BOOT + tap RESET then upload |
| Serial stops after ROM line | PSRAM set to wrong type | Set PSRAM → OPI PSRAM in Arduino IDE |
| DHT22 returns NaN | Missing 10kΩ pull-up | Add pull-up resistor DATA→3.3V |
| KY-037 always TRIG | Pot sensitivity too high | Turn pot clockwise until DO goes LOW at room noise |
| SD Card: FAIL | MOSI/MISO swapped or wrong format | Verify GPIO 11=MOSI 12=MISO; format card FAT32 |
| Vib Score always 0 | Board is stationary | Correct — tap MPU6050 to verify it rises |
| Temp alert in warm room | Threshold set to 8°C pharma mode | Change TEMP_ALERT_THRESHOLD to 40.0f for bench |

---

## Backend (Node.js + Express + MongoDB)

**Port:** 5000
**DB:** MongoDB 7, collection `telemetry` and `alerts`

### REST endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | None | Returns JWT |
| GET | /api/devices | JWT | All devices (super_admin) or assigned (client) |
| GET | /api/telemetry/:device_id | JWT | Last 200 records; ?from=&to= |
| GET | /api/telemetry/:device_id/latest | JWT | Single latest record |
| GET | /api/alerts/:device_id | JWT | Alert history |

### Alert thresholds (backend evaluation)
```js
temp > 8.0          → pharmaceutical alert
ac_alert === true   → acoustic alert
vib_score > 75      → vibration alert
```

### RBAC roles
- `super_admin` — full fleet visibility
- `client` — read-only, own shipment device IDs only

### Socket.io events emitted
```
room: device_id
  event "telemetry"  → full payload object
  event "alert"      → { device_id, type, value, threshold, ts }
```

---

## Frontend (React 18 + Vite)

**Port:** 80 (Nginx, proxies /api and /socket.io to backend:5000)

### Pages
- `/login` — JWT auth form
- `/dashboard` — live status cards, alert banner, map, charts
- `/alerts` — alert history table

### Key libraries
- `recharts` — temp/humidity/vibration time-series charts (last 200 points)
- `react-leaflet` / `leaflet` — live GPS map with device marker
- `socket.io-client` — real-time telemetry + alert toasts
- `axios` — REST calls
- `zustand` — global state (auth, selected device, telemetry buffer)

### Live data flow
1. On device select → fetch `/api/telemetry/:device_id` (200 points)
2. Join Socket.io room for device_id
3. On `telemetry` event → append to chart buffer, update status cards, update map marker
4. On `alert` event → show toast + update alert banner

---

## Docker Stack

```
docker-compose.yml
├── mosquitto    — MQTT broker (ports 1883, 8883, 9001)
├── mongodb      — MongoDB 7 (internal only, port 27017)
├── backend      — Node.js Express (port 5000)
└── frontend     — React via Nginx (port 80)
```

Nginx proxies:
- `/api/*` → `http://backend:5000/api/*`
- `/socket.io/*` → `http://backend:5000/socket.io/*`

Environment variables (`.env`):
```
MQTT_BROKER=mosquitto
MQTT_PORT=1883
MQTT_USER=cargo_dashboard
MQTT_PASSWORD=
MONGO_URI=mongodb://mongodb:27017/cargo_monitor
JWT_SECRET=
```

---

## Phase 2 Readiness Checklist (before adding SIM7600)

- [ ] Remap KY-037 AO off GPIO 4 (→ any free ADC pin, e.g. GPIO 3)
- [ ] Remap KY-037 DO off GPIO 5 (→ e.g. GPIO 46)
- [ ] Wire SIM7600: TX2=GPIO17, RX2=GPIO16, PWRKEY=GPIO4, RESET=GPIO5
- [ ] Add MP1584 buck converter: set to 4.0V for SIM7600 rail
- [ ] Add 220µF + 100nF caps at SIM7600 VCC input
- [ ] Switch MQTT to MQTTS port 8883 with user/pass auth
- [ ] Update GPS precision: truncate lat/lon to 2 decimal places

## Phase 3 Readiness Checklist (MVP)

- [ ] Replace MQTT user/pass with X.509 mutual TLS certificates
- [ ] Enable GZIP compression on SD card offline buffer
- [ ] Implement "Burst-Resync" on reconnect (alerts first, then telemetry)
- [ ] Seal unit in IP67 polycarbonate enclosure with cable glands
- [ ] Add DS18B20 waterproof probe for liquid temperature (pharma)
- [ ] Add SHA-256 hashing of critical payloads → TRACE Blockchain push
- [ ] Verify external antenna: CSQ ≥ 18 (–77 dBm) inside sealed metal container