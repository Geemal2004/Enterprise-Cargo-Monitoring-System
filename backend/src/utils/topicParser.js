const TELEMETRY_TOPIC_REGEX =
  /^tenant\/([^/]+)\/truck\/([^/]+)\/container\/([^/]+)\/telemetry$/;

function parseTelemetryTopic(topic) {
  if (typeof topic !== "string") {
    return null;
  }

  const match = topic.match(TELEMETRY_TOPIC_REGEX);
  if (!match) {
    return null;
  }

  return {
    tenantId: match[1],
    truckId: match[2],
    containerId: match[3],
    topic,
  };
}

module.exports = {
  parseTelemetryTopic,
};
