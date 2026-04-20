import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerLabel,
} from "@/components/ui/map";
import { fetchTrips } from "../api/tripsApi";
import { fetchDeviceHistoryOptional } from "../api/telemetryApi";
import { useFleetDataContext } from "../context/FleetDataContext";
import {
  extractTelemetry,
  formatDateTime,
  formatRelativeTime,
  getReceivedAtMs,
} from "../types/telemetry";

const DEFAULT_CENTER = [4.69, 52.14];

function parseCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load trip details."
  );
}

export default function TripDetailPage() {
  const { tripCode } = useParams();
  const { getEntryByIds } = useFleetDataContext();

  const [trip, setTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [error, setError] = useState("");
  const [pathLoading, setPathLoading] = useState(false);
  const [pathCoordinates, setPathCoordinates] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadTrip() {
      setLoadingTrip(true);
      setError("");

      try {
        const payload = await fetchTrips({ limit: 2000 });
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const match = items.find((item) => item.trip_code === tripCode);

        if (!isMounted) return;

        if (!match) {
          setError("Trip not found.");
          setTrip(null);
        } else {
          setTrip(match);
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(extractErrorMessage(loadError));
        setTrip(null);
      } finally {
        if (isMounted) {
          setLoadingTrip(false);
        }
      }
    }

    loadTrip();
    return () => {
      isMounted = false;
    };
  }, [tripCode]);

  const telemetryEntry = useMemo(() => {
    if (!trip?.truck_code || !trip?.container_code) {
      return null;
    }
    return getEntryByIds(trip.truck_code, trip.container_code);
  }, [getEntryByIds, trip]);

  const telemetry = extractTelemetry(telemetryEntry);
  const gps = telemetry.gps || {};
  const liveFix =
    typeof gps.lat === "number" && typeof gps.lon === "number"
      ? { lat: gps.lat, lon: gps.lon }
      : null;

  const lastSeenMs = telemetryEntry ? getReceivedAtMs(telemetryEntry) : null;

  const mapCenter = useMemo(() => {
    if (pathCoordinates.length > 0) return pathCoordinates[0];
    if (liveFix) return [liveFix.lon, liveFix.lat];
    return DEFAULT_CENTER;
  }, [pathCoordinates, liveFix]);

  const startFix = useMemo(() => {
    if (pathCoordinates.length === 0) return null;
    const [lon, lat] = pathCoordinates[0];
    return { lat, lon };
  }, [pathCoordinates]);

  const lastPathFix = useMemo(() => {
    if (pathCoordinates.length === 0) return null;
    const [lon, lat] = pathCoordinates[pathCoordinates.length - 1];
    return { lat, lon };
  }, [pathCoordinates]);

  useEffect(() => {
    let isMounted = true;

    async function fetchPath() {
      if (!trip?.truck_code || !trip?.container_code) {
        setPathCoordinates([]);
        return;
      }

      setPathLoading(true);
      try {
        const payload = await fetchDeviceHistoryOptional(
          trip.truck_code,
          trip.container_code
        );

        if (!isMounted) return;

        const source = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.history)
              ? payload.history
              : Array.isArray(payload?.data)
                ? payload.data
                : [];

        const nextCoordinates = source
          .map((point) => {
            const gps = point?.gps || {};
            const lat = parseCoordinate(gps.lat ?? point?.lat ?? point?.latitude);
            const lon = parseCoordinate(gps.lon ?? point?.lng ?? point?.lon ?? point?.longitude);
            if (lat === null || lon === null) return null;
            return [lon, lat];
          })
          .filter(Boolean);

        setPathCoordinates(nextCoordinates);
      } catch (pathError) {
        if (!isMounted) return;
        console.error("Failed to fetch device path:", pathError);
        setPathCoordinates([]);
      } finally {
        if (isMounted) {
          setPathLoading(false);
        }
      }
    }

    fetchPath();
    return () => {
      isMounted = false;
    };
  }, [trip?.truck_code, trip?.container_code]);

  const statusTone = useMemo(() => {
    const status = String(trip?.status || "").toUpperCase();
    if (status === "IN_PROGRESS") return "online";
    if (status === "PLANNED") return "warning";
    if (status === "COMPLETED") return "offline";
    return "online";
  }, [trip?.status]);

  if (loadingTrip) {
    return <p className="empty-state">Loading trip details...</p>;
  }

  if (!trip) {
    return (
      <section className="panel-surface">
        <h2>Trip Detail</h2>
        <p className="empty-state">{error || "Trip not found."}</p>
        <Link className="table-action" to="/trips">
          Back to Trips
        </Link>
      </section>
    );
  }

  return (
    <div className="page-grid">
      <section className={`status-banner status-${statusTone}`}>
        <div>
          <p className="eyebrow">Trip Detail</p>
          <h2>{trip.trip_code}</h2>
          <p className="muted-text">
            {trip.origin_name} → {trip.destination_name}
          </p>
        </div>
        <div className="status-banner-right">
          <span className="pill pill-neutral">{trip.status}</span>
          <Link className="table-action" to="/trips">
            Back to Trips
          </Link>
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-title">Truck</p>
          <p className="summary-value">{trip.truck_code}</p>
          <p className="summary-subtitle">Fleet: {trip.fleet_name || trip.fleet_code || "-"}</p>
        </div>
        <div className="summary-card">
          <p className="summary-title">Container</p>
          <p className="summary-value">{trip.container_code}</p>
          <p className="summary-subtitle">Tenant: {trip.tenant_code || "-"}</p>
        </div>
        <div className="summary-card summary-success">
          <p className="summary-title">Planned Start</p>
          <p className="summary-value">{formatDateTime(trip.planned_start_at)}</p>
          <p className="summary-subtitle">Actual: {formatDateTime(trip.actual_start_at)}</p>
        </div>
      </section>

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Route & Live Position</h3>
          <p>Device path from the trip start and the latest live position.</p>
        </div>

        <div className="map-wrap">
          <Map center={mapCenter} zoom={7.5} scrollZoom={true} touchZoomRotate={true}>
            <MapControls position="bottom-right" showLocate={true} showZoom={true} />

            {pathCoordinates.length > 1 ? (
              <MapRoute
                coordinates={pathCoordinates}
                color="#2563eb"
                width={6}
                opacity={0.9}
              />
            ) : null}

            {startFix ? (
              <MapMarker longitude={startFix.lon} latitude={startFix.lat}>
                <MarkerContent>
                  <div className="size-5 rounded-full bg-green-500 border-2 border-white shadow-lg" />
                  <MarkerLabel position="top">Start</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ) : null}

            {liveFix ? (
              <MapMarker longitude={liveFix.lon} latitude={liveFix.lat}>
                <MarkerContent>
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <span className="absolute h-8 w-8 rounded-full bg-blue-500/20" />
                    <span className="absolute h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
                  </div>
                  <MarkerLabel position="top">Live</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ) : null}
            {!liveFix && lastPathFix ? (
              <MapMarker longitude={lastPathFix.lon} latitude={lastPathFix.lat}>
                <MarkerContent>
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <span className="absolute h-8 w-8 rounded-full bg-blue-500/20" />
                    <span className="absolute h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
                  </div>
                  <MarkerLabel position="top">Last</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ) : null}
          </Map>

          {pathLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <span className="muted-text">Loading path...</span>
            </div>
          ) : null}
        </div>

        <div className="summary-grid top-gap">
          <div className="summary-card">
            <p className="summary-title">Start Point</p>
            <p className="summary-value">{startFix ? "Trip start" : "-"}</p>
            <p className="summary-subtitle">
              {startFix ? `${startFix.lat.toFixed(5)}, ${startFix.lon.toFixed(5)}` : "Coordinates unavailable"}
            </p>
          </div>
          <div className="summary-card">
            <p className="summary-title">Latest Point</p>
            <p className="summary-value">{lastPathFix || liveFix ? "Latest" : "-"}</p>
            <p className="summary-subtitle">
              {liveFix
                ? `${liveFix.lat.toFixed(5)}, ${liveFix.lon.toFixed(5)}`
                : lastPathFix
                  ? `${lastPathFix.lat.toFixed(5)}, ${lastPathFix.lon.toFixed(5)}`
                  : "Coordinates unavailable"}
            </p>
          </div>
          <div className="summary-card summary-warning">
            <p className="summary-title">Path Points</p>
            <p className="summary-value">
              {pathCoordinates.length > 0 ? pathCoordinates.length : "-"}
            </p>
            <p className="summary-subtitle">
              {lastSeenMs ? `Last update ${formatRelativeTime(lastSeenMs)}` : "No path data"}
            </p>
          </div>
        </div>
      </section>

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Live Telemetry</h3>
          <p>Current position from the active truck/container.</p>
        </div>

        {telemetryEntry ? (
          <div className="summary-grid">
            <div className="summary-card">
              <p className="summary-title">Last Update</p>
              <p className="summary-value">
                {lastSeenMs ? formatRelativeTime(lastSeenMs) : "-"}
              </p>
              <p className="summary-subtitle">
                {lastSeenMs ? formatDateTime(lastSeenMs) : "No recent telemetry"}
              </p>
            </div>
            <div className="summary-card">
              <p className="summary-title">Live Coordinates</p>
              <p className="summary-value">
                {liveFix ? `${liveFix.lat.toFixed(5)}, ${liveFix.lon.toFixed(5)}` : "-"}
              </p>
              <p className="summary-subtitle">
                {telemetry.status?.gpsFix ? "GPS lock" : "GPS searching"}
              </p>
            </div>
            <div className="summary-card summary-success">
              <p className="summary-title">Details</p>
              <p className="summary-value">Truck / Container</p>
              <p className="summary-subtitle">
                <Link
                  className="table-action"
                  to={`/detail/${trip.truck_code}/${trip.container_code}`}
                >
                  Open asset detail
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <p className="empty-state">Live telemetry not available yet for this trip.</p>
        )}
      </section>
    </div>
  );
}
