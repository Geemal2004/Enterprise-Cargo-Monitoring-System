import { LiveDot } from "@/components/ui/signal-marker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, MetricCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import FleetTable from "../components/FleetTable";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Truck,
  Warehouse,
} from "lucide-react";
import { useFleetDataContext } from "../context/FleetDataContext";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

export default function FleetOverviewPage() {
  const { loading, error, entries, alertsByKey, fleetSummary } = useFleetDataContext();
  const reduced = useReducedMotion();
  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const stats = [
    {
      title: "Total trucks",
      value: fleetSummary.totalTrucks,
      subtitle: "Tracked in the console",
      icon: <Truck size={16} />,
      tone: "default",
    },
    {
      title: "Online",
      value: fleetSummary.onlineTrucks,
      subtitle: "Reporting within SLA",
      icon: <Activity size={16} />,
      tone: "success",
    },
    {
      title: "Active alerts",
      value: fleetSummary.activeAlerts,
      subtitle: "Open incidents",
      icon: <AlertTriangle size={16} />,
      tone: "warning",
    },
    {
      title: "Containers warning",
      value: fleetSummary.warningContainers,
      subtitle: "Operational warnings",
      icon: <Warehouse size={16} />,
      tone: "attention",
    },
  ];

  return (
    <div className="dashboard-page flex w-full flex-col gap-5">
      <motion.div {...fadeUp(Boolean(reduced))}>
        <PageHeader
          eyebrow="Control tower"
          title="Fleet Overview"
          description="Live operational view across trucks, containers, and open incidents."
          actions={
            <Link to="/analytics" className="no-underline">
              <Button variant="ink" type="button">
                View analytics
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </Link>
          }
        />
      </motion.div>

      <motion.div
        {...fadeUp(Boolean(reduced))}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm lg:flex-row lg:items-center"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {todayLabel}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Badge tone="success" className="gap-2">
            <LiveDot />
            Live link
          </Badge>
          <Badge tone="muted">
            {loading ? "Refreshing…" : `${entries?.length || 0} units`}
          </Badge>
          {loading ? <Spinner size="sm" label="Refreshing fleet" /> : null}
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer(Boolean(reduced))}
        initial="hidden"
        animate="visible"
      >
        {stats.map((stat) => (
          <motion.div key={stat.title} variants={staggerItem(Boolean(reduced))}>
            <MetricCard
              title={stat.title}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
              tone={stat.tone}
            />
          </motion.div>
        ))}
      </motion.div>

      {error ? (
        <Alert tone="error" title="Telemetry sync issue">
          {error}
        </Alert>
      ) : null}

      <motion.div {...fadeUp(Boolean(reduced))}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-[color:var(--cm-surface-muted)]/80 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Fleet status</CardTitle>
              <CardDescription>
                {loading
                  ? "Refreshing live telemetry…"
                  : `${entries.length} active truck / container units`}
              </CardDescription>
            </div>
            <p className="text-xs text-muted-foreground">Updated every 5s</p>
          </CardHeader>
          <CardContent className="p-0">
            <FleetTable entries={entries} alertsByKey={alertsByKey} />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
