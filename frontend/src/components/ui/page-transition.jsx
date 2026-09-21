import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { durations, easings } from "@/lib/motion";

/**
 * Lightweight route transition — opacity only, never blocks interaction.
 */
export function PageTransition({ children }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  if (reduced) {
    return <div key={location.pathname}>{children}</div>;
  }

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durations.normal, ease: easings.entrance }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
