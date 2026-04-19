import { Navigate, Outlet } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";

export default function RequireRole({ allowedRoles, fallbackPath = "/fleet" }) {
  const { initializing, isAuthenticated, hasAnyRole } = useAuthContext();

  if (initializing) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyRole(allowedRoles)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
