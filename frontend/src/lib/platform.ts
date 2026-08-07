/**
 * Platform detection for Radyjko.
 *
 * Tauri 2 uses the same __TAURI_INTERNALS__ global on both desktop and mobile.
 * We need a finer-grained check to distinguish desktop from mobile Tauri.
 *
 * Detection strategy:
 * 1. __TAURI_INTERNALS__ present → Tauri app (desktop OR mobile)
 * 2. navigator.userAgent contains "Android" → Android Tauri
 * 3. __TAURI_INTERNALS__ present but no "Android" → Desktop Tauri
 * 4. Neither → plain web browser
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

function userAgentIncludes(value: string): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes(value);
}

/** True when running inside any Tauri webview (desktop or mobile). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** True when running inside a desktop Tauri webview (Windows / macOS / Linux). */
export function isTauriDesktop(): boolean {
  return isTauri() && !userAgentIncludes("Android");
}

/** True when running inside an Android Tauri webview. */
export function isTauriAndroid(): boolean {
  return isTauri() && userAgentIncludes("Android");
}

/** True when running in a plain web browser (not Tauri at all). */
export function isWeb(): boolean {
  return !isTauri();
}
