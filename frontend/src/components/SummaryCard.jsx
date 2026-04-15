export default function SummaryCard({ title, value, subtitle, tone = "default" }) {
  return (
    <article className={`summary-card summary-${tone}`}>
      <p className="summary-title">{title}</p>
      <p className="summary-value">{value}</p>
      {subtitle ? <p className="summary-subtitle">{subtitle}</p> : null}
    </article>
  );
}
