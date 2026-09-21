import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef(function Label(
  { className, required, children, hint, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn(
        "grid gap-1.5 text-sm font-medium text-[color:var(--cm-text-secondary)]",
        className
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="sr-only">required</span>
      ) : null}
      {hint}
    </label>
  );
});

/** Text-only label row for use above a sibling control */
export function FieldLabel({ className, htmlFor, required, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium text-[color:var(--cm-text-secondary)]",
        className
      )}
    >
      {children}
      {required ? (
        <span className="text-destructive ml-0.5" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef(function Input(
  { className, error = false, disabled, type = "text", id, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      id={id}
      type={type}
      disabled={disabled}
      aria-invalid={error || undefined}
      className={cn(
        "flex h-9 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground shadow-xs",
        "placeholder:text-muted-foreground",
        "transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-signal",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-destructive focus-visible:ring-destructive" : "border-input",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, error = false, disabled, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      disabled={disabled}
      aria-invalid={error || undefined}
      className={cn(
        "flex w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground shadow-xs",
        "placeholder:text-muted-foreground resize-y min-h-[96px]",
        "transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-signal",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-destructive focus-visible:ring-destructive" : "border-input",
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, error = false, disabled, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      disabled={disabled}
      aria-invalid={error || undefined}
      className={cn(
        "flex h-9 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground shadow-xs",
        "transition-colors duration-fast ease-standard appearance-auto",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-signal",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-destructive focus-visible:ring-destructive" : "border-input",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const FieldHint = ({ className, error, children }) => {
  if (!children) return null;
  return (
    <p
      className={cn(
        "text-xs",
        error ? "text-destructive" : "text-muted-foreground",
        className
      )}
      role={error ? "alert" : undefined}
    >
      {children}
    </p>
  );
};

export default Input;
