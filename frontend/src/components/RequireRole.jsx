import { Navigate, Outlet } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "../context/AuthContext";

export default function RequireRole({ allowedRoles, fallbackPath = "/fleet" }) {
  const { initializing, isAuthenticated, hasAnyRole } = useAuthContext();

  if (initializing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <Spinner label="Checking permissions" />
            <p className="text-sm text-muted-foreground">Checking permissions…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyRole(allowedRoles)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
