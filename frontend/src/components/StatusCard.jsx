export default function StatusCard({ title, value, subtitle, icon, iconTone }) {
  return (
    <article className="panel-surface sensor-card">
      <div className="sensor-head">
        {icon ? (
          <div className={`sensor-icon ${iconTone || ""}`.trim()}>
            {icon}
          </div>
        ) : null}
        <div>
          <p className="sensor-title">{title}</p>
          {subtitle ? <p className="sensor-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <p className="sensor-value">{value}</p>
    </article>
  );
}
