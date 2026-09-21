import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Thin signal progress along the top of the marketing page — reads as a
 * "telemetry scan" without scroll-jacking.
 */
export function ScrollSignal({ className }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (prefersReducedMotion()) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent",
        className
      )}
      aria-hidden="true"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-signal via-[#5ec8e8] to-signal shadow-glow"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

export default ScrollSignal;
