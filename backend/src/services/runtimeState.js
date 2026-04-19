function createRuntimeState() {
  const state = {
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    db: {
      healthy: false,
      lastCheckAt: null,
      lastError: null,
    },
    mqtt: {
      connected: false,
      topicFilter: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
      lastMessageAt: null,
      messagesReceived: 0,
      messagesAccepted: 0,
      messagesRejected: 0,
      lastRejectReason: null,
      queueBacklog: 0,
    },
    jobs: {
      offlineScannerRuns: 0,
      offlineScannerLastRunAt: null,
      offlineScannerLastError: null,
    },
  };

  return {
    markDbHealthy() {
      state.db.healthy = true;
      state.db.lastCheckAt = new Date().toISOString();
      state.db.lastError = null;
    },

    markDbError(error) {
      state.db.healthy = false;
      state.db.lastCheckAt = new Date().toISOString();
      state.db.lastError = {
        at: new Date().toISOString(),
        message: error && error.message ? error.message : String(error),
      };
    },

    markMqttConnected(topicFilter) {
      state.mqtt.connected = true;
      state.mqtt.topicFilter = topicFilter;
      state.mqtt.lastConnectedAt = new Date().toISOString();
    },

    markMqttDisconnected() {
      state.mqtt.connected = false;
      state.mqtt.lastDisconnectedAt = new Date().toISOString();
    },

    markMqttError(error) {
      state.mqtt.lastError = {
        at: new Date().toISOString(),
        message: error && error.message ? error.message : String(error),
      };
    },

    markMqttMessageReceived() {
      state.mqtt.messagesReceived += 1;
      state.mqtt.lastMessageAt = new Date().toISOString();
    },

    markMqttMessageAccepted() {
      state.mqtt.messagesAccepted += 1;
      state.mqtt.lastRejectReason = null;
    },

    markMqttMessageRejected(reason) {
      state.mqtt.messagesRejected += 1;
      state.mqtt.lastRejectReason = reason;
    },

    setMqttQueueBacklog(size) {
      state.mqtt.queueBacklog = size;
    },

    markOfflineScanRun() {
      state.jobs.offlineScannerRuns += 1;
      state.jobs.offlineScannerLastRunAt = new Date().toISOString();
      state.jobs.offlineScannerLastError = null;
    },

    markOfflineScanError(error) {
      state.jobs.offlineScannerRuns += 1;
      state.jobs.offlineScannerLastRunAt = new Date().toISOString();
      state.jobs.offlineScannerLastError = {
        at: new Date().toISOString(),
        message: error && error.message ? error.message : String(error),
      };
    },

    snapshot() {
      return {
        startedAt: state.startedAt,
        uptimeSeconds: Math.floor((Date.now() - state.startedAtMs) / 1000),
        db: { ...state.db },
        mqtt: { ...state.mqtt },
        jobs: { ...state.jobs },
      };
    },
  };
}

module.exports = {
  createRuntimeState,
};
