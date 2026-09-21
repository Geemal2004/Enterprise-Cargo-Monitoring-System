import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, size = "md", label = "Loading" }) {
  const sizes = {
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-8 w-8",
  };

  return (
    <span role="status" aria-label={label} className={cn("inline-flex", className)}>
      <Loader2 className={cn("animate-spin text-signal", sizes[size] || sizes.md)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonBlock({ lines = 3, className }) {
  return (
    <div className={cn("grid gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3", index === lines - 1 ? "w-[66%]" : "w-full")}
        />
      ))}
    </div>
  );
}

export default Spinner;
