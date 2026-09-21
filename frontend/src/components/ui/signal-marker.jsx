import { cn } from "@/lib/utils";

/** Pulsing signal pin — Control Tower map signature */
export function SignalMarker({ className, label, size = "md" }) {
  const sizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      <span className="absolute inset-0 rounded-full bg-signal/40 cm-signal-ping" />
      <span
        className={cn(
          "relative rounded-full border-2 border-white bg-signal shadow-md",
          sizes[size] || sizes.md
        )}
      />
    </span>
  );
}

/** Compact live indicator for status strips */
export function LiveDot({ className, label = "Live" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--cm-success)] opacity-60 cm-signal-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--cm-success)]" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default SignalMarker;
