"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MapRoute,
  MapControls,
  useMap,
} from "@/components/ui/map";
import { Clock, Loader2, Route as RouteIcon } from "lucide-react";
import { useFleetDataContext } from "../context/FleetDataContext";
import { createTrip, fetchTrips, startTrip, completeTrip } from "../api/tripsApi";
import { extractTelemetry, formatDateTime } from "../types/telemetry";

const DEFAULT_CENTER = [80.7718, 7.8731];

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

function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Request failed. Try again in a moment."
  );
}

function MapClickHandler({ mode, onPick }) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !mode) {
      return undefined;
    }

    const handleClick = (event) => {
      const { lng, lat } = event.lngLat || {};
      if (typeof lng === "number" && typeof lat === "number") {
        onPick({ lng, lat });
      }
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, mode, onPick]);

  return null;
}

export default function TripsPage() {
  const { entries, getEntryByIds } = useFleetDataContext();

  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);

  const [mapPickMode, setMapPickMode] = useState("");

  const [formState, setFormState] = useState({
    truckId: "",
    containerId: "",
    originName: "Current Location",
    originLat: "",
    originLon: "",
    destinationName: "",
    destinationLat: "",
    destinationLon: "",
  });

  const selectedEntry = useMemo(() => {
    if (!formState.truckId || !formState.containerId) {
      return null;
    }
    return getEntryByIds(formState.truckId, formState.containerId);
  }, [formState.truckId, formState.containerId, getEntryByIds]);

  const routeStart = useMemo(() => {
    if (!formState.originLat || !formState.originLon) {
      return null;
    }
    const lat = Number(formState.originLat);
    const lon = Number(formState.originLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return { lat, lon, name: formState.originName || "Start" };
  }, [formState.originLat, formState.originLon, formState.originName]);

  const routeEnd = useMemo(() => {
    if (!formState.destinationLat || !formState.destinationLon) {
      return null;
    }
    const lat = Number(formState.destinationLat);
    const lon = Number(formState.destinationLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return { lat, lon, name: formState.destinationName || "Destination" };
  }, [formState.destinationLat, formState.destinationLon, formState.destinationName]);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setError("");

    try {
      const payload = await fetchTrips();
      setTrips(Array.isArray(payload?.items) ? payload.items : []);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    async function fetchRoutes() {
      if (!routeStart || !routeEnd) {
        setRouteOptions([]);
        return;
      }

      setRouteLoading(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${routeStart.lon},${routeStart.lat};${routeEnd.lon},${routeEnd.lat}?overview=full&geometries=geojson&alternatives=true`
        );
        const data = await response.json();

        if (Array.isArray(data.routes) && data.routes.length > 0) {
          const nextRoutes = data.routes.map((route) => ({
            coordinates: route.geometry.coordinates,
            duration: route.duration,
            distance: route.distance,
          }));
          setRouteOptions(nextRoutes);
          setSelectedRouteIndex(0);
        } else {
          setRouteOptions([]);
        }
      } catch (routeError) {
        console.error("Failed to fetch routes:", routeError);
        setRouteOptions([]);
      } finally {
        setRouteLoading(false);
      }
    }

    fetchRoutes();
  }, [routeStart, routeEnd]);

  const sortedRoutes = useMemo(() => {
    return routeOptions
      .map((route, index) => ({ route, index }))
      .sort((a, b) => {
        if (a.index === selectedRouteIndex) return 1;
        if (b.index === selectedRouteIndex) return -1;
        return 0;
      });
  }, [routeOptions, selectedRouteIndex]);

  function handleUseCurrentLocation() {
    const telemetry = extractTelemetry(selectedEntry);
    if (!telemetry?.gps) {
      setError("No GPS location available for the selected container.");
      return;
    }

    const { lat, lon } = telemetry.gps;
    if (typeof lat !== "number" || typeof lon !== "number") {
      setError("No GPS location available for the selected container.");
      return;
    }

    setFormState((current) => ({
      ...current,
      originName: `Current Location (${selectedEntry.truckId} / ${selectedEntry.containerId})`,
      originLat: String(lat),
      originLon: String(lon),
    }));
  }

  function handlePickLocation(coords) {
    if (mapPickMode === "origin") {
      setFormState((current) => ({
        ...current,
        originLat: coords.lat.toFixed(6),
        originLon: coords.lng.toFixed(6),
      }));
    }

    if (mapPickMode === "destination") {
      setFormState((current) => ({
        ...current,
        destinationLat: coords.lat.toFixed(6),
        destinationLon: coords.lng.toFixed(6),
      }));
    }
  }

  async function handleCreateTrip(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!formState.truckId || !formState.containerId) {
      setError("Select a truck and container.");
      return;
    }

    if (!formState.originName || !formState.destinationName) {
      setError("Origin and destination names are required.");
      return;
    }

    if (!formState.originLat || !formState.originLon || !formState.destinationLat || !formState.destinationLon) {
      setError("Origin and destination coordinates are required.");
      return;
    }

    try {
      await createTrip({
        tenantCode: selectedEntry?.tenantId,
        truckCode: formState.truckId,
        containerCode: formState.containerId,
        originName: formState.originName,
        destinationName: formState.destinationName,
        originLat: formState.originLat,
        originLon: formState.originLon,
        destinationLat: formState.destinationLat,
        destinationLon: formState.destinationLon,
      });

      setNotice("Trip created.");
      setFormState((current) => ({
        ...current,
        destinationName: "",
        destinationLat: "",
        destinationLon: "",
      }));
      await loadTrips();
    } catch (createError) {
      setError(extractErrorMessage(createError));
    }
  }

  async function handleStartTrip(tripId) {
    setError("");
    setNotice("");

    const trip = trips.find((item) => item.id === tripId);

    try {
      await startTrip(tripId, { tenantCode: trip?.tenant_code || trip?.tenantCode });
      setNotice("Trip started.");
      await loadTrips();
    } catch (startError) {
      setError(extractErrorMessage(startError));
    }
  }

  async function handleCompleteTrip(tripId) {
    setError("");
    setNotice("");

    const trip = trips.find((item) => item.id === tripId);

    try {
      await completeTrip(tripId, { tenantCode: trip?.tenant_code || trip?.tenantCode });
      setNotice("Trip completed.");
      await loadTrips();
    } catch (stopError) {
      setError(extractErrorMessage(stopError));
    }
  }

  return (
    <div className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>Trips</h2>
          <p>Start and complete trips with live and historical visibility.</p>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <p className="summary-title">Total Trips</p>
            <p className="summary-value">{trips.length}</p>
            <p className="summary-subtitle">Current tenant scope</p>
          </div>
          <div className="summary-card summary-success">
            <p className="summary-title">Planned</p>
            <p className="summary-value">
              {trips.filter((trip) => trip.status === "PLANNED").length}
            </p>
            <p className="summary-subtitle">Awaiting start</p>
          </div>
          <div className="summary-card summary-warning">
            <p className="summary-title">In Progress</p>
            <p className="summary-value">
              {trips.filter((trip) => trip.status === "IN_PROGRESS").length}
            </p>
            <p className="summary-subtitle">Active tracking</p>
          </div>
        </div>
      </section>

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Create Trip</h3>
          <p>Choose a container, set the start and destination, and start tracking.</p>
        </div>

        {error ? <div className="error-box">{error}</div> : null}
        {notice ? <div className="notice-box">{notice}</div> : null}

        <form className="admin-form" onSubmit={handleCreateTrip}>
          <label className="form-label" htmlFor="trip-unit">
            Truck + Container
            <select
              id="trip-unit"
              className="form-input"
              value={`${formState.truckId}::${formState.containerId}`}
              onChange={(event) => {
                const [truckId, containerId] = event.target.value.split("::");
                setFormState((current) => ({
                  ...current,
                  truckId: truckId || "",
                  containerId: containerId || "",
                }));
              }}
              required
            >
              <option value="">Select unit</option>
              {entries.map((entry) => (
                <option
                  key={`${entry.truckId}::${entry.containerId}`}
                  value={`${entry.truckId}::${entry.containerId}`}
                >
                  {entry.truckId} / {entry.containerId}
                </option>
              ))}
            </select>
          </label>

          <div className="inline-actions">
            <button className="table-action" type="button" onClick={handleUseCurrentLocation}>
              Use current location
            </button>
            <button
              className="table-action"
              type="button"
              onClick={() => setMapPickMode(mapPickMode === "origin" ? "" : "origin")}
            >
              Pick start
            </button>
            <button
              className="table-action"
              type="button"
              onClick={() => setMapPickMode(mapPickMode === "destination" ? "" : "destination")}
            >
              Pick destination
            </button>
          </div>

          <label className="form-label" htmlFor="origin-name">
            Origin Name
            <input
              id="origin-name"
              className="form-input"
              value={formState.originName}
              onChange={(event) =>
                setFormState((current) => ({ ...current, originName: event.target.value }))
              }
              required
            />
          </label>

          <div className="form-row">
            <label className="form-label" htmlFor="origin-lat">
              Origin Lat
              <input
                id="origin-lat"
                className="form-input"
                value={formState.originLat}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, originLat: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-label" htmlFor="origin-lon">
              Origin Lon
              <input
                id="origin-lon"
                className="form-input"
                value={formState.originLon}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, originLon: event.target.value }))
                }
                required
              />
            </label>
          </div>

          <label className="form-label" htmlFor="destination-name">
            Destination Name
            <input
              id="destination-name"
              className="form-input"
              value={formState.destinationName}
              onChange={(event) =>
                setFormState((current) => ({ ...current, destinationName: event.target.value }))
              }
              required
            />
          </label>

          <div className="form-row">
            <label className="form-label" htmlFor="destination-lat">
              Destination Lat
              <input
                id="destination-lat"
                className="form-input"
                value={formState.destinationLat}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, destinationLat: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-label" htmlFor="destination-lon">
              Destination Lon
              <input
                id="destination-lon"
                className="form-input"
                value={formState.destinationLon}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, destinationLon: event.target.value }))
                }
                required
              />
            </label>
          </div>

          <div className="inline-actions">
            <button className="table-action" type="submit">
              Create Trip
            </button>
          </div>
        </form>

        <div className="map-wrap mt-6">
          <Map center={DEFAULT_CENTER} zoom={8.5} scrollZoom={true} touchZoomRotate={true}>
            <MapControls position="bottom-right" showLocate={true} showZoom={true} />
            <MapClickHandler mode={mapPickMode} onPick={handlePickLocation} />

            {sortedRoutes.map(({ route, index }) => {
              const isSelected = index === selectedRouteIndex;
              return (
                <MapRoute
                  key={index}
                  coordinates={route.coordinates}
                  color={isSelected ? "#6366f1" : "#94a3b8"}
                  width={isSelected ? 6 : 5}
                  opacity={isSelected ? 1 : 0.6}
                  onClick={() => setSelectedRouteIndex(index)}
                />
              );
            })}

            {routeStart ? (
              <MapMarker longitude={routeStart.lon} latitude={routeStart.lat}>
                <MarkerContent>
                  <div className="size-5 rounded-full bg-green-500 border-2 border-white shadow-lg" />
                  <MarkerLabel position="top">{routeStart.name}</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ) : null}

            {routeEnd ? (
              <MapMarker longitude={routeEnd.lon} latitude={routeEnd.lat}>
                <MarkerContent>
                  <div className="size-5 rounded-full bg-red-500 border-2 border-white shadow-lg" />
                  <MarkerLabel position="bottom">{routeEnd.name}</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ) : null}
          </Map>

          {routeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {routeOptions.length > 0 && (
          <div className="panel-surface top-gap">
            <div className="panel-headline">
              <h4>Route Options</h4>
              <p>Select the preferred OSRM route.</p>
            </div>
            <div className="inline-actions">
              {routeOptions.map((route, index) => {
                const isFastest = index === 0;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedRouteIndex(index)}
                    className="table-action"
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      <span className="font-medium">{formatDuration(route.duration)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs opacity-80">
                      <RouteIcon className="size-3" />
                      {formatDistance(route.distance)}
                    </div>
                    {isFastest && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Fastest
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Trips</h3>
          <p>{loadingTrips ? "Refreshing trips..." : "Track planned and active routes."}</p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip</th>
                <th>Truck</th>
                <th>Container</th>
                <th>Status</th>
                <th>Planned Start</th>
                <th>Actual Start</th>
                <th>Actual End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {loadingTrips ? "Loading trips..." : "No trips found."}
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>
                      <div className="font-medium">{trip.trip_code}</div>
                      <div className="muted-text text-xs">
                        {trip.origin_name} → {trip.destination_name}
                      </div>
                    </td>
                    <td>{trip.truck_code}</td>
                    <td>{trip.container_code}</td>
                    <td>
                      <span className="pill pill-neutral">{trip.status}</span>
                    </td>
                    <td>{formatDateTime(trip.planned_start_at)}</td>
                    <td>{formatDateTime(trip.actual_start_at)}</td>
                    <td>{formatDateTime(trip.actual_end_at)}</td>
                    <td>
                      <div className="inline-actions">
                        {trip.status === "PLANNED" ? (
                          <button className="table-action" onClick={() => handleStartTrip(trip.id)}>
                            Start
                          </button>
                        ) : null}
                        {trip.status === "IN_PROGRESS" ? (
                          <button className="table-action" onClick={() => handleCompleteTrip(trip.id)}>
                            Complete
                          </button>
                        ) : null}
                        <Link
                          className="table-action"
                          to={`/trips/${trip.trip_code}`}
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
