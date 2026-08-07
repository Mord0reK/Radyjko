export type ReleaseAssetKind =
  | "android-apk"
  | "windows-exe"
  | "linux-appimage"
  | "linux-deb"
  | "linux-rpm"
  | "linux-arch";

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  kind: ReleaseAssetKind;
}

export interface LatestRelease {
  version: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

interface GitHubAsset {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
}

interface GitHubRelease {
  tag_name?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

const RELEASE_API_URL = "https://api.github.com/repos/Mord0reK/Radyjko/releases/latest";
const CACHE_KEY = "radyjko_latest_release_v1";
const CACHE_DURATION_MS = 15 * 60 * 1000;

let releaseRequest: Promise<LatestRelease> | null = null;

function getAssetKind(name: string): ReleaseAssetKind | null {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".apk")) return "android-apk";
  if (normalized.endsWith(".exe")) return "windows-exe";
  if (normalized.endsWith(".appimage")) return "linux-appimage";
  if (normalized.endsWith(".deb")) return "linux-deb";
  if (normalized.endsWith(".rpm")) return "linux-rpm";
  if (normalized.endsWith(".pkg.tar.zst")) return "linux-arch";
  return null;
}

function isTrustedDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.startsWith("/Mord0reK/Radyjko/releases/download/");
  } catch {
    return false;
  }
}

export function parseLatestRelease(payload: GitHubRelease): LatestRelease {
  if (typeof payload.tag_name !== "string" || !Array.isArray(payload.assets)) {
    throw new Error("GitHub zwrócił nieprawidłowe dane wydania");
  }

  const assets = payload.assets.flatMap((value): ReleaseAsset[] => {
    const asset = value as GitHubAsset;
    if (
      typeof asset.name !== "string" ||
      typeof asset.browser_download_url !== "string" ||
      typeof asset.size !== "number"
    ) return [];

    const kind = getAssetKind(asset.name);
    if (!kind || !isTrustedDownloadUrl(asset.browser_download_url)) return [];

    return [{
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      kind,
    }];
  });

  return {
    version: payload.tag_name.replace(/^v/i, ""),
    publishedAt: typeof payload.published_at === "string" ? payload.published_at : "",
    assets,
  };
}

function readCachedRelease(): LatestRelease | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as {
      expiresAt?: number;
      release?: LatestRelease;
    } | null;
    if (!cached?.release || !cached.expiresAt || cached.expiresAt <= Date.now()) return null;
    return cached.release;
  } catch {
    return null;
  }
}

function cacheRelease(release: LatestRelease): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      expiresAt: Date.now() + CACHE_DURATION_MS,
      release,
    }));
  } catch {
    // Brak localStorage nie powinien blokować pobierania wydania.
  }
}

export async function fetchLatestRelease(forceRefresh = false): Promise<LatestRelease> {
  if (!forceRefresh) {
    const cached = readCachedRelease();
    if (cached) return cached;
    if (releaseRequest) return releaseRequest;
  }

  releaseRequest = fetch(RELEASE_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(response.status === 404
        ? "Najnowsze wydanie nie jest jeszcze publicznie dostępne"
        : "Nie udało się pobrać informacji o najnowszym wydaniu");
    }
    const release = parseLatestRelease(await response.json() as GitHubRelease);
    cacheRelease(release);
    return release;
  }).finally(() => {
    releaseRequest = null;
  });

  return releaseRequest;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
