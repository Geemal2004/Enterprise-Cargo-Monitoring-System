"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MapControls,
  useMap,
} from "@/components/ui/map";
import { useFleetDataContext } from "../context/FleetDataContext";
import { createTrip, fetchTrips, startTrip, completeTrip } from "../api/tripsApi";
import { extractTelemetry, formatDateTime } from "../types/telemetry";

const DEFAULT_CENTER = [80.7718, 7.8731];

function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Request failed. Try again in a moment."
  );
}

const CARGO_TYPE_OPTIONS = [
  { value: "GENERAL_CARGO", label: "General cargo" },
  { value: "PERISHABLE_FOOD", label: "Perishable food" },
  { value: "PHARMACEUTICALS", label: "Pharmaceuticals" },
  { value: "GAS_CYLINDERS", label: "Gas cylinders" },
  { value: "CHEMICALS", label: "Chemicals" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "FRAGILE_GOODS", label: "Fragile goods" },
  { value: "LIQUID_CARGO", label: "Liquid cargo" },
  { value: "LIVESTOCK", label: "Livestock" },
  { value: "CUSTOM", label: "Custom / other" },
];

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

  const [mapPickMode, setMapPickMode] = useState("");

  const [formState, setFormState] = useState({
    truckId: "",
    containerId: "",
    cargoType: "GENERAL_CARGO",
    goodsDescription: "",
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

    if (!formState.cargoType) {
      setError("Cargo type is required.");
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
        cargoType: formState.cargoType,
        goodsDescription: formState.goodsDescription,
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
          <p>
            Choose a container and record only start and destination. Route path will come from
            telemetry GPS once the trip is in progress.
          </p>
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

          <label className="form-label" htmlFor="trip-cargo-type">
            Cargo Type
            <select
              id="trip-cargo-type"
              className="form-input"
              value={formState.cargoType}
              onChange={(event) =>
                setFormState((current) => ({ ...current, cargoType: event.target.value }))
              }
              required
            >
              {CARGO_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label" htmlFor="trip-goods-description">
            Goods Description (optional)
            <input
              id="trip-goods-description"
              className="form-input"
              value={formState.goodsDescription}
              onChange={(event) =>
                setFormState((current) => ({ ...current, goodsDescription: event.target.value }))
              }
              placeholder="Example: chilled dairy, vaccine batch, industrial solvents"
            />
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
        </div>
        <p className="muted-text top-gap text-xs">
          No planned route is generated at trip creation. Open Trip Details to view the actual
          traveled path from telemetry GPS history.
        </p>
      </section>

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Trips</h3>
          <p>{loadingTrips ? "Refreshing trips..." : "Track trips and telemetry-driven routes."}</p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip</th>
                <th>Truck</th>
                <th>Container</th>
                <th>Cargo</th>
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
                  <td colSpan={9} className="empty-state">
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
                    <td>{trip?.metadata_json?.cargo?.cargoLabel || trip?.metadata_json?.cargo?.cargoType || "-"}</td>
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
