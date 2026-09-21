import { Badge } from "@/components/ui/badge";

/** @deprecated Prefer Badge directly; kept for existing imports. */
export default function StatusPill({ tone = "info", children, className, icon }) {
  return (
    <Badge tone={tone} icon={icon} className={className}>
      {children}
    </Badge>
  );
}
