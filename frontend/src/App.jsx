import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { Spinner } from "./components/ui/spinner";
import { ToastProvider } from "./components/ui/toast";
import { AuthProvider } from "./context/AuthContext";
import { FleetDataProvider } from "./context/FleetDataContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import FleetOverviewPage from "./pages/FleetOverviewPage";

const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const FleetManagerAssignmentsPage = lazy(() => import("./pages/FleetManagerAssignmentsPage"));
const OtaPage = lazy(() => import("./pages/OtaPage"));
const TripDetailPage = lazy(() => import("./pages/TripDetailPage"));
const TruckDetailPage = lazy(() => import("./pages/TruckDetailPage"));
const TripsPage = lazy(() => import("./pages/TripsPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));

function RouteFallback() {
	return (
		<div className="flex min-h-[40vh] items-center justify-center gap-3 p-8">
			<Spinner label="Loading page" />
			<span className="text-sm text-muted-foreground">Loading…</span>
		</div>
	);
}

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
				<ToastProvider>
					<Suspense fallback={<RouteFallback />}>
						<Routes>
							<Route path="/" element={<HomePage />} />
							<Route path="/login" element={<LoginPage />} />
							<Route path="/privacy" element={<PrivacyPage />} />
							<Route path="/terms" element={<TermsPage />} />
							<Route path="/dashboard" element={<Navigate to="/fleet" replace />} />

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
					</Suspense>
				</ToastProvider>
			</AuthProvider>
		</BrowserRouter>
	);
}
