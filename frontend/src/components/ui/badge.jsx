import { cn } from "@/lib/utils";

const toneClasses = {
  default: "bg-muted text-foreground border-border",
  online: "bg-[color:var(--cm-success-bg)] text-[color:var(--cm-success)] border-[color:var(--cm-success-border)]",
  ok: "bg-[color:var(--cm-success-bg)] text-[color:var(--cm-success)] border-[color:var(--cm-success-border)]",
  success: "bg-[color:var(--cm-success-bg)] text-[color:var(--cm-success)] border-[color:var(--cm-success-border)]",
  warning: "bg-[color:var(--cm-warning-bg)] text-[color:var(--cm-warning)] border-[color:var(--cm-warning-border)]",
  offline: "bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)] border-[color:var(--cm-danger-border)]",
  critical: "bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)] border-[color:var(--cm-danger-border)]",
  attention: "bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)] border-[color:var(--cm-danger-border)]",
  destructive: "bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)] border-[color:var(--cm-danger-border)]",
  info: "bg-[color:var(--cm-info-bg)] text-[color:var(--cm-info)] border-[color:var(--cm-info-border)]",
  muted: "bg-muted text-muted-foreground border-border",
  signal: "bg-signal-muted text-signal border-transparent",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[0.68rem]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function Badge({
  className,
  tone = "default",
  size = "md",
  icon: Icon,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold leading-none whitespace-nowrap",
        toneClasses[tone] || toneClasses.default,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export default Badge;
