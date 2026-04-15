# Smart Cargo Monitoring System End-to-End QA Plan

## 0. Objective

Validate end-to-end reliability and correctness across:

- ESP32-S3 container sensor node
- ESP32 gateway node
- ESP-NOW link
- SIM800L GPRS uplink
- TLS MQTT to EMQX Serverless
- Node backend APIs
- React dashboard behavior

## 1. Test Environment Baseline

| Item | Value |
|---|---|
| MQTT topic pattern | tenant/+/truck/+/container/+/telemetry |
| Example topic | tenant/demo/truck/TRUCK01/container/CONT01/telemetry |
| Backend poll/scan behavior | Offline threshold 30000 ms, scanner 5000 ms |
| Frontend refresh | 5000 ms |
| Alert thresholds | temperatureC > 35, gas.mq2Raw > 1500, motion.shock == true, offline > 30 s |
| Expected API endpoints | /api/latest, /api/latest/:truckId/:containerId, /api/alerts, /api/health |

## 2. Entry and Exit Criteria

### Entry Criteria

- EMQX Serverless deployment is active.
- CA certificate is downloaded if strict TLS validation is enabled.
- Root .env and service env values are configured.
- Firmware flashed to both nodes.
- Backend and frontend started.

### Exit Criteria

- All P0 and P1 tests pass.
- All required failure-mode tests pass.
- Demo script executes without manual patching.
- No unresolved critical defects.

## 3. Hardware Bring-Up Checklist

| ID | Check | Method | Pass Criteria | Evidence |
|---|---|---|---|---|
| HW-01 | Common ground integrity | Multimeter continuity between all module grounds | < 1 ohm continuity across grounds | Photo + measurement log |
| HW-02 | SIM800L dedicated rail | Measure SIM800L supply under attach and publish | Stable around module target rail, no brownout reset during publish | Voltage capture video or meter log |
| HW-03 | ESP32 rails stable | Monitor both ESP boards while gateway publishes | No reboot loops, no brownout messages | Serial logs |
| HW-04 | GPS UART wiring | Verify working mapping from runtime logs | Gateway status shows gpsRx=27 and gpsTx=26 with gpsChars increasing | Gateway serial screenshot |
| HW-05 | ESP-NOW peer identity | Verify MAC addresses on boot | Local MAC and expected peer MAC match project mapping | Boot log screenshot |
| HW-06 | Sensor bus scan | Run container node boot scan | AHT10, BMP180, MPU6050 addresses discovered | Container serial log |
| HW-07 | SD card readiness | Boot with SD inserted | sdOk true or valid SD init message | Container serial log |

## 4. Firmware Smoke Tests

### 4.1 Container Node

| ID | Test | Procedure | Expected Result | Evidence |
|---|---|---|---|---|
| FW-C-01 | Boot smoke | Power cycle container node | Sensor init completes and periodic packets generated | Serial log |
| FW-C-02 | Packet cadence | Observe sequence increments for 60 s | seq increments monotonically at configured interval | Serial log |
| FW-C-03 | Sensor fields populated | Inspect outgoing data fields | temp, humidity, pressure, tilt, gasRaw present | Serial log |
| FW-C-04 | SD logging path | Run with SD inserted | sdOk true in packet and local write succeeds | Serial log + SD file sample |

### 4.2 Gateway Node

| ID | Test | Procedure | Expected Result | Evidence |
|---|---|---|---|---|
| FW-G-01 | Boot smoke | Power cycle gateway | ESP-NOW callback ready, modem init path starts | Serial log |
| FW-G-02 | ESP-NOW receive | Keep container running | RX lines with matching seq values appear | Serial log |
| FW-G-03 | MQTT publish | Ensure SIM and APN available | PUB ok=1 with matching seq | Serial log |
| FW-G-04 | GPS integration | Place antenna with clear sky | gpsFix transitions to 1, sats > 0, lat/lon non-zero | Serial log |
| FW-G-05 | Status telemetry | Observe status line every interval | net, gprs, mqtt status fields update consistently | Serial log |

### 4.3 Cross-Node Functional

| ID | Test | Procedure | Expected Result | Evidence |
|---|---|---|---|---|
| FW-X-01 | End-to-end packet flow | Track one seq from container to gateway publish | Same seq appears in RX and PUB logs | Paired logs |
| FW-X-02 | Timestamp behavior | Compare publish ts when GPS unavailable vs available | Fallback ts before fix, GPS-based ts after fix | Serial log |

## 5. MQTT Connectivity and Security Tests

| ID | Scenario | Injection/Action | Expected Result | Evidence |
|---|---|---|---|---|
| MQ-01 | Normal TLS connect | Use valid host, user, password, CA settings | Backend connects and subscribes; gateway publishes ok | Backend + gateway logs |
| MQ-02 | Wrong username/password | Set invalid credentials on gateway or backend | Connect fails, retries continue without crash | Error logs showing auth failure |
| MQ-03 | Bad CA/TLS failure | Set wrong CA file or wrong trust anchor | TLS handshake fails, no successful publish/subscribe | TLS error logs |
| MQ-04 | Topic filter coverage | Publish to valid canonical topic | Backend accepts and stores latest telemetry | API output from /api/latest |
| MQ-05 | Topic mismatch rejection | Publish non-canonical topic | Backend rejects message and no latest update | Backend runtime rejection counters |

## 6. Backend API Tests

Use either curl, Postman, or automated API collection.

| ID | Endpoint | Method | Expected Result |
|---|---|---|---|
| API-01 | /api/health | GET | 200 with status ok/degraded and runtime metadata |
| API-02 | /api/latest | GET | 200 with count and latest items keyed by truck/container |
| API-03 | /api/latest/TRUCK01/CONT01 | GET | 200 with selected latest object when data exists |
| API-04 | /api/latest/<invalid>/<invalid> | GET | 404 telemetry not found |
| API-05 | /api/alerts | GET | 200 with active alerts list |

### Backend Functional Checks

| ID | Check | Procedure | Expected Result |
|---|---|---|---|
| API-F-01 | JSON validation | Publish malformed payload | Message rejected, service remains healthy |
| API-F-02 | Alert threshold trigger | Publish telemetry crossing thresholds | Correct alert codes generated |
| API-F-03 | Offline scanner | Stop publish for > 30 s | OFFLINE alert appears |

## 7. Frontend Verification Checklist

| ID | Check | Procedure | Pass Criteria |
|---|---|---|---|
| UI-01 | Dashboard load | Open dashboard after backend start | Page loads without crash |
| UI-02 | Refresh cadence | Observe values over 15 s | Data refreshes every ~5 s |
| UI-03 | Status cards | Verify temp/humidity/pressure/gas/shock | Cards show current values |
| UI-04 | Online/offline badge | Stop telemetry for > 30 s | Badge changes to OFFLINE |
| UI-05 | Alert panel | Trigger threshold breaches | Matching alerts listed |
| UI-06 | Map marker | Ensure gpsFix with valid lat/lon | Marker shown at live location |
| UI-07 | History chart fallback | Run with no backend history | Latest-only state message shown |
| UI-08 | Device selector readiness | Add second device stream | Selector allows switching device context |

## 8. Required Failure-Mode Tests

| ID | Failure Mode | Injection | Expected Behavior |
|---|---|---|---|
| FM-01 | Missing GPS fix | Shield antenna or disconnect GPS antenna | Publish continues with gpsFix false and no crash |
| FM-02 | SIM800L reconnect after network drop | Remove antenna or disable network temporarily | Reconnect attempts continue and recover automatically |
| FM-03 | ESP-NOW packet loss | Increase distance/interference between nodes | Some seq gaps visible, system remains operational |
| FM-04 | Bad CA / TLS failure | Use invalid CA path/content | Connection fails cleanly, retries logged |
| FM-05 | Wrong username/password | Set invalid MQTT credentials | Auth failure logged, no unauthorized publish |
| FM-06 | Alert threshold trigger | Force temp > 35, gas > 1500, shock true | Corresponding alerts appear in backend and UI |
| FM-07 | Dashboard stale/offline state | Stop incoming telemetry > 30 s | OFFLINE alert and UI offline badge appear |

## 9. Demo Script (Operator Runbook)

### Demo Goal

Show complete path from sensor packet to dashboard with one normal scenario and one fault scenario.

### Sequence

1. Start backend and confirm /api/health responds.
2. Start frontend and open dashboard.
3. Boot container node and show sensor packet logs.
4. Boot gateway node and show ESP-NOW RX and MQTT PUB ok=1.
5. Show /api/latest update for TRUCK01/CONT01.
6. Show dashboard status cards and map marker.
7. Trigger one alert threshold and show /api/alerts plus UI alert panel.
8. Pause telemetry for > 30 s and show OFFLINE behavior.
9. Resume telemetry and show recovery to ONLINE.

### Target Demo Duration

- 8 to 12 minutes.

## 10. Failure-Mode Matrix

| Layer | Failure | Detectability | User Impact | Recovery Strategy | Test ID |
|---|---|---|---|---|---|
| GPS | No fix / no satellites | High via gateway status logs | Location unavailable, telemetry still flows | Keep publish alive, maintain gpsFix false, recover when sky view returns | FM-01 |
| GSM | Network drop | High via net/gprs flags | Delayed cloud telemetry | Automatic reconnect with backoff and socket cleanup | FM-02 |
| ESP-NOW | Packet loss/interference | Medium via seq gaps | Partial telemetry loss | Improve RF placement/channel, keep system non-blocking | FM-03 |
| TLS | Bad CA | High via handshake errors | No MQTT ingest path | Correct CA mount/path and restart | FM-04 |
| Auth | Wrong credentials | High via auth reject logs | No publish/subscribe | Correct credentials and rotate safely | FM-05 |
| Rules | Threshold misfire | Medium via alert list mismatch | False alerts or missed alerts | Validate rule values and payload mapping | FM-06 |
| UI freshness | Stale data not flagged | Medium if no offline logic | Operator trust risk | Enforce offline threshold and visible badge | FM-07 |

## 11. Evidence Collection Template

| Test ID | Result (Pass/Fail) | Timestamp | Evidence Link | Notes |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## 12. Recommended Execution Order

1. Hardware bring-up checklist
2. Firmware smoke tests
3. MQTT connectivity/security tests
4. Backend API tests
5. Frontend checklist
6. Failure-mode tests
7. Demo dry run and final demo
