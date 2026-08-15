import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { addPluginListener, invoke } from "@tauri-apps/api/core";
import { compareVersions, fetchLatestRelease, type ReleaseAsset } from "@/lib/releases";
import { isTauriAndroid } from "@/lib/platform";

interface UpdateState {
  currentVersion: string;
  latestVersion: string;
  asset: ReleaseAsset;
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  phase: "downloading" | "installing";
}

export function AndroidUpdateNotice() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    if (!isTauriAndroid()) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;
    void addPluginListener<DownloadProgress>("radyjko-auto", "apkDownloadProgress", setProgress)
      .then((listener) => {
        const remove = () => { void listener.unregister(); };
        if (active) unsubscribe = remove;
        else remove();
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauriAndroid()) return;

    let cancelled = false;

    void Promise.all([getVersion(), fetchLatestRelease(true)])
      .then(([currentVersion, release]) => {
        if (cancelled || compareVersions(release.version, currentVersion) <= 0) return;

        const asset = release.assets.find((candidate) => candidate.kind === "android-apk");
        if (asset) setUpdate({ currentVersion, latestVersion: release.version, asset });
      })
      .catch(() => {
        // Aktualizacja jest opcjonalna i nie może blokować uruchomienia radia.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isTauriAndroid() || !update || dismissed) return null;

  const installUpdate = async (): Promise<void> => {
    setInstalling(true);
    setInstallError(null);
    setProgress({ downloaded: 0, total: 0, percent: 0, phase: "downloading" });
    try {
      await invoke("install_android_update", { args: { url: update.asset.url } });
      setDismissed(true);
    } catch (reason) {
      setInstallError(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Nie udało się uruchomić instalatora APK");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-10 z-[90] flex justify-center p-3" role="status" aria-live="polite">
      <div className="pointer-events-auto w-full max-w-lg animate-update-in rounded-2xl border border-green-500/40 bg-neutral-950 p-4 shadow-2xl shadow-black/40 sm:p-5">
        <div className="flex items-start gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-400">Dostępna aktualizacja</p>
            <h2 id="android-update-heading" className="mt-1 text-xl font-bold text-white">Nowe Radyjko</h2>
          </div>
          <button type="button" onClick={() => setDismissed(true)} className="ml-auto rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-neutral-300">
          Wersja {update.latestVersion} jest dostępna. Używasz wersji {update.currentVersion}.
        </p>
        {installError && <p className="mt-3 text-sm text-red-300">{installError}</p>}
        {installing && (
          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3" aria-live="polite">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <Loader2 className="h-4 w-4 animate-spin text-green-400" />
              {progress?.phase === "installing" ? "Uruchamianie instalatora..." : "Pobieranie aktualizacji..."}
              {progress?.phase === "downloading" && <span className="ml-auto text-green-400">{progress.total > 0 ? `${progress.percent}%` : "..."}</span>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className={`h-full rounded-full bg-green-500 transition-[width] duration-200 ${progress?.total ? "" : "w-1/3 animate-pulse"}`} style={progress?.total ? { width: `${progress.percent}%` } : undefined} />
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => void installUpdate()} disabled={installing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 font-bold text-black hover:bg-green-400 disabled:cursor-wait disabled:opacity-60">
            <Download className="h-5 w-5" /> {installing ? "Pobieranie i instalowanie..." : "Pobierz i zainstaluj"}
          </button>
          <button type="button" onClick={() => setDismissed(true)} className="rounded-xl border border-neutral-700 px-4 py-3 font-semibold text-neutral-300 hover:bg-neutral-800">
            Później
          </button>
        </div>
      </div>
    </div>
  );
}
