import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { AuthProvider } from "./context/AuthContext";
import { FleetDataProvider } from "./context/FleetDataContext";
import AlertsPage from "./pages/AlertsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HomePage from "./pages/HomePage";
import FleetOverviewPage from "./pages/FleetOverviewPage";
import DashboardPage from "./pages/DashboardPage";
import FleetManagerAssignmentsPage from "./pages/FleetManagerAssignmentsPage";
import LoginPage from "./pages/LoginPage";
import OtaPage from "./pages/OtaPage";
import TripDetailPage from "./pages/TripDetailPage";
import TruckDetailPage from "./pages/TruckDetailPage";
import TripsPage from "./pages/TripsPage";
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
					<Route path="/" element={<HomePage />} />
					<Route path="/login" element={<LoginPage />} />
					<Route path="/dashboard" element={<DashboardPage />} />

					<Route element={<RequireAuth />}>
						<Route element={<ProtectedPortal />}>
							<Route path="/fleet" element={<FleetOverviewPage />} />
							<Route path="/analytics" element={<AnalyticsPage />} />

							<Route
								element={<RequireRole allowedRoles={["super_admin", "tenant_admin", "admin"]} />}
							>
								<Route path="/ota" element={<OtaPage />} />
							</Route>

							<Route element={<RequireRole allowedRoles={["super_admin"]} />}>
								<Route
									path="/admin/fleet-manager-assignments"
									element={<FleetManagerAssignmentsPage />}
								/>
							</Route>

							<Route path="/detail/:truckId/:containerId" element={<TruckDetailPage />} />
							<Route path="/alerts" element={<AlertsPage />} />

							<Route
								element={
									<RequireRole
										allowedRoles={["super_admin", "tenant_admin", "admin", "fleet_manager"]}
									/>
								}
							>
								<Route path="/trips" element={<TripsPage />} />
								<Route path="/trips/:tripCode" element={<TripDetailPage />} />
							</Route>

							<Route
								element={<RequireRole allowedRoles={["super_admin", "tenant_admin", "admin"]} />}
							>
								<Route path="/admin/users" element={<UserManagementPage />} />
							</Route>

							<Route path="*" element={<Navigate to="/fleet" replace />} />
						</Route>
					</Route>

					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</AuthProvider>
		</BrowserRouter>
	);
}
