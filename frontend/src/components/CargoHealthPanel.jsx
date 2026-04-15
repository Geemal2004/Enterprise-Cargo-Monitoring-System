import { getAlertPayload, normalizeSeverity, severityLabel } from "../types/telemetry";
import StatusPill from "./StatusPill";

function computeHealthState(alerts) {
  if (!alerts || alerts.length === 0) {
    return { tone: "ok", title: "Stable", description: "No active risk indicators for this cargo unit." };
  }

  const levels = alerts.map((item) => normalizeSeverity(getAlertPayload(item).severity));

  if (levels.includes("critical")) {
    return {
      tone: "offline",
      title: "Critical",
      description: "Immediate attention recommended. Critical alerts are active.",
    };
  }

  if (levels.includes("warning")) {
    return {
      tone: "warning",
      title: "Watch",
      description: "One or more warning conditions are currently active.",
    };
  }

  return {
    tone: "info",
    title: "Monitor",
    description: "Informational events detected. Continue standard monitoring.",
  };
}

export default function CargoHealthPanel({ alerts }) {
  const state = computeHealthState(alerts);

  return (
    <section className="panel-surface">
      <div className="panel-headline">
        <h3>Cargo Condition Summary</h3>
        <p>Current risk posture for this truck/container</p>
      </div>

      <div className="cargo-health-header">
        <StatusPill tone={state.tone}>{state.title}</StatusPill>
        <p className="cargo-health-text">{state.description}</p>
      </div>

      {alerts && alerts.length > 0 ? (
        <ul className="mini-alert-list">
          {alerts.slice(0, 5).map((item, index) => {
            const alert = getAlertPayload(item);
            const level = normalizeSeverity(alert.severity);
            return (
              <li key={`${item.key}-${alert.code || index}`}>
                <StatusPill tone={level}>{severityLabel(level)}</StatusPill>
                <span>{alert.message || alert.code || "Alert"}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">No active warnings. Cargo condition is currently stable.</p>
      )}
    </section>
  );
}
