#pragma once

#include <Arduino.h>

// Keep this struct byte-compatible with container-node definition
struct CargoPacket {
  uint32_t seq;
  uint32_t ts;
  float tempC;
  float humidity;
  float pressure;
  float tilt;
  uint16_t gasRaw;
  bool shock;
  bool sdOk;
};
