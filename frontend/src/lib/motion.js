/**
 * Motion presets aligned with design tokens (Framer Motion + CSS).
 * Prefer opacity/transform only. Always respect prefers-reduced-motion.
 */
export const easings = {
  standard: [0.22, 1, 0.36, 1],
  emphasized: [0.16, 1, 0.3, 1],
  entrance: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
};

export const durations = {
  instant: 0.08,
  fast: 0.14,
  normal: 0.22,
  moderate: 0.32,
  slow: 0.48,
  deliberate: 0.7,
};

export const stagger = {
  xs: 0.04,
  sm: 0.06,
  md: 0.1,
};

/** Detect reduced motion once per call site / hook. */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fade + slight rise — page/section entrance */
export function fadeUp(reduced = prefersReducedMotion()) {
  if (reduced) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: durations.moderate, ease: easings.entrance },
  };
}

/** Stagger children container */
export function staggerContainer(reduced = prefersReducedMotion()) {
  if (reduced) {
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1, transition: { staggerChildren: 0 } },
    };
  }
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger.sm, delayChildren: 0.04 },
    },
  };
}

export function staggerItem(reduced = prefersReducedMotion()) {
  if (reduced) {
    return {
      hidden: { opacity: 1, y: 0 },
      visible: { opacity: 1, y: 0 },
    };
  }
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: durations.moderate, ease: easings.entrance },
    },
  };
}

/** Subtle press feedback for primary CTAs */
export function pressable(reduced = prefersReducedMotion()) {
  if (reduced) {
    return {};
  }
  return {
    whileHover: { y: -1 },
    whileTap: { scale: 0.98 },
    transition: { duration: durations.fast, ease: easings.standard },
  };
}
