import { NavLink, Outlet } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import { useFleetDataContext } from "../context/FleetDataContext";
import { formatDateTime } from "../types/telemetry";

function NavItem({ to, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
      {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const { lastUpdated } = useFleetDataContext();
  const { user, logout, hasAnyRole } = useAuthContext();

  const canManageUsers = hasAnyRole(["super_admin", "tenant_admin", "admin"]);
  const canManageAssignments = hasAnyRole(["super_admin"]);
  const canManageOta = hasAnyRole(["super_admin", "tenant_admin", "admin"]);
  const canViewTrips = hasAnyRole(["super_admin", "tenant_admin", "admin", "fleet_manager"]);
  const primaryRole = user?.roles?.[0] || "viewer";

  return (
    <div className="portal-shell">
      <div className="portal-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <p className="eyebrow">Operations Console</p>
            <h1 className="portal-title">Smart Cargo</h1>
            <p className="portal-subtitle">Monitoring Workspace</p>
          </div>
          <nav className="sidebar-nav">
            <NavItem to="/fleet" label="Fleet Overview" />
            <NavItem to="/analytics" label="Analytics" />
            <NavItem to="/alerts" label="Alerts" />
            {canViewTrips ? <NavItem to="/trips" label="Trips" /> : null}
            {canManageOta ? <NavItem to="/ota" label="OTA Updates" /> : null}
            {canManageUsers ? <NavItem to="/admin/users" label="User Management" /> : null}
            {canManageAssignments ? (
              <NavItem to="/admin/fleet-manager-assignments" label="Fleet Manager Assignments" />
            ) : null}
          </nav>
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
            <button className="table-action" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </aside>
        <main className="content-area">
          <section className="page-content">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
}
