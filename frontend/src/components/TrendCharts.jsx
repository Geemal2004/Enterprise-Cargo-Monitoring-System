import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartConfigs = [
  {
    key: "temperatureC",
    name: "Temperature (C)",
    color: "#dc2626",
    unit: " C",
  },
  {
    key: "humidityPct",
    name: "Humidity (%)",
    color: "#0284c7",
    unit: " %",
  },
  {
    key: "pressureHpa",
    name: "Pressure (hPa)",
    color: "#4f46e5",
    unit: " hPa",
  },
  {
    key: "gasRaw",
    name: "Gas Level",
    color: "#d97706",
    unit: "",
  },
];

function formatValue(value, unit, decimals = 1) {
  if (typeof value !== "number") {
    return "-";
  }

  const formatted = unit ? value.toFixed(decimals) : Math.round(value).toString();
  return `${formatted}${unit}`;
}

export default function TrendCharts({ points, hasBackendHistory, loading }) {
  return (
    <section className="panel-surface">
      <div className="panel-headline">
        <h3>Trend Analysis</h3>
        <p>{hasBackendHistory ? "Historical window from backend" : "Live rolling window (fallback mode)"}</p>
      </div>

      {loading ? <p className="empty-state">Loading historical trend data...</p> : null}

      {!loading && (!points || points.length < 2) ? (
        <p className="empty-state">
          Not enough data points yet to render trends. Keep telemetry running and this chart will auto-populate.
        </p>
      ) : null}

      {!loading && points && points.length > 1 ? (
        <div className="trend-grid">
          {chartConfigs.map((config) => (
            <div key={config.key} className="trend-card">
              <div className="trend-header">
                <h4>{config.name}</h4>
                <span className="trend-dot" style={{ background: config.color }} />
              </div>
              <div className="trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  {config.key === "humidityPct" ? (
                    <AreaChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf2" />
                      <XAxis dataKey="label" minTickGap={30} stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={40} />
                      <Tooltip
                        formatter={(value) => [formatValue(value, config.unit), config.name]}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #dbe2ea",
                          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.10)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey={config.key}
                        name={config.name}
                        stroke={config.color}
                        fill={`${config.color}33`}
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  ) : null}

                  {config.key === "pressureHpa" ? (
                    <ScatterChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf2" />
                      <XAxis dataKey="label" type="category" minTickGap={30} stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis dataKey={config.key} stroke="#64748b" tick={{ fontSize: 10 }} width={40} />
                      <Tooltip
                        formatter={(value) => [formatValue(value, config.unit), config.name]}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #dbe2ea",
                          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.10)",
                        }}
                      />
                      <Scatter name={config.name} data={points} dataKey={config.key} fill={config.color} />
                    </ScatterChart>
                  ) : null}

                  {config.key === "gasRaw" ? (
                    <BarChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf2" />
                      <XAxis dataKey="label" minTickGap={30} stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={40} />
                      <Tooltip
                        formatter={(value) => [formatValue(value, config.unit, 0), config.name]}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #dbe2ea",
                          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.10)",
                        }}
                      />
                      <Bar dataKey={config.key} name={config.name} fill={config.color} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  ) : null}

                  {config.key === "temperatureC" ? (
                    <LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf2" />
                      <XAxis dataKey="label" minTickGap={30} stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={40} />
                      <Tooltip
                        formatter={(value) => [formatValue(value, config.unit), config.name]}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #dbe2ea",
                          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.10)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey={config.key}
                        name={config.name}
                        stroke={config.color}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  ) : null}
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
