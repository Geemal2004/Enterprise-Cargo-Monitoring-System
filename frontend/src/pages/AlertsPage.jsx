import AlertsTable from "../components/AlertsTable";
import SummaryCard from "../components/SummaryCard";
import { useFleetDataContext } from "../context/FleetDataContext";

function countBySeverity(alerts, level) {
  return (alerts || []).filter((item) => item.severityLevel === level && item.active).length;
}

export default function AlertsPage() {
  const { alertTimeline } = useFleetDataContext();

  const activeCount = (alertTimeline || []).filter((item) => item.active).length;
  const resolvedCount = (alertTimeline || []).filter((item) => !item.active).length;

  return (
    <div className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>Alerts Center</h2>
          <p>Severity and lifecycle view for fleet incidents</p>
        </div>

        <div className="summary-grid">
          <SummaryCard title="Active Alerts" value={activeCount} subtitle="Currently unresolved" tone="warning" />
          <SummaryCard title="Resolved Alerts" value={resolvedCount} subtitle="Closed after recovery" tone="success" />
          <SummaryCard title="Critical" value={countBySeverity(alertTimeline, "critical")} subtitle="Immediate response required" tone="attention" />
          <SummaryCard title="Warning" value={countBySeverity(alertTimeline, "warning")} subtitle="Monitor and verify" />
        </div>
      </section>

      <AlertsTable alerts={alertTimeline} />
    </div>
  );
}
