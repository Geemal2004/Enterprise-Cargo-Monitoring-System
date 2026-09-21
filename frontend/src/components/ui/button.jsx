import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variantClasses = {
  primary:
    "bg-signal text-signal-foreground border-transparent hover:bg-signal-hover active:bg-signal-hover shadow-xs",
  secondary:
    "bg-secondary text-secondary-foreground border-border hover:bg-muted active:bg-muted",
  outline:
    "bg-transparent text-foreground border-border hover:bg-muted/80 active:bg-muted",
  ghost:
    "bg-transparent text-foreground border-transparent hover:bg-muted active:bg-muted",
  destructive:
    "bg-destructive text-destructive-foreground border-transparent hover:opacity-90 active:opacity-90",
  ink:
    "bg-ink text-signal-foreground border-transparent hover:bg-ink-soft active:bg-ink-soft shadow-xs",
};

const sizeClasses = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-sm",
  md: "h-9 px-3.5 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-base gap-2 rounded-md",
  icon: "h-9 w-9 p-0 rounded-md",
};

export const Button = forwardRef(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    type = "button",
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-semibold border transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export default Button;
