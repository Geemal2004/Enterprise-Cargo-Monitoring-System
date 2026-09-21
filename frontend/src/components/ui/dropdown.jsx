import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DropdownContext = createContext(null);

export function Dropdown({ children, className }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, menuId }}>
      <div ref={rootRef} className={cn("relative inline-flex", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({ children, className, ...props }) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownTrigger must be used within Dropdown");

  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      aria-controls={ctx.menuId}
      className={cn(className)}
      onClick={() => ctx.setOpen((value) => !value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenu({ children, className, align = "start" }) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenu must be used within Dropdown");
  if (!ctx.open) return null;

  return (
    <div
      id={ctx.menuId}
      role="menu"
      className={cn(
        "absolute z-50 mt-2 min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-fast",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownItem({ children, className, destructive = false, onSelect, disabled }) {
  const ctx = useContext(DropdownContext);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center rounded-sm px-2.5 py-2 text-left text-sm transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:bg-muted",
        "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
        destructive ? "text-destructive" : "text-foreground",
        className
      )}
      onClick={() => {
        onSelect?.();
        ctx?.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

export default Dropdown;
