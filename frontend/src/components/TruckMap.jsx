import { useEffect, useState } from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@/components/ui/map";

export default function TruckMap({ telemetry, label }) {
  const lat = telemetry && telemetry.gps && typeof telemetry.gps.lat === "number" ? telemetry.gps.lat : 0;
  const lon = telemetry && telemetry.gps && typeof telemetry.gps.lon === "number" ? telemetry.gps.lon : 0;

  const hasFix = lat !== 0 && lon !== 0;
  const [initialCenter, setInitialCenter] = useState(null);
  const [lastFix, setLastFix] = useState(null);

  useEffect(() => {
    if (hasFix) {
      setLastFix([lat, lon]);
      if (!initialCenter) {
        setInitialCenter([lat, lon]);
      }
    }
  }, [hasFix, initialCenter, lat, lon]);

  useEffect(() => {
    if (lastFix && !initialCenter) {
      setInitialCenter(lastFix);
    }
  }, [initialCenter, lastFix]);

  const displayFix = hasFix ? [lat, lon] : lastFix;

  return (
    <section className="panel-surface">
      <div className="panel-headline">
        <h3>Location Map</h3>
        <p>Latest reported position for the selected truck</p>
      </div>

      <div className="map-wrap">
        {initialCenter && displayFix ? (
          <Map
            center={[initialCenter[1], initialCenter[0]]}
            zoom={12}
            scrollZoom={true}
            touchZoomRotate={true}
          >
            <MapMarker longitude={displayFix[1]} latitude={displayFix[0]}>
              <MarkerContent>
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute h-12 w-12 rounded-full bg-primary/20" />
                  <span className="absolute h-6 w-6 rounded-full border-2 border-white bg-primary shadow-lg" />
                  <span className="absolute h-2 w-2 rounded-full bg-white" />
                </div>
              </MarkerContent>
              <MarkerTooltip>{label}</MarkerTooltip>
              <MarkerPopup>
                <div className="space-y-1">
                  <p className="text-foreground font-medium">{label}</p>
                  <p className="text-muted-foreground text-xs">
                    {displayFix[0].toFixed(6)}, {displayFix[1].toFixed(6)}
                  </p>
                </div>
              </MarkerPopup>
            </MapMarker>
          </Map>
        ) : (
          <div className="map-empty" />
        )}
      </div>
    </section>
  );
}
