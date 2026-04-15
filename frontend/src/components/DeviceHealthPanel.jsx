import StatusPill from "./StatusPill";

function HealthRow({ label, tone, value, note }) {
  return (
    <div className="health-row">
      <div>
        <p className="health-label">{label}</p>
        {note ? <p className="health-note">{note}</p> : null}
      </div>
      <div className="health-value-wrap">
        <StatusPill tone={tone}>{value}</StatusPill>
      </div>
    </div>
  );
}

export default function DeviceHealthPanel({ telemetry, backendHealth, isOffline }) {
  const status = telemetry && telemetry.status ? telemetry.status : {};
  const mqttConnected = backendHealth && backendHealth.runtime && backendHealth.runtime.mqtt
    ? backendHealth.runtime.mqtt.connected
    : null;

  const espNowTone = isOffline ? "warning" : "ok";
  const espNowValue = isOffline ? "Stale" : "Healthy";

  const gsmTone = status.uplink && status.uplink !== "unknown" ? "ok" : "muted";
  const gsmValue = status.uplink ? String(status.uplink).toUpperCase() : "Unavailable";

  const mqttTone = mqttConnected === true ? "ok" : mqttConnected === false ? "offline" : "muted";
  const mqttValue = mqttConnected === true ? "Connected" : mqttConnected === false ? "Disconnected" : "Unknown";

  const sdTone = status.sdOk ? "ok" : "warning";
  const sdValue = status.sdOk ? "Operational" : "Attention";

  const gpsTone = status.gpsFix ? "ok" : "warning";
  const gpsValue = status.gpsFix ? "Locked" : "Searching";

  return (
    <section className="panel-surface">
      <div className="panel-headline">
        <h3>Device & System Health</h3>
        <p>Gateway, transport, and sensor system status</p>
      </div>

      <div className="health-grid">
        <HealthRow
          label="ESP-NOW Bridge"
          tone={espNowTone}
          value={espNowValue}
          note="Container node to gateway delivery path"
        />
        <HealthRow
          label="Cellular Uplink"
          tone={gsmTone}
          value={gsmValue}
          note="Wide-area connectivity mode"
        />
        <HealthRow
          label="Broker Session"
          tone={mqttTone}
          value={mqttValue}
          note="Backend connection to EMQX"
        />
        <HealthRow
          label="SD Card"
          tone={sdTone}
          value={sdValue}
          note="Edge logging and persistence"
        />
        <HealthRow
          label="GPS Status"
          tone={gpsTone}
          value={gpsValue}
          note="Current satellite lock state"
        />
      </div>
    </section>
  );
}
