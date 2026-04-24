#pragma once

#include <Arduino.h>

// Sent by gateway node → container node over ESP-NOW
// Contains a real UTC unix timestamp derived from GPS or GSM network time.
struct TimeSyncPacket {
  uint32_t magic;    // Must equal TIME_SYNC_MAGIC to be accepted
  uint32_t unixTs;  // UTC Unix timestamp (seconds since 1970-01-01)
};

// Chosen to be unlikely to appear in a malformed CargoPacket
static const uint32_t TIME_SYNC_MAGIC = 0x715E5142UL;