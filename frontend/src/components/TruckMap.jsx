import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export default function TruckMap({ telemetry, label }) {
  const lat = telemetry && telemetry.gps && typeof telemetry.gps.lat === "number" ? telemetry.gps.lat : 0;
  const lon = telemetry && telemetry.gps && typeof telemetry.gps.lon === "number" ? telemetry.gps.lon : 0;

  const hasFix = lat !== 0 && lon !== 0;

  return (
    <section className="panel">
      <h3 className="title" style={{ fontSize: "1.05rem" }}>Truck Location</h3>
      <div className="map-wrap" style={{ marginTop: 8 }}>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#475569",
              background: "#f8fafc",
            }}
          >
            GPS fix unavailable.
          </div>
        )}
      </div>
    </section>
  );
}
