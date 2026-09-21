import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

export const Card = forwardRef(function Card({ className, tone = "default", ...props }, ref) {
  const tones = {
    default: "border-border",
    success: "border-[color:var(--cm-success-border)] border-t-[3px] border-t-[color:var(--cm-success)]",
    warning: "border-[color:var(--cm-warning-border)] border-t-[3px] border-t-[color:var(--cm-warning)]",
    attention: "border-[color:var(--cm-danger-border)] border-t-[3px] border-t-[color:var(--cm-danger)]",
    signal: "border-[color:var(--cm-signal)]/30 border-t-[3px] border-t-signal",
  };

  return (
    <article
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        tones[tone] || tones.default,
        className
      )}
      {...props}
    />
  );
});

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-base font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />;
}

function AnimatedMetricValue({ value }) {
  const display = useCountUp(value, { duration: 720 });
  return (
    <p className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
      {display}
    </p>
  );
}

/** KPI / summary metric card */
export function MetricCard({
  title,
  value,
  subtitle,
  tone = "default",
  icon,
  className,
  animateValue = true,
}) {
  const isNumeric = typeof value === "number" && Number.isFinite(value);

  return (
    <Card tone={tone} className={cn("min-h-[112px]", className)}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon ? (
            <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
              {icon}
            </span>
          ) : null}
        </div>
        {animateValue && isNumeric ? (
          <AnimatedMetricValue value={value} />
        ) : (
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        )}
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}

export default Card;
