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
    <main className="page-grid gap-4">
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Device ops
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">OTA Updates</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Configure gateway Wi‑Fi, then upload firmware and trigger updates for gateway and container devices.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              sseConnected
                ? "border-[color:var(--cm-success-border)] bg-[color:var(--cm-success-bg)] text-[color:var(--cm-success)]"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${sseConnected ? "bg-[color:var(--cm-success)]" : "bg-muted-foreground"}`}
              aria-hidden="true"
            />
            {sseConnected ? "Live events connected" : "Events disconnected"}
          </span>
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
