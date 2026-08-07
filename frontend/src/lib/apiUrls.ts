const API_PREFIX = "/api";

function normalizeApiPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath === API_PREFIX || normalizedPath.startsWith(`${API_PREFIX}/`)
    ? normalizedPath
    : `${API_PREFIX}${normalizedPath}`;
}

function getRuntimeApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) return configuredBaseUrl;

  if (typeof window === "undefined") {
    throw new Error("API base URL is unavailable outside the browser");
  }

  if (window.location.protocol === "tauri:") {
    throw new Error("VITE_API_BASE_URL must be set for the desktop build");
  }

  return window.location.origin;
}

export function buildApiUrl(path: string, baseUrl: string): string {
  const url = new URL(normalizeApiPath(path), baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API base URL must use HTTP or HTTPS");
  }
  return url.toString();
}

export function getApiUrl(path: string): string {
  return buildApiUrl(path, getRuntimeApiBaseUrl());
}

export function getPublicAssetUrl(path: string): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, getRuntimeApiBaseUrl());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Public asset URL must use HTTP or HTTPS");
  }
  return url.toString();
}

export function buildWebSocketApiUrl(path: string, baseUrl: string): string {
  const url = new URL(buildApiUrl(path, baseUrl));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function getWebSocketApiUrl(path: string): string {
  return buildWebSocketApiUrl(path, getRuntimeApiBaseUrl());
}

export function getStreamUrl(shortName: string): string {
  const url = new URL(getApiUrl("/stream"));
  url.searchParams.set("station", shortName);
  return url.toString();
}
