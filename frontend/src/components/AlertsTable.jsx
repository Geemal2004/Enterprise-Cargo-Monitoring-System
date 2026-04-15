import { useMemo, useState } from "react";
import { formatDateTime } from "../types/telemetry";
import StatusPill from "./StatusPill";

const SEVERITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

function alertStateTone(active) {
  return active ? "warning" : "muted";
}

export default function AlertsTable({ alerts }) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return (alerts || []).filter((item) => {
      const severityOk = severityFilter === "all" || item.severityLevel === severityFilter;
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "active" && item.active) ||
        (statusFilter === "resolved" && !item.active);

      return severityOk && statusOk;
    });
  }, [alerts, severityFilter, statusFilter]);

  return (
    <section className="panel-surface">
      <div className="panel-headline">
        <h3>Alerts Log</h3>
        <p>Filter incidents by severity and lifecycle state</p>
      </div>

      <div className="filter-row">
        <label className="filter-label">
          Severity Level
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-label">
          Alert State
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">
          {(alerts || []).length === 0
            ? "No alerts yet. This view will populate automatically when thresholds are triggered."
            : "No alerts match the selected filters. Try broadening the filter criteria."}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Last Seen</th>
                <th>Truck / Container</th>
                <th>Severity</th>
                <th>Message</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.lastSeenAt)}</td>
                  <td>{item.truckId} / {item.containerId}</td>
                  <td>
                    <StatusPill tone={item.severityLevel}>{item.severity}</StatusPill>
                  </td>
                  <td>{item.message}</td>
                  <td>
                    <div className="state-cell">
                      <StatusPill tone={alertStateTone(item.active)}>
                        {item.active ? "Active" : "Resolved"}
                      </StatusPill>
                      {!item.active && item.resolvedAt ? (
                        <span className="state-note">{formatDateTime(item.resolvedAt)}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
