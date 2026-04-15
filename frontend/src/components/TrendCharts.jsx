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

function tooltipFormatter(value, name) {
  if (typeof value !== "number") {
    return ["-", name];
  }

  if (name.includes("Temperature")) {
    return [`${value.toFixed(1)} C`, name];
  }
  if (name.includes("Humidity")) {
    return [`${value.toFixed(1)} %`, name];
  }
  if (name.includes("Pressure")) {
    return [`${value.toFixed(1)} hPa`, name];
  }
  if (name.includes("Gas")) {
    return [`${Math.round(value)}`, name];
  }

  return [value, name];
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
        <div className="chart-wrap-lg">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 16, right: 16, left: 0, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf2" />
              <XAxis dataKey="label" minTickGap={28} stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} width={42} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} width={46} />
              <YAxis yAxisId="gas" hide />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #dbe2ea",
                  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.10)",
                }}
              />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: "12px", paddingBottom: "4px" }} />
              <Line yAxisId="left" type="monotone" dataKey="temperatureC" name="Temperature (C)" stroke="#dc2626" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="humidityPct" name="Humidity (%)" stroke="#0284c7" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="pressureHpa" name="Pressure (hPa)" stroke="#4f46e5" strokeWidth={2} dot={false} />
              <Line yAxisId="gas" type="monotone" dataKey="gasRaw" name="Gas Level" stroke="#d97706" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {!loading && points && points.length > 1 ? (
        <p className="chart-footnote">Pressure and gas lines use independent scaling for clearer trend comparison.</p>
      ) : null}
    </section>
  );
}
