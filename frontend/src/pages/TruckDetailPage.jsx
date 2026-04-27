import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CargoHealthPanel from "../components/CargoHealthPanel";
import DeviceHealthPanel from "../components/DeviceHealthPanel";
import StatusCard from "../components/StatusCard";
import StatusPill from "../components/StatusPill";
import TrendCharts from "../components/TrendCharts";
import TruckMap from "../components/TruckMap";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerLabel,
} from "@/components/ui/map";
import {
  GasIcon,
  GpsIcon,
  HumidityIcon,
  PressureIcon,
  ShockIcon,
  TiltIcon,
  TemperatureIcon,
} from "../components/MetricIcons";
import { fetchTrips } from "../api/tripsApi";
import { useFleetDataContext } from "../context/FleetDataContext";
import { useDeviceHistory } from "../hooks/useDeviceHistory";
import {
  deriveDeviceStatus,
  extractHistoryPoints,
  extractTelemetry,
  formatDateTime,
  formatRelativeTime,
  getAlertPayload,
  getDeviceKey,
  getReceivedAtMs,
  normalizeSeverity,
  severityLabel,
} from "../types/telemetry";

const DEFAULT_CENTER = [4.69, 52.14];

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRoutePoint(meta, key, fallbackName) {
  const node = meta && meta[key] ? meta[key] : null;
  if (!node) {
    return null;
  }
  const lat = parseCoordinate(node.lat);
  const lon = parseCoordinate(node.lon);
  if (lat === null || lon === null) {
    return null;
  }
  return {
    lat,
    lon,
    name: node.name || fallbackName,
  };
}

function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load trip data."
  );
}

function valueOrDash(value, digits = 1, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(digits)}${suffix}`;
}

export default function TruckDetailPage() {
  const { truckId, containerId } = useParams();
  const {
    loading,
    entries,
    alertsByKey,
    historyByKey,
    backendHealth,
    getEntryByIds,
  } = useFleetDataContext();

  const [activeTrip, setActiveTrip] = useState(null);
  const [tripError, setTripError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const routeEntry = truckId && containerId ? getEntryByIds(truckId, containerId) : null;
  const selectedEntry = routeEntry || entries[0] || null;

  const selectedKey = selectedEntry ? getDeviceKey(selectedEntry) : null;
  const telemetry = selectedEntry ? extractTelemetry(selectedEntry) : {};
  const env = telemetry.env || {};
  const gas = telemetry.gas || {};
  const motion = telemetry.motion || {};
  const gps = telemetry.gps || {};
  const status = telemetry.status || {};

  const deviceAlerts = selectedKey ? (alertsByKey[selectedKey] || []) : [];
  const deviceStatus = selectedEntry ? deriveDeviceStatus(selectedEntry, deviceAlerts) : { tone: "slate", label: "Loading...", code: "loading" };

  const fallbackHistory = selectedKey ? (historyByKey[selectedKey] || extractHistoryPoints(selectedEntry)) : [];
  const history = useDeviceHistory(selectedEntry?.truckId, selectedEntry?.containerId, fallbackHistory);

  const lastSeenMs = selectedEntry ? getReceivedAtMs(selectedEntry) : 0;
  const showingFallback = !routeEntry && entries.length > 0 && truckId && containerId;

  useEffect(() => {
    let isMounted = true;

    async function loadTrip() {
      if (!selectedEntry?.truckId || !selectedEntry?.containerId) {
        setActiveTrip(null);
        setTripError("");
        return;
      }

      setTripError("");
      try {
        const payload = await fetchTrips({
          truckCode: selectedEntry.truckId,
          containerCode: selectedEntry.containerId,
          status: "IN_PROGRESS",
          limit: 1,
        });
        const items = Array.isArray(payload?.items) ? payload.items : [];

        if (!isMounted) return;
        setActiveTrip(items[0] || null);
      } catch (loadError) {
        if (!isMounted) return;
        setTripError(extractErrorMessage(loadError));
        setActiveTrip(null);
      }
    }

    loadTrip();
    return () => {
      isMounted = false;
    };
  }, [selectedEntry?.truckId, selectedEntry?.containerId]);

  const metadata = useMemo(() => {
    if (!activeTrip) return {};
    if (activeTrip.metadata_json && typeof activeTrip.metadata_json === "object") {
      return activeTrip.metadata_json;
    }
    if (activeTrip.metadataJson && typeof activeTrip.metadataJson === "object") {
      return activeTrip.metadataJson;
    }
    return {};
  }, [activeTrip]);

  const origin = useMemo(
    () => extractRoutePoint(metadata, "origin", activeTrip?.origin_name || "Origin"),
    [metadata, activeTrip]
  );
  const destination = useMemo(
    () => extractRoutePoint(metadata, "destination", activeTrip?.destination_name || "Destination"),
    [metadata, activeTrip]
  );

  const liveFix =
    typeof gps.lat === "number" && typeof gps.lon === "number"
      ? { lat: gps.lat, lon: gps.lon }
      : null;

  const mapCenter = useMemo(() => {
    if (origin) return [origin.lon, origin.lat];
    if (liveFix) return [liveFix.lon, liveFix.lat];
    if (destination) return [destination.lon, destination.lat];
    return DEFAULT_CENTER;
  }, [origin, destination, liveFix]);

  useEffect(() => {
    let isMounted = true;

    async function fetchRoute() {
      if (!activeTrip || !origin || !destination) {
        setRouteCoordinates([]);
        setRouteInfo(null);
        return;
      }

      setRouteLoading(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (!isMounted) return;

        if (Array.isArray(data.routes) && data.routes.length > 0) {
          const route = data.routes[0];
          setRouteCoordinates(route.geometry.coordinates || []);
          setRouteInfo({
            distance: route.distance,
            duration: route.duration,
          });
        } else {
          setRouteCoordinates([]);
          setRouteInfo(null);
        }
      } catch (routeError) {
        if (!isMounted) return;
        console.error("Failed to fetch route:", routeError);
        setRouteCoordinates([]);
        setRouteInfo(null);
      } finally {
        if (isMounted) {
          setRouteLoading(false);
        }
      }
    }

    fetchRoute();
    return () => {
      isMounted = false;
    };
  }, [activeTrip, origin, destination]);

  if (!loading && !selectedEntry) {
    return (
      <section className="panel-surface">
        <h2>Truck Detail</h2>
        <p className="empty-state">No telemetry is available yet for any truck/container.</p>
        <Link className="table-action" to="/fleet">
          Back to Fleet Overview
        </Link>
      </section>
    );
  }

  if (!selectedEntry) {
    return <p className="empty-state">Loading selected asset details...</p>;
  }

  return (
    <div className="page-grid">
      <section className={`status-banner status-${deviceStatus.tone}`}>
        <div>
          <p className="eyebrow">Asset Detail</p>
          <h2>{selectedEntry.truckId} / {selectedEntry.containerId}</h2>
          <p className="muted-text">
            Last update: {formatRelativeTime(lastSeenMs)} ({formatDateTime(lastSeenMs)})
          </p>
        </div>
        <div className="status-banner-right">
          <StatusPill tone={deviceStatus.tone}>{deviceStatus.label}</StatusPill>
          <Link className="table-action" to="/fleet">Back to Fleet</Link>
        </div>
      </section>

      {showingFallback ? (
        <div className="notice-box">
          The requested truck/container was not found. Showing the first available active unit.
        </div>
      ) : null}

      <section className="sensor-grid">
        <StatusCard
          title="Temperature"
          value={valueOrDash(env.temperatureC, 1, " C")}
          subtitle="Cargo compartment reading"
          icon={<TemperatureIcon />}
          iconTone="icon-amber"
        />
        <StatusCard
          title="Humidity"
          value={valueOrDash(env.humidityPct, 1, " %")}
          subtitle="Relative humidity level"
          icon={<HumidityIcon />}
          iconTone="icon-sky"
        />
        <StatusCard
          title="Pressure"
          value={valueOrDash(env.pressureHpa, 1, " hPa")}
          subtitle="Internal pressure trend"
          icon={<PressureIcon />}
          iconTone="icon-indigo"
        />
        <StatusCard
          title="Smoke"
          value={typeof gas.smokePpm === "number" ? `${Math.round(gas.smokePpm)} ppm` : "-"}
          subtitle="Air quality smoke estimate"
          icon={<GasIcon />}
          iconTone="icon-emerald"
        />
        <StatusCard
          title="Tilt"
          value={typeof motion.tiltDeg === "number" ? `${motion.tiltDeg.toFixed(1)} deg` : "-"}
          subtitle="Container angle"
          icon={<TiltIcon />}
          iconTone="icon-indigo"
        />
        <StatusCard
          title="Shock"
          value={motion.shock ? "Impact" : "Clear"}
          subtitle="Vibration and impact state"
          icon={<ShockIcon />}
          iconTone="icon-rose"
        />
        <StatusCard
          title="GPS Status"
          value={status.gpsFix ? "Locked" : "Searching"}
          subtitle={
            typeof gps.lat === "number" && typeof gps.lon === "number"
              ? `Lat ${gps.lat.toFixed(5)}, Lon ${gps.lon.toFixed(5)}`
              : "Coordinates currently unavailable"
          }
          icon={<GpsIcon />}
          iconTone="icon-slate"
        />
      </section>

      {activeTrip ? (
        <section className="panel-surface">
          <div className="panel-headline">
            <h3>Active Trip</h3>
            <p>Route and live position for the current trip.</p>
          </div>

          {tripError ? <div className="error-box">{tripError}</div> : null}

          <div className="map-wrap top-gap">
            <Map center={mapCenter} zoom={7.5} scrollZoom={true} touchZoomRotate={true}>
              <MapControls position="bottom-right" showLocate={true} showZoom={true} />

              {routeCoordinates.length > 0 ? (
                <MapRoute
                  coordinates={routeCoordinates}
                  color="#2563eb"
                  width={6}
                  opacity={0.9}
                />
              ) : null}

              {origin ? (
                <MapMarker longitude={origin.lon} latitude={origin.lat}>
                  <MarkerContent>
                    <div className="size-5 rounded-full bg-green-500 border-2 border-white shadow-lg" />
                    <MarkerLabel position="top">{origin.name}</MarkerLabel>
                  </MarkerContent>
                </MapMarker>
              ) : null}

              {destination ? (
                <MapMarker longitude={destination.lon} latitude={destination.lat}>
                  <MarkerContent>
                    <div className="size-5 rounded-full bg-red-500 border-2 border-white shadow-lg" />
                    <MarkerLabel position="bottom">{destination.name}</MarkerLabel>
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
            </Map>

            {routeLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <span className="muted-text">Loading route...</span>
              </div>
            ) : null}
          </div>

          <div className="summary-grid top-gap">
            <div className="summary-card">
              <p className="summary-title">Trip</p>
              <p className="summary-value">{activeTrip.trip_code}</p>
              <p className="summary-subtitle">
                {activeTrip.origin_name} → {activeTrip.destination_name}
              </p>
            </div>
            <div className="summary-card">
              <p className="summary-title">Route</p>
              <p className="summary-value">
                {routeInfo ? formatDistance(routeInfo.distance) : "-"}
              </p>
              <p className="summary-subtitle">
                {routeInfo ? formatDuration(routeInfo.duration) : "No route data"}
              </p>
            </div>
            <div className="summary-card summary-success">
              <p className="summary-title">Started</p>
              <p className="summary-value">{formatDateTime(activeTrip.actual_start_at)}</p>
              <p className="summary-subtitle">Planned: {formatDateTime(activeTrip.planned_start_at)}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="detail-grid">
        <div className="detail-main-stack">
          <TruckMap telemetry={telemetry} label={`${selectedEntry.truckId} / ${selectedEntry.containerId}`} />
          <TrendCharts
            points={history.points}
            hasBackendHistory={history.hasBackendHistory}
            loading={history.loading}
          />
        </div>

        <div className="detail-side-stack">
          <DeviceHealthPanel
            telemetry={telemetry}
            backendHealth={backendHealth}
            isOffline={deviceStatus.code === "offline"}
          />
          <CargoHealthPanel alerts={deviceAlerts} />

          <section className="panel-surface">
            <div className="panel-headline">
              <h3>Active Device Alerts</h3>
              <p>Current incidents linked to this unit</p>
            </div>
            {deviceAlerts.length === 0 ? (
              <p className="empty-state">No active alerts for this truck/container at the moment.</p>
            ) : (
              <ul className="mini-alert-list">
                {deviceAlerts.map((item, index) => {
                  const alert = getAlertPayload(item);
                  const level = normalizeSeverity(alert.severity);
                  return (
                    <li key={`${alert.code || "alert"}-${index}`}>
                      <StatusPill tone={level}>
                        {severityLabel(level)}
                      </StatusPill>
                      <span>{alert.message || alert.code || "Alert raised"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
