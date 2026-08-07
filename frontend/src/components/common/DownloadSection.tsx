import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Laptop,
  Loader2,
  Monitor,
  Package,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { isWeb } from '@/lib/platform';
import {
  fetchLatestRelease,
  formatFileSize,
  type LatestRelease,
  type ReleaseAsset,
  type ReleaseAssetKind,
} from '@/lib/releases';

interface PlatformCardProps {
  title: string;
  description: string;
  recommended: boolean;
  icon: React.ReactNode;
  assets: ReleaseAsset[];
  labels: Partial<Record<ReleaseAssetKind, string>>;
  onDownload: (asset: ReleaseAsset) => void;
}

const DOWNLOAD_LABELS: Partial<Record<ReleaseAssetKind, string>> = {
  'android-apk': 'Pobierz APK',
  'windows-exe': 'Pobierz instalator',
  'linux-appimage': 'AppImage',
  'linux-deb': 'Ubuntu / Debian (.deb)',
  'linux-rpm': 'Fedora / openSUSE (.rpm)',
  'linux-arch': 'Arch Linux (.pkg.tar.zst)',
};

function PlatformCard({
  title,
  description,
  recommended,
  icon,
  assets,
  labels,
  onDownload,
}: PlatformCardProps) {
  return (
    <article className={`rounded-2xl border p-5 ${recommended ? 'border-green-500/60 bg-green-500/5' : 'border-neutral-800 bg-neutral-900/60'}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-neutral-800 p-3 text-green-400">{icon}</div>
          <div>
            <h3 className="font-bold text-white">{title}</h3>
            <p className="mt-1 text-sm text-neutral-400">{description}</p>
          </div>
        </div>
        {recommended && <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400">Dla tego urządzenia</span>}
      </div>

      <div className="space-y-2">
        {assets.map((asset) => (
          <a
            key={asset.name}
            href={asset.url}
            download={asset.name}
            onClick={() => onDownload(asset)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-green-400 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {labels[asset.kind] || DOWNLOAD_LABELS[asset.kind] || 'Pobierz'}
            </span>
            <span className="text-xs font-medium text-neutral-600">{formatFileSize(asset.size)}</span>
          </a>
        ))}
      </div>
    </article>
  );
}

function InstallationGuide({ asset }: { asset: ReleaseAsset }) {
  const steps = (() => {
    switch (asset.kind) {
      case 'android-apk':
        return [
          'Po zakończeniu pobierania otwórz aplikację Pliki i przejdź do folderu Pobrane.',
          `Dotknij pliku „${asset.name}”. Jeśli Android poprosi o zgodę, wybierz Ustawienia i zezwól przeglądarce lub aplikacji Pliki na instalowanie z tego źródła.`,
          'Wróć do instalatora, wybierz Zainstaluj, a po zakończeniu Otwórz.',
          'Przy kolejnej aktualizacji zainstaluj nowe APK bez odinstalowywania Radyjka — zachowasz ustawienia aplikacji.',
        ];
      case 'windows-exe':
        return [
          `Otwórz pobrany plik „${asset.name}”.`,
          'Jeśli pojawi się filtr SmartScreen, wybierz Więcej informacji, sprawdź nazwę Radyjko i kliknij Uruchom mimo to.',
          'Przejdź przez kolejne kroki instalatora.',
        ];
      case 'linux-appimage':
        return [
          'We właściwościach pobranego pliku zaznacz możliwość uruchamiania jako program.',
          `Możesz też wykonać: chmod +x "${asset.name}"`,
          'Uruchom plik dwukrotnym kliknięciem.',
        ];
      case 'linux-deb':
        return ['Otwórz plik w menedżerze oprogramowania albo wykonaj:', `sudo apt install ./"${asset.name}"`];
      case 'linux-rpm':
        return ['Otwórz plik w menedżerze oprogramowania albo wykonaj:', `sudo dnf install ./"${asset.name}"`];
      case 'linux-arch':
        return ['Otwórz terminal w folderze z pobranym plikiem i wykonaj:', `sudo pacman -U ./"${asset.name}"`];
    }
  })();

  return (
    <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/5 p-5" aria-live="polite">
      <div className="mb-4 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-green-400" />
        <div>
          <h3 className="font-bold text-white">Jak zainstalować pobrany plik?</h3>
          <p className="text-sm text-neutral-400">Pobieranie powinno rozpocząć się automatycznie.</p>
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-neutral-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-xs font-bold text-green-400">{index + 1}</span>
            <span className="min-w-0 break-words font-mono">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function detectPlatform(): 'android' | 'windows' | 'linux' | null {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes('android')) return 'android';
  if (agent.includes('windows')) return 'windows';
  if (agent.includes('linux')) return 'linux';
  return null;
}

interface DownloadMenuProps {
  onOpen?: () => void;
}

export function DownloadMenu({ onOpen }: DownloadMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ReleaseAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [platform] = useState(() => detectPlatform());

  const loadRelease = (forceRefresh = false): void => {
    setLoading(true);
    setError(null);
    void fetchLatestRelease(forceRefresh)
      .then(setRelease)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Nie udało się pobrać wydania'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isWeb()) return null;

  const openMenu = (): void => {
    onOpen?.();
    setIsOpen(true);
    if (!release && !loading) loadRelease();
  };

  const assetsByKind = (kinds: ReleaseAssetKind[]): ReleaseAsset[] =>
    release?.assets.filter((asset) => kinds.includes(asset.kind)) || [];

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        className="mx-3 my-3 flex w-[calc(100%_-_1.5rem)] items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-left text-sm font-semibold text-green-400 transition hover:border-green-500/50 hover:bg-green-500/10"
      >
        <Download className="h-5 w-5" />
        Pobierz aplikację
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6" role="dialog" aria-modal="true" aria-labelledby="download-heading">
          <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsOpen(false)} aria-label="Zamknij okno pobierania" />
          <div className="relative flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4 md:px-7">
              <div>
                <h2 id="download-heading" className="flex items-center gap-2 text-xl font-bold md:text-2xl">
                  <Download className="h-6 w-6 text-green-500" /> Pobierz aplikację
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  {release ? `Najnowsza wersja: ${release.version}` : 'Wybierz system, aby zainstalować Radyjko.'}
                </p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white" aria-label="Zamknij">
                <X className="h-6 w-6" />
              </button>
            </header>

            <div className="min-h-0 overflow-y-auto p-4 md:p-7">
              {release?.publishedAt && (
                <p className="mb-4 text-right text-xs text-neutral-500">Wydano {new Date(release.publishedAt).toLocaleDateString('pl-PL')}</p>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 py-12 text-neutral-400">
                  <Loader2 className="h-5 w-5 animate-spin" /> Pobieranie informacji o wydaniu…
                </div>
              )}

              {!loading && error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
                  <AlertCircle className="mx-auto mb-3 h-7 w-7 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                  <button type="button" onClick={() => loadRelease(true)} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
                    Spróbuj ponownie
                  </button>
                </div>
              )}

              {!loading && release && (
                <>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <PlatformCard title="Android" description="Telefon, tablet i Android Auto" recommended={platform === 'android'} icon={<Smartphone className="h-6 w-6" />} assets={assetsByKind(['android-apk'])} labels={DOWNLOAD_LABELS} onDownload={setSelectedAsset} />
                    <PlatformCard title="Windows" description="Instalator dla Windows 10 i 11" recommended={platform === 'windows'} icon={<Monitor className="h-6 w-6" />} assets={assetsByKind(['windows-exe'])} labels={DOWNLOAD_LABELS} onDownload={setSelectedAsset} />
                    <PlatformCard title="Linux" description="AppImage oraz pakiety dystrybucji" recommended={platform === 'linux'} icon={<Laptop className="h-6 w-6" />} assets={assetsByKind(['linux-appimage', 'linux-deb', 'linux-rpm', 'linux-arch'])} labels={DOWNLOAD_LABELS} onDownload={setSelectedAsset} />
                  </div>

                  {release.assets.length === 0 && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
                      <Package className="h-5 w-5" /> To wydanie nie zawiera obsługiwanych instalatorów.
                    </div>
                  )}
                  {selectedAsset && <InstallationGuide asset={selectedAsset} />}
                  <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Pliki pochodzą bezpośrednio z oficjalnego wydania Radyjka.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
