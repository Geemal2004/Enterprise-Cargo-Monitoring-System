#pragma once

#include <Arduino.h>

// Canonical ESP-NOW packet for container -> gateway transfer
struct CargoPacket {
  uint32_t seq;
  uint32_t ts;
  float tempC;
  float humidity;
  float pressure;
  float tilt;
  uint16_t gasRaw;
  float gasPpm;
  bool shock;
  bool sdOk;
};
