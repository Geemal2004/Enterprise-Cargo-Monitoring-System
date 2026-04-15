import { useEffect, useMemo, useState } from "react";
import { fetchDeviceHistoryOptional } from "../api/telemetryApi";
import { extractHistoryFromPayload } from "../types/telemetry";

export function useDeviceHistory(truckId, containerId, liveFallbackPoints) {
  const [historyPoints, setHistoryPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("fallback");

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      if (!truckId || !containerId) {
        setHistoryPoints([]);
        setSource("fallback");
        return;
      }

      setLoading(true);
      try {
        const payload = await fetchDeviceHistoryOptional(truckId, containerId);
        if (cancelled) return;

        const points = extractHistoryFromPayload(payload);
        if (points.length > 1) {
          setHistoryPoints(points);
          setSource("backend");
        } else {
          setHistoryPoints([]);
          setSource("fallback");
        }
      } catch (_error) {
        if (!cancelled) {
          setHistoryPoints([]);
          setSource("fallback");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [truckId, containerId]);

  const points = useMemo(() => {
    if (source === "backend" && historyPoints.length > 1) {
      return historyPoints;
    }
    return liveFallbackPoints || [];
  }, [historyPoints, liveFallbackPoints, source]);

  return {
    points,
    loading,
    hasBackendHistory: source === "backend" && historyPoints.length > 1,
    source,
  };
}
