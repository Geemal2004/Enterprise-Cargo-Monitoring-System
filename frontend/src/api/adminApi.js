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

export async function fetchAdminUsers(params = {}) {
  const response = await apiClient.get(`/admin/users${toQueryString(params)}`);
  return response.data;
}

export async function fetchAdminRoles() {
  const response = await apiClient.get("/admin/roles");
  return response.data;
}

export async function createAdminUser(payload) {
  const response = await apiClient.post("/admin/users", payload);
  return response.data;
}

export async function patchAdminUser(userId, payload) {
  const encodedUserId = encodeURIComponent(userId);
  const response = await apiClient.patch(`/admin/users/${encodedUserId}`, payload);
  return response.data;
}

export async function resetAdminUserPassword(userId, newPassword) {
  const encodedUserId = encodeURIComponent(userId);
  const response = await apiClient.post(`/admin/users/${encodedUserId}/reset-password`, {
    newPassword,
  });
  return response.data;
}
