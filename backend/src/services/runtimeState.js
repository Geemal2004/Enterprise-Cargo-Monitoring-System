function createRuntimeState() {
  const state = {
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
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
    },
  };

  return {
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
        message: error && error.message ? error.message : String(error),
        at: new Date().toISOString(),
      };
    },

    markMqttMessageAccepted() {
      state.mqtt.messagesReceived += 1;
      state.mqtt.messagesAccepted += 1;
      state.mqtt.lastMessageAt = new Date().toISOString();
      state.mqtt.lastRejectReason = null;
    },

    markMqttMessageRejected(reason) {
      state.mqtt.messagesReceived += 1;
      state.mqtt.messagesRejected += 1;
      state.mqtt.lastRejectReason = reason;
    },

    snapshot() {
      return {
        startedAt: state.startedAt,
        uptimeSeconds: Math.floor((Date.now() - state.startedAtMs) / 1000),
        mqtt: { ...state.mqtt },
      };
    },
  };
}

module.exports = {
  createRuntimeState,
};
