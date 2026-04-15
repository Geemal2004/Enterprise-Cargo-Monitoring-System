import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchActiveAlerts, fetchLatestTelemetry } from "../api/telemetryApi";
import {
  OFFLINE_THRESHOLD_MS,
  extractAlerts,
  extractHistoryPoints,
  extractLatestEntries,
  extractTelemetry,
  getDeviceKey,
  getDeviceLabel,
} from "../types/telemetry";

export function useDashboardData(refreshIntervalMs = 5000) {
  const [entries, setEntries] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [latestResponse, alertsResponse] = await Promise.all([
        fetchLatestTelemetry(),
        fetchActiveAlerts(),
      ]);

      const latestEntries = extractLatestEntries(latestResponse.data);
      const activeAlerts = extractAlerts(alertsResponse.data);

      setEntries(latestEntries);
      setAlerts(activeAlerts);
      setLastUpdated(new Date());
      setError("");

      if (latestEntries.length > 0) {
        const hasSelected = latestEntries.some((entry) => getDeviceKey(entry) === selectedKey);
        if (!hasSelected) {
          setSelectedKey(getDeviceKey(latestEntries[0]));
        }
      } else {
        setSelectedKey("");
      }
    } catch (refreshError) {
      const message =
        refreshError?.response?.data?.message ||
        refreshError?.message ||
        "Failed to refresh dashboard data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refresh, refreshIntervalMs]);

  const selectedEntry = useMemo(() => {
    if (entries.length === 0) return null;
    return entries.find((entry) => getDeviceKey(entry) === selectedKey) || entries[0];
  }, [entries, selectedKey]);

  const selectedTelemetry = useMemo(() => extractTelemetry(selectedEntry), [selectedEntry]);

  const selectedDeviceAlerts = useMemo(() => {
    if (!selectedEntry) return [];
    const key = getDeviceKey(selectedEntry);
    return alerts.filter((item) => item.key === key);
  }, [alerts, selectedEntry]);

  const historyPoints = useMemo(() => extractHistoryPoints(selectedEntry), [selectedEntry]);
  const hasBackendHistory = historyPoints.length > 1;

  const isOffline = useMemo(() => {
    if (!selectedEntry) return true;

    const offlineAlert = selectedDeviceAlerts.some(
      (item) => item.alert && item.alert.code === "OFFLINE"
    );

    const receivedAtMs =
      selectedEntry.receivedAtMs ||
      selectedTelemetry.receivedAtMs ||
      (selectedEntry.receivedAt ? Date.parse(selectedEntry.receivedAt) : 0);

    if (!receivedAtMs) {
      return offlineAlert;
    }

    const stale = Date.now() - receivedAtMs > OFFLINE_THRESHOLD_MS;
    return offlineAlert || stale;
  }, [selectedDeviceAlerts, selectedEntry, selectedTelemetry]);

  const devices = useMemo(
    () => entries.map((entry) => ({ key: getDeviceKey(entry), label: getDeviceLabel(entry) })),
    [entries]
  );

  return {
    loading,
    error,
    lastUpdated,
    entries,
    alerts,
    selectedEntry,
    selectedTelemetry,
    selectedDeviceAlerts,
    selectedKey,
    setSelectedKey,
    devices,
    hasBackendHistory,
    historyPoints,
    isOffline,
  };
}
