import { Link } from "react-router-dom";
import {
  deriveDeviceStatus,
  extractTelemetry,
  formatRelativeTime,
  getDeviceKey,
  getReceivedAtMs,
} from "../types/telemetry";
import StatusPill from "./StatusPill";

function tempValue(value) {
  return typeof value === "number" ? `${value.toFixed(1)} C` : "-";
}

function gasValue(value) {
  return typeof value === "number" ? `${Math.round(value)}` : "-";
}

export default function FleetTable({ entries, alertsByKey }) {
  if (!entries || entries.length === 0) {
    return (
      <p className="empty-state">
        No live units yet. Fleet rows will appear automatically when telemetry is received.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Truck ID</th>
            <th>Container ID</th>
            <th>Status</th>
            <th>Temperature</th>
            <th>Gas Level</th>
            <th>Shock</th>
            <th>GPS Status</th>
            <th>Last Seen</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const key = getDeviceKey(entry);
            const telemetry = extractTelemetry(entry);
            const env = telemetry.env || {};
            const gas = telemetry.gas || {};
            const motion = telemetry.motion || {};
            const status = telemetry.status || {};
            const deviceAlerts = alertsByKey[key] || [];
            const deviceStatus = deriveDeviceStatus(entry, deviceAlerts);

            return (
              <tr key={key}>
                <td>{entry.truckId || "Unknown"}</td>
                <td>{entry.containerId || "Unknown"}</td>
                <td>
                  <StatusPill tone={deviceStatus.tone}>{deviceStatus.label}</StatusPill>
                </td>
                <td>{tempValue(env.temperatureC)}</td>
                <td>{gasValue(gas.mq2Raw)}</td>
                <td>
                  <StatusPill tone={motion.shock ? "warning" : "ok"}>
                    {motion.shock ? "Impact" : "Clear"}
                  </StatusPill>
                </td>
                <td>
                  <StatusPill tone={status.gpsFix ? "ok" : "muted"}>
                    {status.gpsFix ? "Locked" : "Searching"}
                  </StatusPill>
                </td>
                <td>{formatRelativeTime(getReceivedAtMs(entry))}</td>
                <td>
                  <Link className="table-action" to={`/detail/${entry.truckId}/${entry.containerId}`}>
                    View Details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
