import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchActiveAlerts,
  fetchBackendHealth,
  fetchFleetSummaryOptional,
  fetchLatestTelemetry,
} from "../api/telemetryApi";
import {
  deriveFleetSummary,
  extractAlerts,
  extractLatestEntries,
  getAlertPayload,
  getDeviceKey,
  groupAlertsByDevice,
  normalizeSeverity,
  pushLiveHistory,
  severityLabel,
} from "../types/telemetry";

const FleetDataContext = createContext(null);

const DEFAULT_SUMMARY = {
  totalTrucks: 0,
  onlineTrucks: 0,
  activeAlerts: 0,
  warningContainers: 0,
};

function buildAlertId(alertItem) {
  const code = String(getAlertPayload(alertItem).code || "ALERT").toUpperCase();
  const key = alertItem && alertItem.key ? alertItem.key : `${alertItem?.truckId || "UNKNOWN"}::${alertItem?.containerId || "UNKNOWN"}`;
  return `${key}::${code}`;
}

function updateAlertTimeline(previousTimeline, activeAlerts) {
  const nowIso = new Date().toISOString();
  const nextById = {};

  for (const item of previousTimeline || []) {
    nextById[item.id] = { ...item };
  }

  const activeIds = new Set();

  for (const alertItem of activeAlerts || []) {
    const id = buildAlertId(alertItem);
    const alert = getAlertPayload(alertItem);
    const level = normalizeSeverity(alert.severity);

    activeIds.add(id);

    const existing = nextById[id];
    nextById[id] = {
      id,
      key: alertItem.key,
      truckId: alertItem.truckId || "UNKNOWN_TRUCK",
      containerId: alertItem.containerId || "UNKNOWN_CONTAINER",
      code: alert.code || "ALERT",
      message: alert.message || "Alert triggered",
      value: alert.value,
      severity: severityLabel(level),
      severityLevel: level,
      firstSeenAt: existing ? existing.firstSeenAt : nowIso,
      lastSeenAt: nowIso,
      resolvedAt: null,
      active: true,
    };
  }

  for (const id of Object.keys(nextById)) {
    if (!activeIds.has(id)) {
      const previous = nextById[id];
      nextById[id] = {
        ...previous,
        active: false,
        resolvedAt: previous.resolvedAt || nowIso,
      };
    }
  }

  return Object.values(nextById)
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, 500);
}

export function FleetDataProvider({ children, refreshIntervalMs = 5000 }) {
  const [entries, setEntries] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [historyByKey, setHistoryByKey] = useState({});
  const [alertTimeline, setAlertTimeline] = useState([]);
  const [fleetSummaryApi, setFleetSummaryApi] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [latestResponse, alertsResponse, healthResponse, optionalSummary] = await Promise.all([
        fetchLatestTelemetry(),
        fetchActiveAlerts(),
        fetchBackendHealth().catch(() => null),
        fetchFleetSummaryOptional().catch(() => null),
      ]);

      const latestEntries = extractLatestEntries(latestResponse.data);
      const activeAlerts = extractAlerts(alertsResponse.data);

      setEntries(latestEntries);
      setAlerts(activeAlerts);
      setBackendHealth(healthResponse ? healthResponse.data : null);
      setFleetSummaryApi(optionalSummary);
      setLastUpdated(new Date());
      setHistoryByKey((previous) => pushLiveHistory(previous, latestEntries, 96));
      setAlertTimeline((previous) => updateAlertTimeline(previous, activeAlerts));
      setError("");
    } catch (refreshError) {
      const message =
        refreshError?.response?.data?.message ||
        refreshError?.message ||
        "Failed to refresh fleet data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refresh, refreshIntervalMs]);

  const entriesByKey = useMemo(() => {
    const byKey = {};
    for (const entry of entries) {
      byKey[getDeviceKey(entry)] = entry;
    }
    return byKey;
  }, [entries]);

  const alertsByKey = useMemo(() => groupAlertsByDevice(alerts), [alerts]);

  const fleetSummary = useMemo(() => {
    if (fleetSummaryApi && typeof fleetSummaryApi === "object") {
      return {
        ...DEFAULT_SUMMARY,
        ...fleetSummaryApi,
      };
    }

    return {
      ...DEFAULT_SUMMARY,
      ...deriveFleetSummary(entries, alerts),
    };
  }, [alerts, entries, fleetSummaryApi]);

  const getEntryByIds = useCallback(
    (truckId, containerId) => {
      const key = `${truckId}::${containerId}`;
      return entriesByKey[key] || null;
    },
    [entriesByKey]
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      lastUpdated,
      entries,
      entriesByKey,
      alerts,
      alertsByKey,
      alertTimeline,
      historyByKey,
      fleetSummary,
      backendHealth,
      refresh,
      getEntryByIds,
    }),
    [
      loading,
      error,
      lastUpdated,
      entries,
      entriesByKey,
      alerts,
      alertsByKey,
      alertTimeline,
      historyByKey,
      fleetSummary,
      backendHealth,
      refresh,
      getEntryByIds,
    ]
  );

  return <FleetDataContext.Provider value={value}>{children}</FleetDataContext.Provider>;
}

export function useFleetDataContext() {
  const context = useContext(FleetDataContext);
  if (!context) {
    throw new Error("useFleetDataContext must be used inside FleetDataProvider.");
  }
  return context;
}
