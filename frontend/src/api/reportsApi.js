import apiClient from "./client";

export async function generateContainerDaySummary(payload) {
  const response = await apiClient.post("/reports/container-day-summary", payload);
  return response.data;
}
