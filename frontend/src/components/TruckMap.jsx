import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export default function TruckMap({ telemetry, label }) {
  const lat = telemetry && telemetry.gps && typeof telemetry.gps.lat === "number" ? telemetry.gps.lat : 0;
  const lon = telemetry && telemetry.gps && typeof telemetry.gps.lon === "number" ? telemetry.gps.lon : 0;

  const hasFix = lat !== 0 && lon !== 0;

  return (
    <section className="panel-surface">
      <div className="panel-headline">
        <h3>Location Map</h3>
        <p>Latest reported position for the selected truck</p>
      </div>

      <div className="map-wrap">
        {hasFix ? (
          <MapContainer key={`${lat}-${lon}`} center={[lat, lon]} zoom={13} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[lat, lon]}>
              <Popup>
                <strong>{label}</strong>
                <br />
                Lat: {lat.toFixed(6)}
                <br />
                Lon: {lon.toFixed(6)}
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="map-empty">Location will appear once GPS lock is available.</div>
        )}
      </div>
    </section>
  );
}
