import apiClient from "./client";

export function fetchLatestTelemetry() {
  return apiClient.get("/latest");
}

export function fetchActiveAlerts() {
  return apiClient.get("/alerts");
}
