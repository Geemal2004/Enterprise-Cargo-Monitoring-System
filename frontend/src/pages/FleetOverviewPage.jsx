import FleetTable from "../components/FleetTable";
import SummaryCard from "../components/SummaryCard";
import { useFleetDataContext } from "../context/FleetDataContext";

export default function FleetOverviewPage() {
  const { loading, error, entries, alertsByKey, fleetSummary } = useFleetDataContext();

  return (
    <div className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>Fleet Overview</h2>
          <p>Live operational view across trucks and cargo containers</p>
        </div>

        <div className="summary-grid">
          <SummaryCard
            title="Total Trucks"
            value={fleetSummary.totalTrucks}
            subtitle="Tracked in the dashboard"
          />
          <SummaryCard
            title="Online Trucks"
            value={fleetSummary.onlineTrucks}
            subtitle="Reporting within SLA window"
            tone="success"
          />
          <SummaryCard
            title="Active Alerts"
            value={fleetSummary.activeAlerts}
            subtitle="Open incidents requiring attention"
            tone="warning"
          />
          <SummaryCard
            title="Containers in Warning"
            value={fleetSummary.warningContainers}
            subtitle="Operational warnings detected"
            tone="attention"
          />
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Fleet Status Table</h3>
          <p>
            {loading ? "Refreshing live telemetry..." : `${entries.length} active truck/container units`}
          </p>
        </div>

        <FleetTable entries={entries} alertsByKey={alertsByKey} />
      </section>
    </div>
  );
}
