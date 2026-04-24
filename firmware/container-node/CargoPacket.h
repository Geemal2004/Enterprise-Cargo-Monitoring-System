#pragma once

#include <Arduino.h>

// Keep this struct byte-compatible between container-node and gateway-node.
// Do NOT reorder or add fields without updating both sides.
struct CargoPacket {
  uint32_t seq;
  uint32_t ts;       // UTC Unix timestamp (set by container using synced clock)
  float    tempC;
  float    humidity;
  float    pressure;
  float    tilt;
  uint16_t gasRaw;
  bool     shock;
  bool     sdOk;
};