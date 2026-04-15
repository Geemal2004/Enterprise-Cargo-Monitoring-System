export default function AlertPanel({ alerts }) {
  return (
    <section className="panel">
      <h3 className="title" style={{ fontSize: "1.05rem" }}>Active Alerts</h3>
      {alerts.length === 0 ? (
        <p className="empty-state">No active alerts for the selected truck/container.</p>
      ) : (
        <ul className="alerts-list">
          {alerts.map((item, index) => {
            const code = item.alert && item.alert.code ? item.alert.code : "UNKNOWN";
            const message = item.alert && item.alert.message ? item.alert.message : "Alert triggered";
            const severity = item.alert && item.alert.severity ? item.alert.severity : "medium";
            const value = item.alert && item.alert.value !== undefined ? item.alert.value : "-";

            return (
              <li key={`${code}-${index}`} className={`alert-item ${severity}`}>
                <strong>{code}</strong>
                <p className="muted" style={{ margin: "4px 0" }}>{message}</p>
                <p className="muted" style={{ margin: 0 }}>Severity: {severity} | Value: {String(value)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
