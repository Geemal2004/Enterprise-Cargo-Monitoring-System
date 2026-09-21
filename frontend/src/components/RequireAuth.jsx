import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "../context/AuthContext";

export default function RequireAuth() {
  const location = useLocation();
  const { initializing, isAuthenticated } = useAuthContext();

  if (initializing) {
    return (
      <div className="auth-loading-shell">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center gap-3 p-6">
            <Spinner label="Validating session" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Authentication
              </p>
              <h2 className="text-lg font-semibold text-foreground">Checking session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Validating your access token and tenant context.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    const target = `${location.pathname}${location.search || ""}`;
    return <Navigate to="/login" replace state={{ from: target }} />;
  }

  return <Outlet />;
}
