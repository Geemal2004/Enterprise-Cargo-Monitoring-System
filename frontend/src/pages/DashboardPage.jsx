import AlertPanel from "../components/AlertPanel";
import DeviceSelector from "../components/DeviceSelector";
import RecentChart from "../components/RecentChart";
import StatusCard from "../components/StatusCard";
import TruckMap from "../components/TruckMap";
import { useDashboardData } from "../hooks/useDashboardData";

function toFixedOrDash(value, fractionDigits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(fractionDigits)
    : "-";
}

export default function DashboardPage() {
  const {
    loading,
    error,
    lastUpdated,
    selectedEntry,
    selectedTelemetry,
    selectedDeviceAlerts,
    selectedKey,
    setSelectedKey,
    devices,
    hasBackendHistory,
    historyPoints,
    isOffline,
  } = useDashboardData(5000);

  const env = selectedTelemetry.env || {};
  const gas = selectedTelemetry.gas || {};
  const motion = selectedTelemetry.motion || {};
  const status = selectedTelemetry.status || {};
  const gps = selectedTelemetry.gps || {};

  const selectedLabel = selectedEntry
    ? `${selectedEntry.truckId || "UNKNOWN_TRUCK"} / ${selectedEntry.containerId || "UNKNOWN_CONTAINER"}`
    : "No active truck/container";

  const updatedText = lastUpdated
    ? `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`
    : "-";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1 className="title">Smart Cargo Monitoring Dashboard</h1>
          <p className="muted">Polling /api/latest and /api/alerts every 5 seconds</p>
        </div>
        <div className="panel" style={{ minWidth: 230 }}>
          <p className="card-title">Last Refresh</p>
          <p className="card-value" style={{ fontSize: "1rem" }}>{updatedText}</p>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="controls">
          <DeviceSelector devices={devices} selectedKey={selectedKey} onChange={setSelectedKey} />
          <span className={`status-badge ${isOffline ? "offline" : "online"}`}>
            {isOffline ? "OFFLINE" : "ONLINE"}
          </span>
          <span className="muted">{selectedLabel}</span>
        </div>

        {loading && !selectedEntry ? (
          <p className="empty-state">Loading telemetry...</p>
        ) : (
          <div className="cards-grid">
            <StatusCard title="Temperature" value={`${toFixedOrDash(env.temperatureC, 1)} C`} subtitle="env.temperatureC" />
            <StatusCard title="Humidity" value={`${toFixedOrDash(env.humidityPct, 1)} %`} subtitle="env.humidityPct" />
            <StatusCard title="Pressure" value={`${toFixedOrDash(env.pressureHpa, 1)} hPa`} subtitle="env.pressureHpa" />
            <StatusCard title="Gas MQ2" value={typeof gas.mq2Raw === "number" ? `${gas.mq2Raw}` : "-"} subtitle="gas.mq2Raw" />
            <StatusCard title="Shock" value={motion.shock ? "DETECTED" : "CLEAR"} subtitle="motion.shock" />
            <StatusCard
              title="GPS"
              value={status.gpsFix ? "FIXED" : "NO FIX"}
              subtitle={`${toFixedOrDash(gps.lat, 5)}, ${toFixedOrDash(gps.lon, 5)}`}
            />
          </div>
        )}
      </section>

      <section className="layout-grid">
        <div style={{ display: "grid", gap: 12 }}>
          <TruckMap telemetry={selectedTelemetry} label={selectedLabel} />
          <RecentChart hasBackendHistory={hasBackendHistory} points={historyPoints} />
        </div>
        <AlertPanel alerts={selectedDeviceAlerts} />
      </section>
    </main>
  );
}
