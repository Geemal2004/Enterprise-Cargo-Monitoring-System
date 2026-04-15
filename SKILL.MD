---
name: smart-cargo-monitor-dual-esp32
description: >
  Enterprise-style smart cargo monitoring and logistics management system built
  on a dual-ESP architecture: ESP32-S3 N16R8 sensor node inside the cargo
  container and ESP32-WROOM-32/N4 gateway node inside the truck cabin. Use this
  skill whenever the user asks about any part of this project — firmware,
  wiring, ESP-NOW, GSM, GPS, MQTT, EMQX OSS, backend, frontend, Docker, or
  debugging. Covers the current rapid MVP implementation using Arduino firmware,
  SIM800L, NEO-M8N, AHT10, BMP180, MPU6050, MQ2, SD card logging, Node.js
  backend, React dashboard, and Docker-based EMQX stack. Trigger this skill for
  any question involving: Smart Cargo Monitoring System, ESP32-S3 N16R8,
  ESP32-WROOM-32, ESP-NOW cargo telemetry, SIM800L Mobitel MQTT uplink,
  NEO-M8N GPS, EMQX OSS, real-time cargo dashboard, container environmental
  monitoring, truck cabin gateway, alert thresholds, SD offline logging, or the
  docker-compose stack for this project. Even if the user only mentions one
  component (e.g. "fix my ESP-NOW code" or "why is SIM800L resetting"), use this
  skill — it contains the authoritative hardware split, pin assignments, payload
  schema, topic hierarchy, and implementation scope that must stay consistent
  across all layers.
---

# Smart Cargo Monitoring System — Dual ESP32 Architecture

Enterprise-style IoT cargo monitoring and logistics platform using:

- **ESP32-S3 N16R8** as the **container sensor node**
- **ESP32-WROOM-32 / N4** as the **truck cabin gateway**
- **ESP-NOW** between the two ESP devices
- **SIM800L v2.2** + **NEO-M8N** on the cabin gateway
- **EMQX OSS** as the MQTT broker
- **Node.js + React + Docker** for platform software

This skill replaces the old single-board Wi-Fi-only cargo monitor design.

---

## Current implementation mode

### Current target: 48-hour MVP / demo-first build

The project is currently being implemented under a short deadline. The success
criteria are:

1. Container node reads core sensors
2. Container node logs to SD card
3. Container node sends compact telemetry to cabin node using ESP-NOW
4. Cabin node adds GPS location
5. Cabin node publishes MQTT via SIM800L to EMQX OSS
6. Backend receives data
7. React dashboard shows live telemetry, map location, and alerts

### Scope cuts for MVP
These are intentionally deferred until the core system is stable:

- Raw microphone streaming
- Advanced AI/LLM processing
- Full enterprise RBAC and tenant admin flows
- TLS/client cert auth on device
- Fully custom PCB production
- Deep analytics/reporting pipeline

---

## Deployment phases

| Phase | Name | Connectivity | Broker | Power | Security |
|-------|------|-------------|--------|-------|----------|
| 1 | Local MVP | ESP-NOW + GSM MQTT | EMQX OSS (Docker) | 12V battery + LM2596 buck | Basic MQTT auth |
| 2 | Field Prototype | ESP-NOW + GSM MQTT | EMQX OSS | 12V battery + stable dual rails | MQTT auth + app ACLs |
| 3 | Enhanced MVP | ESP-NOW + GSM + secure MQTT | EMQX OSS / cloud-hosted | hardened vehicle install | TLS + stronger topic isolation |

**Current status: Phase 1 Local MVP in progress.**

---

## System architecture

### 1) Container sensor node — ESP32-S3 N16R8
Installed inside or near the cargo container.

Responsibilities:
- Read environmental and safety sensors
- Detect simple local anomalies
- Log data to SD card
- Send compact telemetry packets to cabin gateway using ESP-NOW

Connected modules:
- AHT10
- BMP180
- MPU6050
- MQ2 gas sensor
- Standard SD card module
- INMP441 microphone module (**deferred unless time permits**)

### 2) Cabin gateway node — ESP32-WROOM-32 / N4
Installed inside the truck driver cabin.

Responsibilities:
- Receive ESP-NOW telemetry from container node
- Read truck location using NEO-M8N GPS
- Publish combined payload to EMQX using SIM800L over GSM/GPRS
- Handle reconnect and simple offline buffering

Connected modules:
- SIM800L v2.2 GSM module
- NEO-M8N GPS module

### 3) Platform software
Runs in local Docker during MVP.

Components:
- EMQX OSS
- Node.js backend
- React frontend

Responsibilities:
- MQTT ingestion
- Latest state persistence
- Alert evaluation
- Live dashboard and map
- Multi-truck / multi-container extensibility

---

## Device identities

### ESP-NOW peers
- Container ESP32-S3 MAC: `AC:A7:04:27:BD:00`
- Cabin ESP32 MAC: `EC:E3:34:23:43:24`

These values are currently treated as the canonical peer identities for the MVP.
If hardware changes, update this skill and the firmware together.

---

## Hardware

| Component | Model | Role |
|-----------|-------|------|
| Container MCU | ESP32-S3 N16R8 | Sensor node inside cargo container |
| Gateway MCU | ESP32-WROOM-32 / N4 | Cabin gateway node |
| Temp/Humidity | AHT10 | Environmental monitoring |
| Pressure | BMP180 | Pressure monitoring |
| Motion | MPU6050 | Tilt, shock, and motion detection |
| Gas | MQ2 | Smoke/gas trend detection |
| Storage | Standard SD card module | Local offline logging |
| Microphone | INMP441 | Optional future acoustic feature extraction |
| GPS | NEO-M8N | Truck location via UART |
| GSM | SIM800L v2.2 | Cellular MQTT uplink |
| Power | 12V battery + LM2596 buck converters | Vehicle power source |

---

## Power architecture

### Canonical power plan
Source:
- 12V vehicle battery

Rails:
- **5V rail** from LM2596 for:
  - ESP32 dev boards (via 5V/VIN as appropriate)
  - SD card module
  - MQ2 module if required by board
  - other sensor modules as needed
- **4.0V dedicated rail** from separate LM2596 for:
  - SIM800L only

Rules:
- All grounds must be common
- SIM800L must not share a weak rail with the ESP boards
- Keep SIM800L power wires short and thick
- Add bulk capacitor near SIM800L power input
- Verify voltage with multimeter before powering modules

### Known power risk
If SIM800L resets, disconnects, or causes ESP brownouts:
- check current capability
- shorten supply wires
- isolate GSM rail properly
- add capacitor close to module

---

## Canonical GPIO pinout

These are the **project-standard pin assignments**. Do not change without
updating firmware and documentation together.

---

## ESP32-S3 N16R8 — container node pinout

### I2C bus
| GPIO | Signal | Module | Protocol | Notes |
|------|--------|--------|----------|-------|
| 8 | I2C_SDA | AHT10 / BMP180 / MPU6050 | I2C | Shared I2C bus |
| 9 | I2C_SCL | AHT10 / BMP180 / MPU6050 | I2C | Shared I2C bus |

### Sensor / storage / optional audio
| GPIO | Signal | Module | Protocol | Notes |
|------|--------|--------|----------|-------|
| 4 | MQ2_AO | MQ2 gas sensor | ADC | Raw gas level input |
| 10 | SD_CS | SD card module | SPI | |
| 11 | SD_MOSI | SD card module | SPI | |
| 12 | SD_SCK | SD card module | SPI | |
| 13 | SD_MISO | SD card module | SPI | |
| 14 | I2S_WS | INMP441 | I2S | Optional / deferred |
| 15 | I2S_BCLK | INMP441 | I2S | Optional / deferred |
| 16 | I2S_SD | INMP441 | I2S | Optional / deferred |

### Notes
- AHT10 default I2C address: `0x38`
- MPU6050 default I2C address: `0x68`
- BMP180 default I2C address: `0x77`
- No address conflict on the shared I2C bus
- INMP441 is optional for MVP and should only be enabled after the core path is stable

---

## ESP32-WROOM-32 / N4 — cabin gateway pinout

### GPS UART
| GPIO | Signal | Module | Protocol | Notes |
|------|--------|--------|----------|-------|
| 16 | GPS_RX | NEO-M8N TX | UART2 RX | GPS data into ESP32 |
| 17 | GPS_TX | NEO-M8N RX | UART2 TX | Usually optional |

### SIM800L UART
| GPIO | Signal | Module | Protocol | Notes |
|------|--------|--------|----------|-------|
| 26 | GSM_RX | SIM800L TX | UART1 RX | GSM data into ESP32 |
| 27 | GSM_TX | SIM800L RX | UART1 TX | AT commands out |

### Notes
- ESP-NOW uses onboard Wi-Fi radio
- Keep SIM800L physically separated from GPS antenna where possible
- Test GPS near open sky or window; indoor no-fix is not always a code issue

---

## Arduino IDE settings

### ESP32-S3 N16R8
| Setting | Value |
|---------|-------|
| Board | ESP32S3 Dev Module |
| Flash Size | 16MB |
| PSRAM | OPI PSRAM |
| CPU Frequency | 240MHz |
| USB CDC On Boot | Disabled or per board behavior |
| Partition Scheme | Huge APP or similar |
| Flash Mode | QIO 80MHz |

### ESP32-WROOM-32 / N4
| Setting | Value |
|---------|-------|
| Board | ESP32 Dev Module |
| Flash Size | 4MB |
| Upload Speed | 115200 or stable board value |
| CPU Frequency | 240MHz |
| Partition Scheme | Default or Huge APP if needed |

---

## Firmware architecture

---

## Container node firmware

**File suggestion:** `cargo_container_s3.ino`

### Required libraries
- Wire
- WiFi
- esp_now
- SPI
- SD
- Adafruit_AHTX0 (or equivalent AHT10 library)
- Adafruit_BMP085 / BMP180 compatible library
- Adafruit_MPU6050 (or equivalent)
- driver/i2s or Arduino-compatible I2S support (**optional**)

### Responsibilities
1. Initialize I2C devices
2. Read AHT10, BMP180, MPU6050, MQ2
3. Compute simple motion values:
   - tilt
   - shock flag
4. Log CSV/JSON line to SD
5. Send compact telemetry struct to cabin node using ESP-NOW
6. Retry / show send status over Serial

### MVP telemetry cycle
- Read sensors every 2–3 seconds
- Write one SD log line
- Send one compact ESP-NOW packet

### Optional later additions
- INMP441 RMS / peak / anomaly features
- local buffering of unsent packets
- battery telemetry
- tamper detection

---

## Cabin gateway firmware

**File suggestion:** `cargo_gateway_esp32.ino`

### Required libraries
- WiFi
- esp_now
- TinyGSM
- TinyGPSPlus
- PubSubClient
- ArduinoJson

### Responsibilities
1. Receive sensor packet from container node over ESP-NOW
2. Read latest GPS location from NEO-M8N
3. Connect to GSM/GPRS via SIM800L
4. Publish combined JSON payload to EMQX
5. Reconnect MQTT and GPRS if disconnected

### Mobitel APN
```cpp
const char apn[] = "mobitel";
const char gprsUser[] = "";
const char gprsPass[] = "";