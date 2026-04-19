import apiClient from "./client";

export async function loginWithPassword(credentials) {
  const response = await apiClient.post("/auth/login", {
    email: credentials.email,
    password: credentials.password,
  });

  return response.data;
}

export async function fetchCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data;
}

export async function refreshSession(refreshToken) {
  const response = await apiClient.post("/auth/refresh", {
    refreshToken,
  });
  return response.data;
}
