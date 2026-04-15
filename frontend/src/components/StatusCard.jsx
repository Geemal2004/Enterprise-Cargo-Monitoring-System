export default function StatusCard({ title, value, subtitle }) {
  return (
    <article className="panel-surface sensor-card">
      <p className="sensor-title">{title}</p>
      <p className="sensor-value">{value}</p>
      {subtitle ? <p className="sensor-subtitle">{subtitle}</p> : null}
    </article>
  );
}
