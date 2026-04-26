import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Lock, RefreshCcw, Router, Unlock, Wifi } from "lucide-react";
import apiClient from "../api/client";
import DeviceSelector from "./DeviceSelector";

function signalPercent(rssi) {
  if (!Number.isFinite(rssi)) {
    return 10;
  }

  return Math.max(8, Math.min(100, Math.round(((rssi + 95) / 60) * 100)));
}

function statusTone(state) {
  if (state === "connected") return "pill-online";
  if (state === "failed") return "pill-critical";
  if (state === "connecting" || state === "scanning") return "pill-warning";
  return "pill-muted";
}

function buildUnitKey(unit) {
  return `${unit?.tenantCode || ""}::${unit?.truckId || ""}::${unit?.containerId || ""}`;
}

export default function WifiPanel({
  wifiStatus,
  networks,
  sseConnected,
  onSelectedUnitChange,
  onWifiSnapshot,
}) {
  const [units, setUnits] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [selectedSsid, setSelectedSsid] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [password, setPassword] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [error, setError] = useState("");
  const [commandInfo, setCommandInfo] = useState(null);
  const [mqttState, setMqttState] = useState(null);

  const sortedNetworks = useMemo(() => {
    return [...(Array.isArray(networks) ? networks : [])].sort((left, right) => {
      return Number(right.rssi || -100) - Number(left.rssi || -100);
    });
  }, [networks]);

  const selectedUnit = useMemo(
    () => units.find((unit) => buildUnitKey(unit) === selectedKey) || null,
    [selectedKey, units]
  );

  const unitOptions = units.map((unit) => ({
    key: buildUnitKey(unit),
    label: `${unit.truckId} / ${unit.containerId}${unit.fleetId ? ` • ${unit.fleetId}` : ""}`,
  }));

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      try {
        const response = await apiClient.get("/ota/units");
        if (cancelled) return;

        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        setUnits(items);
        setSelectedKey((current) => {
          if (current && items.some((item) => buildUnitKey(item) === current)) {
            return current;
          }

          return items[0] ? buildUnitKey(items[0]) : "";
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.response?.data?.error || loadError.message || "Failed to load gateway nodes.");
        }
      } finally {
        if (!cancelled) {
          setUnitsLoading(false);
        }
      }
    }

    loadUnits();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedUnit?.tenantCode || !selectedUnit?.truckId) {
      onSelectedUnitChange?.(selectedUnit);
      return;
    }

    let cancelled = false;
    onSelectedUnitChange?.(selectedUnit);

    async function loadWifiSnapshot() {
      try {
        const response = await apiClient.get("/gateway/wifi/status", {
          params: {
            tenantCode: selectedUnit.tenantCode,
            truckId: selectedUnit.truckId,
          },
        });

        if (cancelled) return;

        onWifiSnapshot?.({
          status: response.data?.status || {
            state: "unknown",
            tenantCode: selectedUnit.tenantCode,
            truckId: selectedUnit.truckId,
          },
          networks: response.data?.networks || [],
        });
        setCommandInfo(response.data?.topicBase ? { topicBase: response.data.topicBase } : null);
        setMqttState(response.data?.mqtt || null);
      } catch (snapshotError) {
        if (!cancelled) {
          setError(snapshotError?.response?.data?.error || snapshotError.message || "Failed to load WiFi status.");
        }
      }
    }

    loadWifiSnapshot();

    return () => {
      cancelled = true;
    };
  }, [selectedUnit, onSelectedUnitChange, onWifiSnapshot]);

  useEffect(() => {
    if (sortedNetworks.length > 0) {
      setScanLoading(false);
    }
  }, [sortedNetworks.length]);

  useEffect(() => {
    if (wifiStatus?.state === "connected" || wifiStatus?.state === "failed") {
      setConnectLoading(false);
    }
  }, [wifiStatus?.state]);

  async function requestScan() {
    if (!selectedUnit?.tenantCode || !selectedUnit?.truckId) {
      setError("Select a truck/container node before scanning.");
      return;
    }

    setError("");
    setScanLoading(true);

    try {
      const response = await apiClient.post("/gateway/wifi/scan", {
        tenantCode: selectedUnit.tenantCode,
        truckId: selectedUnit.truckId,
        containerId: selectedUnit.containerId,
      });
      setCommandInfo({
        topicBase: response.data?.topicBase,
        commandTopic: response.data?.commandTopic,
      });
      setMqttState(response.data?.mqtt || null);
      setTimeout(() => {
        setScanLoading(false);
        setError((current) => current || `No scan result received yet. Check EMQX topic: ${response.data?.commandTopic || "unknown"}`);
      }, 10000);
    } catch (scanError) {
      setScanLoading(false);
      setError(scanError?.response?.data?.error || scanError.message || "Failed to request WiFi scan.");
    }
  }

  async function connectToNetwork(event) {
    event.preventDefault();
    if (!selectedUnit?.tenantCode || !selectedUnit?.truckId) {
      setError("Select a truck/container node before connecting.");
      return;
    }

    if (!selectedSsid || !password) {
      setError("Select a network and enter its password.");
      return;
    }

    setError("");
    setConnectLoading(true);

    try {
      const response = await apiClient.post("/gateway/wifi/connect", {
        tenantCode: selectedUnit.tenantCode,
        truckId: selectedUnit.truckId,
        containerId: selectedUnit.containerId,
        ssid: selectedSsid,
        password,
        channel: selectedNetwork?.channel,
        bssid: selectedNetwork?.bssid,
      });
      setCommandInfo({
        topicBase: response.data?.topicBase,
        commandTopic: response.data?.commandTopic,
      });
      setMqttState(response.data?.mqtt || null);
      setTimeout(() => {
        setConnectLoading(false);
        setError((current) => current || `No WiFi status received yet. Check EMQX topic: ${response.data?.commandTopic || "unknown"}`);
      }, 30000);
    } catch (connectError) {
      setConnectLoading(false);
      setError(connectError?.response?.data?.error || connectError.message || "Failed to send WiFi credentials.");
    }
  }

  return (
    <section className="panel-surface">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Gateway WiFi</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Step 1: Connect Gateway to WiFi</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The gateway uses WiFi only for firmware downloads. Telemetry and OTA status still publish over GSM MQTT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`pill ${statusTone(wifiStatus?.state)}`}>
            {wifiStatus?.state || "unknown"}
          </span>
          <span className="pill pill-info">{sseConnected ? "Live" : "Reconnecting"}</span>
          {mqttState ? (
            <span className={`pill ${mqttState.connected ? "pill-online" : "pill-critical"}`}>
              MQTT {mqttState.connected ? "connected" : mqttState.state || "offline"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-surface-elevated p-4">
        <p className="text-sm font-semibold text-ink">Target Gateway Node</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan and connect commands are sent to the selected truck gateway MQTT topic.
        </p>
        <div className="mt-3">
          {unitsLoading ? (
            <p className="text-sm text-muted-foreground">Loading nodes...</p>
          ) : (
            <DeviceSelector devices={unitOptions} selectedKey={selectedKey} onChange={setSelectedKey} />
          )}
        </div>
        {commandInfo?.topicBase ? (
          <p className="mt-3 break-all text-xs text-muted-foreground">
            MQTT topic base: <span className="font-semibold text-ink">{commandInfo.topicBase}</span>
          </p>
        ) : null}
        {commandInfo?.commandTopic ? (
          <p className="mt-1 break-all text-xs text-muted-foreground">
            Last command topic: <span className="font-semibold text-ink">{commandInfo.commandTopic}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="sensor-icon icon-sky">
              <Router size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Current WiFi Status</p>
              <p className="text-sm text-muted-foreground">
                {wifiStatus?.ssid || "No network selected"}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">State</dt>
              <dd className="font-semibold text-ink">{wifiStatus?.state || "unknown"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">IP address</dt>
              <dd className="font-semibold text-ink">{wifiStatus?.ip || "-"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Channel</dt>
              <dd className="font-semibold text-ink">{wifiStatus?.channel || "-"}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="table-action mt-5 inline-flex w-full items-center justify-center gap-2 py-2"
            disabled={scanLoading}
            onClick={requestScan}
          >
            {scanLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
            Scan Networks
          </button>
        </article>

        <article className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="sensor-icon icon-emerald">
              <Wifi size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Available Networks</p>
              <p className="text-sm text-muted-foreground">
                {scanLoading ? "Scanning..." : `${sortedNetworks.length} network${sortedNetworks.length === 1 ? "" : "s"} found`}
              </p>
            </div>
          </div>

          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1">
            {sortedNetworks.length > 0 ? (
              sortedNetworks.map((network) => {
                const networkKey = `${network.ssid}-${network.bssid || network.rssi}`;
                const selected = selectedNetwork
                  ? `${selectedNetwork.ssid}-${selectedNetwork.bssid || selectedNetwork.rssi}` === networkKey
                  : selectedSsid === network.ssid;
                return (
                  <button
                    key={networkKey}
                    type="button"
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                      selected ? "border-sky-400 bg-sky-50" : "border-border bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setSelectedSsid(network.ssid);
                      setSelectedNetwork(network);
                      setPassword("");
                      setError("");
                    }}
                  >
                    {network.secure ? <Lock size={16} /> : <Unlock size={16} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{network.ssid}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${signalPercent(Number(network.rssi))}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-right text-xs text-muted-foreground">
                      {network.rssi} dBm
                      {network.channel ? <span className="block">ch {network.channel}</span> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="empty-state">
                {scanLoading ? "Waiting for scan results..." : "Click Scan Networks to find nearby access points."}
              </p>
            )}
          </div>

          {selectedSsid ? (
            <form className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-elevated p-4" onSubmit={connectToNetwork}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{selectedSsid}</p>
                {wifiStatus?.state === "connected" && wifiStatus?.ssid === selectedSsid ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 size={14} />
                    Connected
                  </span>
                ) : null}
              </div>
              <label className="form-label">
                Password
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Network password"
                />
              </label>
              <button className="auth-submit inline-flex items-center justify-center gap-2" type="submit" disabled={connectLoading}>
                {connectLoading ? <Loader2 className="animate-spin" size={16} /> : <Wifi size={16} />}
                {connectLoading ? "Connecting..." : "Connect"}
              </button>
            </form>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </article>
      </div>
    </section>
  );
}
