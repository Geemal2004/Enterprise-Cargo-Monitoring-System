import { Label, Select } from "@/components/ui/input";

export default function DeviceSelector({ devices, selectedKey, onChange, label = "Truck/Container" }) {
  if (!devices || devices.length === 0) {
    return (
      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">No active device</span>
      </div>
    );
  }

  if (devices.length === 1) {
    return (
      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <strong className="text-sm text-foreground">{devices[0].label}</strong>
      </div>
    );
  }

  return (
    <Label htmlFor="device-selector" className="min-w-[200px]">
      {label}
      <Select
        id="device-selector"
        value={selectedKey}
        onChange={(event) => onChange(event.target.value)}
      >
        {devices.map((device) => (
          <option key={device.key} value={device.key}>
            {device.label}
          </option>
        ))}
      </Select>
    </Label>
  );
}
