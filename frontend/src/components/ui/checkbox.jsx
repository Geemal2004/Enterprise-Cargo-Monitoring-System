import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef(function Checkbox(
  { className, label, description, error = false, disabled, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex items-start gap-2.5 text-sm text-foreground cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-input accent-[color:var(--cm-signal)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed"
        )}
        {...props}
      />
      {(label || description) && (
        <span className="grid gap-0.5">
          {label ? <span className="font-medium leading-snug">{label}</span> : null}
          {description ? (
            <span className="text-xs text-muted-foreground leading-snug">{description}</span>
          ) : null}
        </span>
      )}
    </label>
  );
});

export const Switch = forwardRef(function Switch(
  { className, checked = false, onCheckedChange, disabled, label, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-3 text-sm text-foreground cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        ref={ref}
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-fast ease-standard",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          checked ? "bg-signal border-signal" : "bg-muted border-border",
          disabled && "pointer-events-none"
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-fast ease-standard",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      {label ? <span className="font-medium">{label}</span> : null}
    </label>
  );
});

export default Checkbox;
