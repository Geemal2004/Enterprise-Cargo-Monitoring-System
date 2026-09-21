import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "../types/telemetry";

const SEVERITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

function alertStateTone(active) {
  return active ? "warning" : "muted";
}

export default function AlertsTable({ alerts }) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return (alerts || []).filter((item) => {
      const severityOk = severityFilter === "all" || item.severityLevel === severityFilter;
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "active" && item.active) ||
        (statusFilter === "resolved" && !item.active);

      return severityOk && statusOk;
    });
  }, [alerts, severityFilter, statusFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts Log</CardTitle>
        <CardDescription>Filter incidents by severity and lifecycle state</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3">
          <Label className="min-w-[152px]">
            Severity Level
            <Select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Label>

          <Label className="min-w-[152px]">
            Alert State
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={(alerts || []).length === 0 ? "No alerts yet" : "No matching alerts"}
            description={
              (alerts || []).length === 0
                ? "This view will populate automatically when thresholds are triggered."
                : "Try broadening the filter criteria."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Last Seen</TableHead>
                <TableHead>Truck / Container</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateTime(item.lastSeenAt)}</TableCell>
                  <TableCell>
                    <Link
                      className="font-semibold text-signal no-underline hover:underline"
                      to={`/detail/${item.truckId}/${item.containerId}`}
                    >
                      {item.truckId} / {item.containerId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge tone={item.severityLevel}>{item.severity}</Badge>
                  </TableCell>
                  <TableCell>{item.message}</TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <Badge tone={alertStateTone(item.active)}>
                        {item.active ? "Active" : "Resolved"}
                      </Badge>
                      {!item.active && item.resolvedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.resolvedAt)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
