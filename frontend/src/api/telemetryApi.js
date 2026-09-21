import apiClient from "./client";

function noCacheConfig() {
  return {
    params: { _: Date.now() },
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  };
}

export function fetchLatestTelemetry() {
  return apiClient.get("/latest", noCacheConfig());
}

export function fetchActiveAlerts() {
  return apiClient.get("/alerts", noCacheConfig());
}

export function fetchBackendHealth() {
  return apiClient.get("/health", noCacheConfig());
}

function isNotFoundError(error) {
  return error && error.response && error.response.status === 404;
}

export async function fetchFleetSummaryOptional() {
  try {
    const response = await apiClient.get("/fleet/summary", noCacheConfig());
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
