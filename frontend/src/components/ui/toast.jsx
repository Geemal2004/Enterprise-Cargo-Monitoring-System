import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastContext = createContext(null);

const toneClasses = {
  default: "border-border bg-card text-foreground",
  success: "border-[color:var(--cm-success-border)] bg-[color:var(--cm-success-bg)] text-[color:var(--cm-success)]",
  warning: "border-[color:var(--cm-warning-border)] bg-[color:var(--cm-warning-bg)] text-[color:var(--cm-warning)]",
  destructive: "border-[color:var(--cm-danger-border)] bg-[color:var(--cm-danger-bg)] text-[color:var(--cm-danger)]",
  info: "border-[color:var(--cm-info-border)] bg-[color:var(--cm-info-bg)] text-[color:var(--cm-info)]",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "default", duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((items) => [...items, { id, title, description, tone }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[1100] flex w-full max-w-sm flex-col gap-2 p-2"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border px-3.5 py-3 shadow-md",
              "animate-in fade-in-0 slide-in-from-bottom-2 duration-normal",
              toneClasses[item.tone] || toneClasses.default
            )}
          >
            <div className="min-w-0 flex-1">
              {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
              {item.description ? (
                <p className="mt-0.5 text-xs opacity-90">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="rounded-sm p-1 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => dismiss(item.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export default ToastProvider;
