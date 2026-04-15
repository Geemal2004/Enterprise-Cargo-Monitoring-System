import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function RecentChart({ hasBackendHistory, points }) {
  return (
    <section className="panel">
      <h3 className="title" style={{ fontSize: "1.05rem" }}>Recent Trends</h3>
      {!hasBackendHistory ? (
        <p className="empty-state" style={{ marginTop: 10 }}>
          Backend history not available. Showing latest telemetry cards only.
        </p>
      ) : (
        <div className="chart-wrap" style={{ marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="temperatureC" name="Temp (C)" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="humidityPct" name="Humidity (%)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
