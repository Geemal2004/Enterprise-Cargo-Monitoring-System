import { useEffect, useMemo, useState } from "react";
import apiClient from "../api/client";
import DeviceSelector from "./DeviceSelector";
import { useFleetDataContext } from "../context/FleetDataContext";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const TARGETS = [
  {
    id: "gateway",
    label: "Gateway Node",
    chip: "ESP32-WROOM-32",
    description: "Downloads firmware directly over HTTP from the backend",
    color: "#3b82f6",
  },
  {
    id: "container",
    label: "Container Node",
    chip: "ESP32-S3",
    description: "Gateway relays the staged firmware to the container over ESP-NOW",
    color: "#10b981",
  },
];

const STATE_META = {
  idle: { label: "Ready", color: "#6b7280", icon: "○" },
  pending: { label: "Pending", color: "#f59e0b", icon: "◌" },
  downloading: { label: "Downloading", color: "#3b82f6", icon: "↓" },
  flashing: { label: "Flashing", color: "#8b5cf6", icon: "⚡" },
  success: { label: "Updated", color: "#10b981", icon: "✓" },
  error: { label: "Failed", color: "#ef4444", icon: "✕" },
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "-";
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildUnitKey(unit) {
  return `${unit?.truckId || ""}::${unit?.containerId || ""}`;
}

function getEventSourceUrl() {
  return `${String(API_BASE).replace(/\/$/, "")}/ota/events`;
}

function createEmptyStatuses() {
  return {
    gateway: null,
    container: null,
  };
}

function UnitStatusPill({ unit }) {
  const label = unit?.isOnline ? "Online" : "Awaiting live telemetry";
  const tone = unit?.isOnline ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-500/15 text-slate-500";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function TargetCard({ target, selectedUnit, staged, status, onUpload, onTrigger }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");

  const meta = STATE_META[status?.state] || STATE_META.idle;
  const isActive = ["pending", "downloading", "flashing"].includes(status?.state);
  const hasSelection = Boolean(selectedUnit?.truckId && selectedUnit?.containerId);

  async function handleFile(file) {
    if (!file) {
      return;
    }

    if (!String(file.name || "").toLowerCase().endsWith(".bin")) {
      setError("Please upload a .bin firmware file.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      await onUpload(target.id, file);
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleTrigger() {
    if (!hasSelection) {
      setError("Select a truck/container pair first.");
      return;
    }

    setError("");
    setTriggering(true);

    try {
      await onTrigger(target.id);
    } catch (triggerError) {
      setError(triggerError.message || "Trigger failed.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {target.chip}
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">{target.label}</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {target.description}
          </p>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
        >
          <span>{meta.icon}</span>
          {meta.label}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface-elevated p-4 text-sm text-muted-foreground">
        <p>
          Selected unit:{" "}
          <span className="font-semibold text-ink">
            {selectedUnit ? `${selectedUnit.truckId} / ${selectedUnit.containerId}` : "None selected"}
          </span>
        </p>
        {selectedUnit?.fleetId ? <p className="mt-1">Fleet: {selectedUnit.fleetId}</p> : null}
      </div>

      {status?.message ? <p className="mt-4 text-sm text-ink">{status.message}</p> : null}

      {staged ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Staged firmware: <span className="font-semibold text-ink">{staged.filename}</span>
          {` • ${formatBytes(staged.sizeBytes)}`}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No staged firmware uploaded yet.</p>
      )}

      {status?.filename ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Active OTA file: <span className="font-semibold text-ink">{status.filename}</span>
          {typeof status.progress === "number" ? ` • ${status.progress}%` : ""}
        </p>
      ) : null}

      {(status?.state === "pending" || status?.state === "downloading" || status?.state === "flashing") ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${status?.progress ?? 0}%`, backgroundColor: target.color }}
          />
        </div>
      ) : null}

      <div
        className="mt-5 rounded-2xl border border-dashed border-border p-4 text-center transition-colors"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          await handleFile(event.dataTransfer.files?.[0]);
        }}
        onClick={() => document.getElementById(`ota-file-${target.id}`)?.click()}
        style={{ backgroundColor: dragging ? `${target.color}10` : "transparent" }}
      >
        <input
          id={`ota-file-${target.id}`}
          type="file"
          accept=".bin"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {uploading ? (
          <p className="text-sm text-muted-foreground">Uploading firmware...</p>
        ) : staged ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-ink">{staged.filename}</span>
            {` (${formatBytes(staged.sizeBytes)}) • click to replace`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Drop a <span className="font-semibold text-ink">.bin</span> file here or click to browse
          </p>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: staged && hasSelection && !isActive ? target.color : "#374151" }}
        disabled={!staged || !hasSelection || isActive || triggering}
        onClick={handleTrigger}
      >
        {triggering
          ? "Sending command..."
          : isActive
            ? "Update in progress..."
            : selectedUnit
              ? `Flash ${target.label} on ${selectedUnit.truckId}`
              : `Flash ${target.label}`}
      </button>

      {status?.receivedAt ? (
        <p className="mt-3 text-right text-xs text-muted-foreground">
          Last update: {new Date(status.receivedAt).toLocaleTimeString()}
        </p>
      ) : null}
    </article>
  );
}

export default function OtaPanel() {
  const { entriesByKey } = useFleetDataContext();
  const [units, setUnits] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [stagedByTarget, setStagedByTarget] = useState({
    gateway: null,
    container: null,
  });
  const [statusByUnit, setStatusByUnit] = useState({});
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState("");
  const [connected, setConnected] = useState(false);

  const selectedUnit = useMemo(
    () => units.find((unit) => buildUnitKey(unit) === selectedKey) || null,
    [selectedKey, units]
  );

  const selectedStatuses = statusByUnit[selectedKey] || createEmptyStatuses();
  const liveEntry = entriesByKey?.[selectedKey] || null;

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      try {
        const response = await apiClient.get("/ota/units");
        if (cancelled) {
          return;
        }

        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        setUnits(items);
        setUnitsError("");
        setSelectedKey((current) => {
          if (current && items.some((item) => buildUnitKey(item) === current)) {
            return current;
          }

          return items[0] ? buildUnitKey(items[0]) : "";
        });
      } catch (error) {
        if (!cancelled) {
          setUnits([]);
          setUnitsError(error?.response?.data?.error || error.message || "Failed to load OTA units.");
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
    const eventSource = new EventSource(getEventSourceUrl());

    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);
    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type !== "ota_status" || !message?.target || !message?.truckId || !message?.containerId) {
          return;
        }

        const key = `${message.truckId}::${message.containerId}`;
        setStatusByUnit((current) => ({
          ...current,
          [key]: {
            ...(current[key] || createEmptyStatuses()),
            [message.target]: message,
          },
        }));
      } catch (_error) {
        // Ignore malformed SSE payloads.
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!selectedUnit?.truckId || !selectedUnit?.containerId) {
        setStagedByTarget({
          gateway: null,
          container: null,
        });
        return;
      }

      try {
        const response = await apiClient.get("/ota/status", {
          params: {
            truckId: selectedUnit.truckId,
            containerId: selectedUnit.containerId,
          },
        });

        if (cancelled) {
          return;
        }

        const nextStaged = response.data?.staged || {};
        const nextStatuses = response.data?.statuses || {};

        setStagedByTarget({
          gateway: nextStaged.gateway || null,
          container: nextStaged.container || null,
        });

        setStatusByUnit((current) => ({
          ...current,
          [selectedKey]: {
            gateway: nextStatuses.gateway || null,
            container: nextStatuses.container || null,
          },
        }));
      } catch (_error) {
        if (!cancelled) {
          setStagedByTarget({
            gateway: null,
            container: null,
          });
        }
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [selectedKey, selectedUnit]);

  async function handleUpload(target, file) {
    const formData = new FormData();
    formData.append("firmware", file);

    const response = await apiClient.post(`/ota/upload/${target}`, formData);
    const data = response.data || {};
    if (!data.ok) {
      throw new Error(data.error || "Upload failed.");
    }

    setStagedByTarget((current) => ({
      ...current,
      [target]: data,
    }));
  }

  async function handleTrigger(target) {
    if (!selectedUnit?.truckId || !selectedUnit?.containerId) {
      throw new Error("Select a truck/container pair first.");
    }

    const response = await apiClient.post(`/ota/trigger/${target}`, {
      truckId: selectedUnit.truckId,
      containerId: selectedUnit.containerId,
    });

    const data = response.data || {};
    if (!data.ok) {
      throw new Error(data.error || "Trigger failed.");
    }
  }

  const unitOptions = units.map((unit) => ({
    key: buildUnitKey(unit),
    label: `${unit.truckId} / ${unit.containerId}${unit.fleetId ? ` • ${unit.fleetId}` : ""}`,
  }));

  return (
    <section className="panel-surface">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Firmware</p>
          <h2 className="mt-2 text-3xl font-bold text-ink">Over-the-Air Updates</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Select a registered truck/container pair, stage the firmware binary, and trigger the
            update flow from the platform. Gateway downloads the binary over HTTP and relays
            container firmware over ESP-NOW.
          </p>
        </div>

        <div className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {connected ? "Live" : "Reconnecting"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 rounded-3xl border border-border bg-surface-elevated p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-ink">Target Unit</p>
          <p className="mt-1 text-sm text-muted-foreground">
            OTA commands are now sent to the selected truck/container pair instead of a single hard-coded demo device.
          </p>
        </div>

        <div className="grid gap-3">
          {unitsLoading ? (
            <p className="text-sm text-muted-foreground">Loading registered units...</p>
          ) : units.length > 0 ? (
            <>
              <DeviceSelector devices={unitOptions} selectedKey={selectedKey} onChange={setSelectedKey} />
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <UnitStatusPill unit={liveEntry ? { ...selectedUnit, isOnline: Boolean(liveEntry?.isOnline) } : selectedUnit} />
                {selectedUnit?.fleetId ? <span>Fleet: {selectedUnit.fleetId}</span> : null}
                {liveEntry?.receivedAt ? (
                  <span>Last telemetry: {new Date(liveEntry.receivedAt).toLocaleString()}</span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-600">
              {unitsError || "No registered OTA-capable truck/container pairs were found for this tenant."}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-4 text-sm text-muted-foreground">
        Flashing flow: stage the correct <code>.bin</code> file, choose the target unit, then send the OTA command.
        Gateway updates use the selected truck topic directly, and container updates use the matching container OTA topic.
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {TARGETS.map((target) => (
          <TargetCard
            key={target.id}
            target={target}
            selectedUnit={selectedUnit}
            staged={stagedByTarget[target.id]}
            status={selectedStatuses[target.id]}
            onUpload={handleUpload}
            onTrigger={handleTrigger}
          />
        ))}
      </div>
    </section>
  );
}
