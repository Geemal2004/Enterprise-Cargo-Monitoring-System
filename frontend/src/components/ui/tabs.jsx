import { createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/utils";

const TabsContext = createContext(null);

export function Tabs({ defaultValue, value, onValueChange, children, className }) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const setCurrent = onValueChange ?? setInternal;
  const baseId = useId();

  return (
    <TabsContext.Provider value={{ current, setCurrent, baseId }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className, disabled }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const selected = ctx.current === value;
  const triggerId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  return (
    <button
      id={triggerId}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => ctx.setCurrent(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");
  if (ctx.current !== value) return null;

  const triggerId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={triggerId}
      tabIndex={0}
      className={cn("mt-4 focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}

export default Tabs;
