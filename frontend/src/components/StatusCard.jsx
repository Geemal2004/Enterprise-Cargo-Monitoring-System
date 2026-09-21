import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatusCard({ title, value, subtitle, icon, iconTone, className }) {
  return (
    <Card className={cn("min-h-[96px] border-t-[3px] border-t-[color:var(--cm-border-strong)]", className)}>
      <CardContent className="flex h-full flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          {icon ? (
            <div
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md border border-transparent bg-muted text-foreground",
                iconTone
              )}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {title}
            </p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <p className="mt-auto text-lg font-bold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
