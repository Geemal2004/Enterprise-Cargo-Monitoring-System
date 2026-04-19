import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { AuthProvider } from "./context/AuthContext";
import { FleetDataProvider } from "./context/FleetDataContext";
import AlertsPage from "./pages/AlertsPage";
import FleetOverviewPage from "./pages/FleetOverviewPage";
import LoginPage from "./pages/LoginPage";
import TruckDetailPage from "./pages/TruckDetailPage";
import UserManagementPage from "./pages/UserManagementPage";

function ProtectedPortal() {
  return (
    <FleetDataProvider refreshIntervalMs={5000}>
      <AppLayout />
    </FleetDataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<ProtectedPortal />}>
              <Route path="/" element={<Navigate to="/fleet" replace />} />
              <Route path="/fleet" element={<FleetOverviewPage />} />
              <Route path="/detail/:truckId/:containerId" element={<TruckDetailPage />} />
              <Route path="/alerts" element={<AlertsPage />} />

              <Route
                element={
                  <RequireRole allowedRoles={["super_admin", "tenant_admin", "admin"]} />
                }
              >
                <Route path="/admin/users" element={<UserManagementPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/fleet" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/fleet" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}