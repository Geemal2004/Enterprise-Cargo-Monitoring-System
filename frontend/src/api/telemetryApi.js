import apiClient from "./client";

export function fetchLatestTelemetry() {
  return apiClient.get("/latest");
}

export function fetchActiveAlerts() {
  return apiClient.get("/alerts");
}

export function fetchBackendHealth() {
  return apiClient.get("/health");
}

function isNotFoundError(error) {
  return error && error.response && error.response.status === 404;
}

export async function fetchFleetSummaryOptional() {
  try {
    const response = await apiClient.get("/fleet/summary");
    return response.data;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function fetchDeviceHistoryOptional(truckId, containerId) {
  const encodedTruck = encodeURIComponent(truckId);
  const encodedContainer = encodeURIComponent(containerId);

  const candidateUrls = [
    `/history/${encodedTruck}/${encodedContainer}`,
    `/history?truckId=${encodedTruck}&containerId=${encodedContainer}`,
    `/telemetry/history/${encodedTruck}/${encodedContainer}`,
  ];

  for (const url of candidateUrls) {
    try {
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  return null;
}
