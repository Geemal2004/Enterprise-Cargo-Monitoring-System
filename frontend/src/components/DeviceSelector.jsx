export default function DeviceSelector({ devices, selectedKey, onChange }) {
  if (!devices || devices.length === 0) {
    return (
      <div>
        <span className="label">Truck/Container:</span>
        <span className="muted">No active device</span>
      </div>
    );
  }

  if (devices.length === 1) {
    return (
      <div>
        <span className="label">Truck/Container:</span>
        <strong>{devices[0].label}</strong>
      </div>
    );
  }

  return (
    <label>
      <span className="label">Truck/Container:</span>
      <select
        className="select"
        value={selectedKey}
        onChange={(event) => onChange(event.target.value)}
      >
        {devices.map((device) => (
          <option key={device.key} value={device.key}>
            {device.label}
          </option>
        ))}
      </select>
    </label>
  );
}
