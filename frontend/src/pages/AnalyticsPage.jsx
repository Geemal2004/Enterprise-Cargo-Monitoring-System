import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { SignalMarker } from "@/components/ui/signal-marker";
import { useFleetDataContext } from "../context/FleetDataContext";
import { extractTelemetry, getDeviceLabel } from "../types/telemetry";
import { useMemo } from "react";
import { Map, MapControls, MapMarker, MarkerContent, MarkerLabel } from "@/components/ui/map";

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
      <section className="analytics-map-shell shadow-lg">
        <div className="analytics-map-overlay">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Spatial view
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">Analytics map</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active containers with GPS fixes on a single control-tower view.
          </p>
          {error ? (
            <Alert tone="error" className="mt-3" title="Map data error">
              {error}
            </Alert>
          ) : null}
        </div>

        <div className="analytics-map-wrap">
          <Map center={mapCenter} zoom={6.2} scrollZoom={true} touchZoomRotate={true}>
            <MapControls position="bottom-right" showLocate={true} showZoom={true} />
            {gpsMarkers.map((marker) => (
              <MapMarker key={marker.key} longitude={marker.lon} latitude={marker.lat}>
                <MarkerContent>
                  <SignalMarker size="md" />
                  <MarkerLabel position="top">{marker.label}</MarkerLabel>
                </MarkerContent>
              </MapMarker>
            ))}
          </Map>

          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/50 backdrop-blur-[1px]">
              <Spinner label="Loading map telemetry" />
              <span className="text-sm text-muted-foreground">Loading telemetry…</span>
            </div>
          ) : null}
        </div>

        <p className="analytics-map-count">
          <Badge tone="signal">{gpsMarkers.length} locations</Badge>
          <span className="ml-2">active container GPS fixes</span>
        </p>
      </section>
    </div>
  );
}
