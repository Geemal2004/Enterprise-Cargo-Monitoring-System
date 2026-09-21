import { Link } from "react-router-dom";
import {
  deriveDeviceStatus,
  extractTelemetry,
  formatRelativeTime,
  getDeviceKey,
  getReceivedAtMs,
} from "../types/telemetry";
import { Activity, AlertCircle, CheckCircle2, Navigation, Thermometer, Wind, Zap, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

function tempValue(value) {
  return typeof value === "number" ? `${value.toFixed(1)}°C` : "--";
}

function gasValue(value) {
  return typeof value === "number" ? `${Math.round(value)}` : "--";
}

export default function FleetTable({ entries, alertsByKey }) {
  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No live units yet"
        description="Fleet rows will appear automatically when telemetry is received."
      />
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
            let overallTone = deviceStatus.tone || "online";
            if (deviceStatus.tone === "critical" || deviceStatus.tone === "warning") {
              overallStatusIcon = AlertCircle;
            } else if (deviceStatus.tone === "offline" || deviceStatus.tone === "muted") {
              overallStatusIcon = Clock;
            }

            return (
              <tr 
                key={key} 
                className="hover:bg-slate-50/80 transition-colors group"
              >
                <td className="px-4 py-3">
                  <Badge tone={overallTone} icon={overallStatusIcon}>
                    {deviceStatus.label}
                  </Badge>
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
                      {gasValue(gas.smokePpm ?? gas.mq2Raw)} ppm
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <Badge tone={motion.shock ? "critical" : "ok"} icon={Zap}>
                      {motion.shock ? "Impact Det." : "Clear"}
                    </Badge>
                    <Badge tone={status.gpsFix ? "info" : "muted"} icon={Navigation}>
                      {status.gpsFix ? "Locked" : "Searching"}
                    </Badge>
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
                    className="no-underline inline-flex items-center justify-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-semibold text-signal-foreground shadow-xs transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    to={`/detail/${entry.truckId}/${entry.containerId}`}
                  >
                    View Details
                    <ChevronRight className="h-4 w-4 opacity-70" aria-hidden="true" />
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
