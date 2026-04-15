import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { FleetDataProvider } from "./context/FleetDataContext";
import AlertsPage from "./pages/AlertsPage";
import FleetOverviewPage from "./pages/FleetOverviewPage";
import TruckDetailPage from "./pages/TruckDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <FleetDataProvider refreshIntervalMs={5000}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/fleet" replace />} />
            <Route path="/fleet" element={<FleetOverviewPage />} />
            <Route path="/detail/:truckId/:containerId" element={<TruckDetailPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="*" element={<Navigate to="/fleet" replace />} />
          </Route>
        </Routes>
      </FleetDataProvider>
    </BrowserRouter>
  );
}