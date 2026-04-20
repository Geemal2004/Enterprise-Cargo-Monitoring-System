import apiClient from "./client";

function toQueryString(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchTrips(params = {}) {
  const response = await apiClient.get(`/trips${toQueryString(params)}`);
  return response.data;
}

export async function createTrip(payload) {
  const response = await apiClient.post("/trips", payload);
  return response.data;
}

export async function startTrip(tripId, payload = {}) {
  const encodedId = encodeURIComponent(tripId);
  const response = await apiClient.post(`/trips/${encodedId}/start`, payload);
  return response.data;
}

export async function completeTrip(tripId, payload = {}) {
  const encodedId = encodeURIComponent(tripId);
  const response = await apiClient.post(`/trips/${encodedId}/complete`, payload);
  return response.data;
}
