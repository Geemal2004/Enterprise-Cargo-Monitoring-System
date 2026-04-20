import FleetTable from "../components/FleetTable";
import { Link } from "react-router-dom";
import { useFleetDataContext } from "../context/FleetDataContext";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Cpu,
  Signal,
  Truck,
  Warehouse,
} from "lucide-react";

import "@fontsource/geist-sans";
import "@fontsource/geist-mono";

const StatCard = ({ title, value, subtitle, icon, tone }) => {
  const tones = {
    success: "border-emerald-500/60",
    warning: "border-amber-500/60",
    attention: "border-rose-500/60",
    default: "border-slate-200/60",
  };

  const iconTones = {
    success: "text-emerald-500",
    warning: "text-amber-500",
    attention: "text-rose-500",
    default: "text-slate-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-white border ${tones[tone] || tones.default} rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow`}
    >
      <div>
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 ${iconTones[tone] || iconTones.default}`}>
            {icon}
          </div>
        </div>
        <p className="text-4xl font-bold text-slate-800 tracking-tight">{value}</p>
      </div>
      <p className="text-xs text-slate-500 mt-4">{subtitle}</p>
    </motion.div>
  );
};

export default function FleetOverviewPage() {
  const { loading, error, entries, alertsByKey, fleetSummary } = useFleetDataContext();
  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const deviceOptions = Array.isArray(entries) ? entries.slice(0, 8) : [];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  };

  return (
    <div className="dashboard-page flex flex-col gap-4 font-sans text-slate-800 w-full animate-in fade-in duration-500">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Control Panel</p>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Fleet Command</h1>
          <p className="text-slate-500 mt-1">
            Live operational view across your entire supply chain.
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
          <Link
            className="no-underline bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 shadow-sm transition-colors hover:bg-slate-900 mt-4 md:mt-0"
            to="/analytics"
          >
            View Analytics <ArrowRight size={16} />
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col lg:flex-row lg:items-center gap-3 bg-white/90 border border-slate-200/70 rounded-xl px-4 py-3 shadow-sm"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          {todayLabel}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <span className="text-xs font-semibold text-slate-500">Device</span>
          <select
            className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            defaultValue={deviceOptions[0]?.containerId || "all"}
          >
            <option value="all">All active units</option>
            {deviceOptions.map((entry) => (
              <option key={`${entry.truckId}-${entry.containerId}`} value={entry.containerId}>
                {entry.truckId || "Truck"} / {entry.containerId || "Container"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
            <Signal className="w-3.5 h-3.5 text-emerald-500" />
            Live link
          </span>
          <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            Edge nodes active
          </span>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
          <motion.div variants={itemVariants}>
            <StatCard
              title="Total Trucks"
              value={fleetSummary.totalTrucks}
              subtitle="Tracked in the dashboard"
              icon={<Truck size={16} />}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard
              title="Online Trucks"
              value={fleetSummary.onlineTrucks}
              subtitle="Reporting within SLA window"
              icon={<Activity size={16} />}
              tone="success"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard
              title="Active Alerts"
              value={fleetSummary.activeAlerts}
              subtitle="Open incidents requiring attention"
              icon={<AlertTriangle size={16} />}
              tone="warning"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard
              title="Containers in Warning"
              value={fleetSummary.warningContainers}
              subtitle="Operational warnings detected"
              icon={<Warehouse size={16} />}
              tone="attention"
            />
          </motion.div>
        </motion.div>

      {error ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-rose-100 border border-rose-200 text-rose-800 rounded-lg p-4 text-center"
        >
          {error}
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white border text-slate-800 border-slate-200/60 rounded-xl shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Fleet Status</h3>
            <p className="text-sm text-slate-500">
              {loading ? "Refreshing live telemetry..." : `${entries.length} active truck/container units`}
            </p>
          </div>
          <div className="text-xs text-slate-400">Updated live every 5s</div>
        </div>

        <FleetTable entries={entries} alertsByKey={alertsByKey} />
      </motion.div>
    </div>
  );
}
