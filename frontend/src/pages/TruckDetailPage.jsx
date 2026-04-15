import { Link, useParams } from "react-router-dom";
import CargoHealthPanel from "../components/CargoHealthPanel";
import DeviceHealthPanel from "../components/DeviceHealthPanel";
import StatusCard from "../components/StatusCard";
import StatusPill from "../components/StatusPill";
import TrendCharts from "../components/TrendCharts";
import TruckMap from "../components/TruckMap";
import { useFleetDataContext } from "../context/FleetDataContext";
import { useDeviceHistory } from "../hooks/useDeviceHistory";
import {
  deriveDeviceStatus,
  extractHistoryPoints,
  extractTelemetry,
  formatDateTime,
  formatRelativeTime,
  getAlertPayload,
  getDeviceKey,
  getReceivedAtMs,
  normalizeSeverity,
  severityLabel,
} from "../types/telemetry";

function valueOrDash(value, digits = 1, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(digits)}${suffix}`;
}

export default function TruckDetailPage() {
  const { truckId, containerId } = useParams();
  const {
    loading,
    entries,
    alertsByKey,
    historyByKey,
    backendHealth,
    getEntryByIds,
  } = useFleetDataContext();

  const routeEntry = truckId && containerId ? getEntryByIds(truckId, containerId) : null;
  const selectedEntry = routeEntry || entries[0] || null;

  if (!loading && !selectedEntry) {
    return (
      <section className="panel-surface">
        <h2>Truck Detail</h2>
        <p className="empty-state">No telemetry is available yet for any truck/container.</p>
        <Link className="table-action" to="/fleet">
          Back to Fleet Overview
        </Link>
      </section>
    );
  }

  if (!selectedEntry) {
    return <p className="empty-state">Loading selected asset details...</p>;
  }

  const selectedKey = getDeviceKey(selectedEntry);
  const telemetry = extractTelemetry(selectedEntry);
  const env = telemetry.env || {};
  const gas = telemetry.gas || {};
  const motion = telemetry.motion || {};
  const gps = telemetry.gps || {};
  const status = telemetry.status || {};

  const deviceAlerts = alertsByKey[selectedKey] || [];
  const deviceStatus = deriveDeviceStatus(selectedEntry, deviceAlerts);

  const fallbackHistory = historyByKey[selectedKey] || extractHistoryPoints(selectedEntry);
  const history = useDeviceHistory(selectedEntry.truckId, selectedEntry.containerId, fallbackHistory);

  const lastSeenMs = getReceivedAtMs(selectedEntry);
  const showingFallback = !routeEntry && entries.length > 0 && truckId && containerId;

  return (
    <div className="page-grid">
      <section className={`status-banner status-${deviceStatus.tone}`}>
        <div>
          <p className="eyebrow">Asset Detail</p>
          <h2>{selectedEntry.truckId} / {selectedEntry.containerId}</h2>
          <p className="muted-text">
            Last update: {formatRelativeTime(lastSeenMs)} ({formatDateTime(lastSeenMs)})
          </p>
        </div>
        <div className="status-banner-right">
          <StatusPill tone={deviceStatus.tone}>{deviceStatus.label}</StatusPill>
          <Link className="table-action" to="/fleet">Back to Fleet</Link>
        </div>
      </section>

      {showingFallback ? (
        <div className="notice-box">
          The requested truck/container was not found. Showing the first available active unit.
        </div>
      ) : null}

      <section className="sensor-grid">
        <StatusCard title="Temperature" value={valueOrDash(env.temperatureC, 1, " C")} subtitle="Cargo compartment reading" />
        <StatusCard title="Humidity" value={valueOrDash(env.humidityPct, 1, " %")} subtitle="Relative humidity level" />
        <StatusCard title="Pressure" value={valueOrDash(env.pressureHpa, 1, " hPa")} subtitle="Internal pressure trend" />
        <StatusCard title="Gas Level" value={typeof gas.mq2Raw === "number" ? `${Math.round(gas.mq2Raw)}` : "-"} subtitle="Air quality gas index" />
        <StatusCard title="Shock" value={motion.shock ? "Impact" : "Clear"} subtitle="Vibration and impact state" />
        <StatusCard
          title="GPS Status"
          value={status.gpsFix ? "Locked" : "Searching"}
          subtitle={
            typeof gps.lat === "number" && typeof gps.lon === "number"
              ? `Lat ${gps.lat.toFixed(5)}, Lon ${gps.lon.toFixed(5)}`
              : "Coordinates currently unavailable"
          }
        />
      </section>

      <section className="detail-grid">
        <div className="detail-main-stack">
          <TruckMap telemetry={telemetry} label={`${selectedEntry.truckId} / ${selectedEntry.containerId}`} />
          <TrendCharts
            points={history.points}
            hasBackendHistory={history.hasBackendHistory}
            loading={history.loading}
          />
        </div>

        <div className="detail-side-stack">
          <DeviceHealthPanel
            telemetry={telemetry}
            backendHealth={backendHealth}
            isOffline={deviceStatus.code === "offline"}
          />
          <CargoHealthPanel alerts={deviceAlerts} />

          <section className="panel-surface">
            <div className="panel-headline">
              <h3>Active Device Alerts</h3>
              <p>Current incidents linked to this unit</p>
            </div>
            {deviceAlerts.length === 0 ? (
              <p className="empty-state">No active alerts for this truck/container at the moment.</p>
            ) : (
              <ul className="mini-alert-list">
                {deviceAlerts.map((item, index) => {
                  const alert = getAlertPayload(item);
                  const level = normalizeSeverity(alert.severity);
                  return (
                    <li key={`${alert.code || "alert"}-${index}`}>
                      <StatusPill tone={level}>
                        {severityLabel(level)}
                      </StatusPill>
                      <span>{alert.message || alert.code || "Alert raised"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
