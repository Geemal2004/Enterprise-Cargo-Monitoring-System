import { MetricCard } from "@/components/ui/card";

export default function SummaryCard({ title, value, subtitle, tone = "default", icon, className }) {
  return (
    <MetricCard
      title={title}
      value={value}
      subtitle={subtitle}
      tone={tone}
      icon={icon}
      className={className}
    />
  );
}
