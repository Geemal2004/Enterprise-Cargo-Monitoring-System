import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";

export default function RequireAuth() {
  const location = useLocation();
  const { initializing, isAuthenticated } = useAuthContext();

  if (initializing) {
    return (
      <div className="auth-loading-shell">
        <section className="panel-surface auth-loading-panel">
          <p className="eyebrow">Authentication</p>
          <h2>Checking session</h2>
          <p className="muted-text">Validating your access token and tenant context.</p>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    const target = `${location.pathname}${location.search || ""}`;
    return <Navigate to="/login" replace state={{ from: target }} />;
  }

  return <Outlet />;
}
