import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export function Tooltip({ content, children, side = "top", className }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? tooltipId : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-signal-foreground shadow-md",
            positions[side] || positions.top
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export default Tooltip;
