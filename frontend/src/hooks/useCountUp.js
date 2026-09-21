import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Animates numeric values for KPI reveals. Skips animation under reduced motion
 * and when the value is non-numeric.
 */
export function useCountUp(value, { duration = 700, decimals = 0 } = {}) {
  const target = typeof value === "number" && Number.isFinite(value) ? value : null;
  const [display, setDisplay] = useState(target ?? value);
  const previousRef = useRef(target ?? 0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (target === null) {
      setDisplay(value);
      return undefined;
    }

    if (prefersReducedMotion()) {
      previousRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const from = previousRef.current;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      setDisplay(decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, value, duration, decimals]);

  return display;
}

export default useCountUp;
