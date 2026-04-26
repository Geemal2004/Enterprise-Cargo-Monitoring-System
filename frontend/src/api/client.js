import axios from "axios";

const AUTH_STORAGE_KEY = "smartcargo.auth.session";
const DEFAULT_API_URL = "https://vish85521-cargo.hf.space/api";
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let currentSession = readSessionFromStorage();
let refreshPromise = null;
const sessionListeners = new Set();

function readSessionFromStorage() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return sanitizeSession(parsed);
  } catch (_error) {
    return null;
  }
}

function sanitizeSession(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const tokens = input.tokens && typeof input.tokens === "object" ? input.tokens : null;
  const user = input.user && typeof input.user === "object" ? input.user : null;

  const accessToken = tokens && typeof tokens.accessToken === "string" ? tokens.accessToken : "";
  const refreshToken = tokens && typeof tokens.refreshToken === "string" ? tokens.refreshToken : "";

  if (!accessToken && !refreshToken) {
    return null;
  }

  return {
    user,
    tokens: {
      tokenType: tokens && typeof tokens.tokenType === "string" ? tokens.tokenType : "Bearer",
      accessToken,
      refreshToken,
      accessTokenExpiresIn:
        tokens && typeof tokens.accessTokenExpiresIn === "string"
          ? tokens.accessTokenExpiresIn
          : "",
      refreshTokenExpiresIn:
        tokens && typeof tokens.refreshTokenExpiresIn === "string"
          ? tokens.refreshTokenExpiresIn
          : "",
    },
  };
}

function persistSession(session) {
  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function notifySessionListeners() {
  for (const listener of sessionListeners) {
    listener(currentSession);
  }
}

function getAccessToken() {
  return currentSession?.tokens?.accessToken || "";
}

function getRefreshToken() {
  return currentSession?.tokens?.refreshToken || "";
}

function isAuthRequest(url) {
  return typeof url === "string" && (url.includes("/auth/login") || url.includes("/auth/refresh"));
}

export function getAuthSession() {
  return currentSession;
}

export function setAuthSession(session) {
  currentSession = sanitizeSession(session);
  persistSession(currentSession);
  notifySessionListeners();
  return currentSession;
}

export function clearAuthSession() {
  currentSession = null;
  persistSession(null);
  notifySessionListeners();
}

export function subscribeAuthSession(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

async function requestAccessTokenRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available.");
  }

  refreshPromise = refreshClient
    .post("/auth/refresh", { refreshToken })
    .then((response) => {
      const payload = response.data || {};
      const nextSession = setAuthSession({
        user: payload.user || currentSession?.user || null,
        tokens: payload.tokens || null,
      });

      const nextAccessToken = nextSession?.tokens?.accessToken || "";
      if (!nextAccessToken) {
        throw new Error("Token refresh response did not include access token.");
      }

      return nextAccessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (!token) {
    return config;
  }

  const nextHeaders = config.headers || {};
  if (!nextHeaders.Authorization) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  return {
    ...config,
    headers: nextHeaders,
  };
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const statusCode = error?.response?.status;

    if (!originalRequest || statusCode !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isAuthRequest(originalRequest.url)) {
      clearAuthSession();
      return Promise.reject(error);
    }

    if (!getRefreshToken()) {
      clearAuthSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const nextAccessToken = await requestAccessTokenRefresh();
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        Authorization: `Bearer ${nextAccessToken}`,
      };
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearAuthSession();
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
