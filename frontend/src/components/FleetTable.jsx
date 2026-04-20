import { Link } from "react-router-dom";
import {
  deriveDeviceStatus,
  extractTelemetry,
  formatRelativeTime,
  getDeviceKey,
  getReceivedAtMs,
} from "../types/telemetry";
import { Activity, AlertCircle, CheckCircle2, Navigation, Thermometer, Wind, Zap, Clock, ChevronRight } from "lucide-react";

function tempValue(value) {
  return typeof value === "number" ? `${value.toFixed(1)}°C` : "--";
}

function gasValue(value) {
  return typeof value === "number" ? `${Math.round(value)}` : "--";
}

// Inline Pill component to allow rich Tailwind styling in the table directly
function TableStatusPill({ tone = "ok", icon: Icon, children }) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-rose-50 text-rose-700 border-rose-200",
    muted: "bg-slate-50 text-slate-600 border-slate-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const bgTone = tones[tone] || tones.muted;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bgTone}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

export default function FleetTable({ entries, alertsByKey }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center">
        <Activity className="w-12 h-12 text-slate-300 mb-4 animate-pulse" />
        <p className="text-lg font-medium text-slate-600">No live units yet.</p>
        <p className="text-sm mt-1">Fleet rows will appear automatically when telemetry is received.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-200/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-3">Current Status</th>
            <th className="px-4 py-3">Identifiers</th>
            <th className="px-4 py-3">Environment</th>
            <th className="px-4 py-3">Motion & GPS</th>
            <th className="px-4 py-3">Last Update</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const key = getDeviceKey(entry);
            const telemetry = extractTelemetry(entry);
            const env = telemetry.env || {};
            const gas = telemetry.gas || {};
            const motion = telemetry.motion || {};
            const status = telemetry.status || {};
            const deviceAlerts = alertsByKey[key] || [];
            const deviceStatus = deriveDeviceStatus(entry, deviceAlerts);

            let overallStatusIcon = CheckCircle2;
            let overallTone = "ok";
            if (deviceStatus.tone === "critical") { overallTone = "critical"; overallStatusIcon = AlertCircle; }
            else if (deviceStatus.tone === "warning") { overallTone = "warning"; overallStatusIcon = AlertCircle; }
            else if (deviceStatus.tone === "muted") { overallTone = "muted"; overallStatusIcon = Clock; }

            return (
              <tr 
                key={key} 
                className="hover:bg-slate-50/80 transition-colors group"
              >
                <td className="px-4 py-3">
                  <TableStatusPill tone={overallTone} icon={overallStatusIcon}>
                    {deviceStatus.label}
                  </TableStatusPill>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 text-sm">
                      {entry.truckId || "Truck Unknown"}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5">
                      {entry.containerId || "Container Unknown"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5 align-start justify-center">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Thermometer className="w-4 h-4 text-slate-400" />
                      {tempValue(env.temperatureC)}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Wind className="w-4 h-4 text-slate-400" />
                      {gasValue(gas.mq2Raw)} ppm
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <TableStatusPill tone={motion.shock ? "critical" : "ok"} icon={Zap}>
                      {motion.shock ? "Impact Det." : "Clear"}
                    </TableStatusPill>
                    <TableStatusPill tone={status.gpsFix ? "info" : "muted"} icon={Navigation}>
                      {status.gpsFix ? "Locked" : "Searching"}
                    </TableStatusPill>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {formatRelativeTime(getReceivedAtMs(entry))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link 
                    className="no-underline inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-all shadow-sm" 
                    to={`/detail/${entry.truckId}/${entry.containerId}`}
                  >
                    View Details
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
