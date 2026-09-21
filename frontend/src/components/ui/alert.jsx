import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const toneConfig = {
  info: {
    icon: Info,
    classes:
      "border-[color:var(--cm-info-border)] bg-[color:var(--cm-info-bg)] text-[color:var(--cm-info)]",
  },
  success: {
    icon: CheckCircle2,
    classes:
      "border-[color:var(--cm-success-border)] bg-[color:var(--cm-success-bg)] text-[color:var(--cm-success)]",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "border-[color:var(--cm-warning-border)] bg-[color:var(--cm-warning-bg)] text-[color:var(--cm-warning)]",
  },
  error: {
    icon: AlertCircle,
    classes:
      "border-[color:var(--cm-danger-border)] bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)]",
  },
  destructive: {
    icon: AlertCircle,
    classes:
      "border-[color:var(--cm-danger-border)] bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)]",
  },
};

export function Alert({
  className,
  tone = "info",
  title,
  children,
  onDismiss,
  role,
}) {
  const config = toneConfig[tone] || toneConfig.info;
  const Icon = config.icon;
  const alertRole = role || (tone === "error" || tone === "destructive" ? "alert" : "status");

  return (
    <div
      role={alertRole}
      className={cn(
        "relative flex gap-3 rounded-lg border px-3.5 py-3 text-sm shadow-xs",
        config.classes,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1", "opacity-95")}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded-sm p-1 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export default Alert;
