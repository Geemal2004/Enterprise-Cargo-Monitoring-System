export default function StatusCard({ title, value, subtitle }) {
  return (
    <article className="panel">
      <p className="card-title">{title}</p>
      <p className="card-value">{value}</p>
      {subtitle ? <p className="card-sub">{subtitle}</p> : null}
    </article>
  );
}
