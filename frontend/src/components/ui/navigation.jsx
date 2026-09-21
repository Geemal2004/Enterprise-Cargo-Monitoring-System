import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function SidebarNav({ children, className, label = "Primary" }) {
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-1.5", className)}>
      {children}
    </nav>
  );
}

export function SidebarNavItem({ to, children, end, className, ...props }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-2.5 text-sm font-semibold no-underline transition-colors duration-fast ease-standard",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cm-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--cm-sidebar)]",
          isActive
            ? "bg-[color:var(--cm-sidebar-elevated)] text-[color:var(--cm-text-inverse)] shadow-[inset_0_0_0_1px_var(--cm-sidebar-border)]"
            : "bg-transparent text-[color:var(--cm-sidebar-text)] hover:bg-white/10 hover:text-[color:var(--cm-text-inverse)]",
          className
        )
      }
      {...props}
    >
      {children}
    </NavLink>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SiteFooter({ className, brand = "CargoMonitor", links = [] }) {
  return (
    <footer
      className={cn(
        "mt-16 flex flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <p className="font-display text-lg font-bold text-ink">{brand}</p>
      <p className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} Enterprise Cargo Monitoring System. All rights reserved.
      </p>
      {links.length ? (
        <div className="flex gap-6 text-sm text-muted-foreground">
          {links.map((link) => (
            <a key={link.href + link.label} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </footer>
  );
}

export default SidebarNav;
