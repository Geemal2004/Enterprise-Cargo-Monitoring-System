export default function StatusPill({ tone = "info", children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
