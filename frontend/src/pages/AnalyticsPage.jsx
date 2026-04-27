import { useMemo } from "react";
import { Map, MapControls, MapMarker, MarkerContent, MarkerLabel } from "@/components/ui/map";
import { useFleetDataContext } from "../context/FleetDataContext";
import { extractTelemetry, getDeviceLabel } from "../types/telemetry";

const DEFAULT_CENTER = [80.7718, 7.8731];

export default function AnalyticsPage() {
  const { entries, loading, error } = useFleetDataContext();

  const gpsMarkers = useMemo(() => {
    return (entries || [])
      .map((entry) => {
        const telemetry = extractTelemetry(entry);
        const gps = telemetry.gps || {};
        if (typeof gps.lat !== "number" || typeof gps.lon !== "number") {
          return null;
        }

        return {
          key: entry.key || getDeviceLabel(entry),
          label: getDeviceLabel(entry),
          lat: gps.lat,
          lon: gps.lon,
        };
      })
      .filter(Boolean);
  }, [entries]);

  const mapCenter = useMemo(() => {
    if (!gpsMarkers.length) {
      return DEFAULT_CENTER;
    }

    const totals = gpsMarkers.reduce(
      (acc, item) => ({
        lat: acc.lat + item.lat,
        lon: acc.lon + item.lon,
      }),
      { lat: 0, lon: 0 }
    );

    return [totals.lon / gpsMarkers.length, totals.lat / gpsMarkers.length];
  }, [gpsMarkers]);

  return (
    <div className="analytics-map-page">
      <section className="analytics-map-shell">
        <div className="analytics-map-overlay">
          <h2>Analytics Map</h2>
          <p>All active containers with GPS fixes on a single view.</p>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <div className="analytics-map-wrap">
          <Map center={mapCenter} zoom={6.2} scrollZoom={true} touchZoomRotate={true}>
            <MapControls position="bottom-right" showLocate={true} showZoom={true} />
            {gpsMarkers.map((marker) => (
              <MapMarker key={marker.key} longitude={marker.lon} latitude={marker.lat}>
                <MarkerContent>
                  <div className="size-4 rounded-full bg-blue-600 border-2 border-white shadow-lg" />
                  <MarkerLabel position="top">{marker.label}</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ))}
          </Map>

          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <span className="muted-text">Loading telemetry...</span>
            </div>
          ) : null}
        </div>

        <p className="analytics-map-count">
          Showing {gpsMarkers.length} active container locations.
        </p>
      </section>
    </div>
  );
}
