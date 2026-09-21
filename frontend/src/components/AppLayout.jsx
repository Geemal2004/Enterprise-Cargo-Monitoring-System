import { Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav, SidebarNavItem } from "@/components/ui/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { useAuthContext } from "../context/AuthContext";
import { useFleetDataContext } from "../context/FleetDataContext";
import { formatDateTime } from "../types/telemetry";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function SidebarContent({ onNavigate }) {
  const { lastUpdated } = useFleetDataContext();
  const { user, logout, hasAnyRole } = useAuthContext();

  const canManageUsers = hasAnyRole(["super_admin", "tenant_admin", "admin"]);
  const canManageAssignments = hasAnyRole(["super_admin"]);
  const canManageOta = hasAnyRole(["super_admin", "tenant_admin", "admin"]);
  const canViewTrips = hasAnyRole(["super_admin", "tenant_admin", "admin", "fleet_manager"]);
  const primaryRole = user?.roles?.[0] || "viewer";

  const handleNav = () => onNavigate?.();

  return (
    <>
      <div className="sidebar-brand">
        <p className="eyebrow">CargoMonitor</p>
        <h1 className="portal-title">Smart Cargo</h1>
        <p className="portal-subtitle">Operations Console</p>
      </div>
      <SidebarNav className="sidebar-nav" label="Console">
        <SidebarNavItem to="/fleet" onClick={handleNav}>
          Fleet Overview
        </SidebarNavItem>
        <SidebarNavItem to="/analytics" onClick={handleNav}>
          Analytics
        </SidebarNavItem>
        <SidebarNavItem to="/alerts" onClick={handleNav}>
          Alerts
        </SidebarNavItem>
        {canViewTrips ? (
          <SidebarNavItem to="/trips" onClick={handleNav}>
            Trips
          </SidebarNavItem>
        ) : null}
        {canManageOta ? (
          <SidebarNavItem to="/ota" onClick={handleNav}>
            OTA Updates
          </SidebarNavItem>
        ) : null}
        {canManageUsers ? (
          <SidebarNavItem to="/admin/users" onClick={handleNav}>
            User Management
          </SidebarNavItem>
        ) : null}
        {canManageAssignments ? (
          <SidebarNavItem to="/admin/fleet-manager-assignments" onClick={handleNav}>
            Fleet Manager Assignments
          </SidebarNavItem>
        ) : null}
      </SidebarNav>
      <div className="sidebar-meta">
        <div>
          <span className="meta-label">Signed in as</span>
          <strong>{user?.fullName || user?.email || "User"}</strong>
          <span className="meta-label">{primaryRole}</span>
        </div>
        <div>
          <span className="meta-label">Last refresh</span>
          <strong>{formatDateTime(lastUpdated)}</strong>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-[color:var(--cm-sidebar-border)] bg-transparent text-[color:var(--cm-text-inverse)] hover:bg-white/10"
          onClick={logout}
        >
          Sign out
        </Button>
      </div>
    </>
  );
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="portal-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[1200] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        Skip to main content
      </a>

      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Smart Cargo
          </p>
          <p className="text-sm font-semibold text-foreground">Operations</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[900] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 border-0 bg-ink/50"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-sidebar"
            className={cn(
              "sidebar absolute left-3 right-3 top-3 flex max-h-[calc(100vh-1.5rem)] min-h-0 overflow-y-auto"
            )}
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="portal-layout">
        <aside className="sidebar hidden lg:flex" aria-label="Operations sidebar">
          <SidebarContent />
        </aside>
        <main id="main-content" className="content-area" tabIndex={-1}>
          <section className="page-content">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </section>
        </main>
      </div>
    </div>
  );
}
