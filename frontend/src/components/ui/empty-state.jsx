import { Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({
  className,
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description,
  actionLabel,
  onAction,
  actionTo,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center",
        className
      )}
    >
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="mt-5 no-underline">
          <Button variant="secondary" type="button">
            {actionLabel}
          </Button>
        </Link>
      ) : null}
      {actionLabel && onAction && !actionTo ? (
        <Button variant="secondary" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({
  className,
  title = "Something went wrong",
  description = "We couldn’t load this view. Try again in a moment.",
  onRetry,
}) {
  return (
    <EmptyState
      className={cn(
        "border-[color:var(--cm-danger-border)] bg-[color:var(--cm-danger-bg)]/40",
        className
      )}
      title={title}
      description={description}
      actionLabel={onRetry ? "Try again" : undefined}
      onAction={onRetry}
    />
  );
}

export default EmptyState;
