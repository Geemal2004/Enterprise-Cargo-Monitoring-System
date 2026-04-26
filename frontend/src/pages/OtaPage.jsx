import { useCallback, useEffect, useRef, useState } from "react";
import OtaPanel from "../components/OtaPanel";
import WifiPanel from "../components/WifiPanel";

const DEFAULT_API_URL = "https://vish85521-cargo.hf.space/api";

function getEventSourceUrl() {
  const sseBase = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/api$/, "");
  return `${sseBase}/api/ota/events`;
}

export default function OtaPage() {
  const [sseConnected, setSseConnected] = useState(false);
  const [sseEvent, setSseEvent] = useState(null);
  const [wifiNetworks, setWifiNetworks] = useState([]);
  const [wifiStatus, setWifiStatus] = useState({ state: "unknown" });
  const selectedWifiUnitRef = useRef(null);

  function eventMatchesSelectedUnit(message) {
    const selected = selectedWifiUnitRef.current;
    if (!selected?.truckId || !message?.truckId) {
      return true;
    }

    return String(message.truckId) === String(selected.truckId) &&
      (!message.tenantCode || !selected.tenantCode || String(message.tenantCode) === String(selected.tenantCode));
  }

  const handleSelectedWifiUnitChange = useCallback((unit) => {
    selectedWifiUnitRef.current = unit;
  }, []);

  const handleWifiSnapshot = useCallback(({ status, networks }) => {
    setWifiStatus(status || { state: "unknown" });
    setWifiNetworks(Array.isArray(networks) ? networks : []);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(getEventSourceUrl());

    eventSource.onopen = () => setSseConnected(true);
    eventSource.onerror = () => setSseConnected(false);
    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const nextEvent = {
          ...message,
          _eventId: `${Date.now()}-${Math.random()}`,
        };

        if (message?.type === "wifi_scan" && eventMatchesSelectedUnit(message)) {
          setWifiNetworks(Array.isArray(message.networks) ? message.networks : []);
        }

        if (message?.type === "wifi_status" && eventMatchesSelectedUnit(message)) {
          setWifiStatus(message);
        }

        setSseEvent(nextEvent);
      } catch (_error) {
        // Ignore malformed SSE payloads.
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <main className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>OTA Updates</h2>
          <p>Upload firmware binaries and trigger updates for gateway and container devices.</p>
        </div>

        <div className="grid gap-4">
          <WifiPanel
            wifiStatus={wifiStatus}
            networks={wifiNetworks}
            sseConnected={sseConnected}
            onSelectedUnitChange={handleSelectedWifiUnitChange}
            onWifiSnapshot={handleWifiSnapshot}
          />

          <div className="panel-headline">
            <h3>Step 2: Flash Firmware</h3>
          </div>

          <OtaPanel
            sseEvent={sseEvent}
            sseConnected={sseConnected}
            wifiStatus={wifiStatus}
          />
        </div>
      </section>
    </main>
  );
}
