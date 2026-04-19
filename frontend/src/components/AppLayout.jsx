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
  const primaryRole = user?.roles?.[0] || "viewer";

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div>
          <p className="eyebrow">Operations Console</p>
          <h1 className="portal-title">Smart Cargo Monitoring</h1>
          <p className="portal-subtitle">
            Fleet visibility, risk monitoring, and container condition in one workspace.
          </p>
        </div>
        <div className="header-actions">
          <div className="header-meta">
            <span className="meta-label">Signed in as</span>
            <strong>{user?.fullName || user?.email || "User"}</strong>
            <span className="meta-label">{primaryRole}</span>
          </div>
          <div className="header-meta">
            <span className="meta-label">Last refresh</span>
            <strong>{formatDateTime(lastUpdated)}</strong>
          </div>
          <button className="table-action" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="nav-bar panel-surface">
        <NavItem to="/fleet" label="Fleet Overview" />
        <NavItem to="/alerts" label="Alerts" />
        {canManageUsers ? <NavItem to="/admin/users" label="User Management" /> : null}
      </nav>

      <section className="page-content">
        <Outlet />
      </section>
    </div>
  );
}
