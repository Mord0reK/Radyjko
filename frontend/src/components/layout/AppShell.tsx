import { useCallback, useEffect, useRef, type ReactNode, type TouchEvent, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { PlayerBar } from '@/components/layout/PlayerBar';
import { StationView } from '@/components/views/StationView';
import { usePlayer } from '@/contexts/PlayerContext';
import { useApp, getOrderedStations } from '@/contexts/AppContext';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { getRouteStationName, getStationPath } from '@/lib/clientRoutes';
import { DesktopTitlebar } from '@/components/layout/DesktopTitlebar';
import { DesktopResizeHandles } from '@/components/layout/DesktopResizeHandles';
import { isTauriAndroid, isTauriDesktop } from '@/lib/platform';

interface AppShellProps {
  children: ReactNode;
}

function StationViewWrapper(props: React.ComponentProps<typeof StationView>) {
  return (
    <div key={props.station.id} className="fade-in">
      <StationView {...props} />
    </div>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isStationPage = pathname !== '/';
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRouteStationIdRef = useRef<number | null>(null);
  const lastRouteStationIdRef = useRef<number | null>(null);
  const appHeightClass = isTauriDesktop() ? 'h-[calc(100dvh-2.25rem)]' : 'h-[100dvh]';

  // Combine all states using useApp hook
  const {
    stations,
    stationsLoading,
    nowPlaying,
    currentStationId,
    isPlaying,
    volume,
    isFavorite,
    toggleFavorite,
    playStation,
    pause,
    togglePlay,
    favorites,
    searchQuery,
    audioError,
    clearError,
  } = useApp();

   const playerState = usePlayer();

  // Derywuj dane z poszczególnych stanów bez zbędnych zależności
  const currentStation = stations.find((s) => s.id === currentStationId) || null;
  const currentTrack = currentStationId ? nowPlaying[currentStationId] : null;
  const routeStationName = getRouteStationName(pathname);
  const routeStation = stations.find((s) => s.shortName === routeStationName) || null;

  // Auto-play station when URL changes
  useEffect(() => {
    if (!isStationPage) {
      lastRouteStationIdRef.current = null;
      pendingRouteStationIdRef.current = null;
      return;
    }
    if (!routeStation) return;

    const routeChanged = lastRouteStationIdRef.current !== routeStation.id;
    lastRouteStationIdRef.current = routeStation.id;

    if (currentStationId === routeStation.id) {
      if (isPlaying && pendingRouteStationIdRef.current === routeStation.id) {
        pendingRouteStationIdRef.current = null;
      }
      return;
    }

    // Zmiana currentStationId bez zmiany URL pochodzi z natywnego playera.
    // Kolejny efekt zsynchronizuje adres; nie wolno tutaj odtwarzać starej stacji.
    if (isTauriAndroid() && !routeChanged) return;

    pendingRouteStationIdRef.current = routeStation.id;
    playStation(routeStation);
  }, [routeStation?.id, currentStationId, isPlaying, playStation, isStationPage, routeStation]);

  // Na Androidzie przyciski powiadomienia i Android Auto zmieniają stację
  // bezpośrednio w natywnym odtwarzaczu. URL musi wtedy podążyć za playerem,
  // zamiast ponownie uruchamiać stację wskazaną przez poprzedni adres.
  useEffect(() => {
    if (!isTauriAndroid() || !isStationPage || currentStationId === null) return;
    if (pendingRouteStationIdRef.current !== null) return;
    if (routeStation?.id === currentStationId) return;

    const nativeStation = stations.find((station) => station.id === currentStationId);
    if (nativeStation) {
      navigate(getStationPath(nativeStation.shortName), { replace: true });
    }
  }, [currentStationId, isStationPage, navigate, routeStation?.id, stations]);

  // Update page title when station changes
  useEffect(() => {
    document.title = routeStation
      ? `${routeStation.name} - Radyjko`
      : 'Radyjko - Polskie radio online';
  }, [routeStation]);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    return (
      target.isContentEditable ||
      target.closest('[contenteditable="true"]') !== null ||
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
    );
   }, []);

   const getPrevNextStation = useCallback((direction: 'prev' | 'next') => {
     const orderedList = getOrderedStations(stations, favorites, searchQuery);
     const currentIndex = orderedList.findIndex((s) => s.id === currentStationId);
     if (currentIndex === -1) return undefined;

     const nextIndex = direction === 'next'
       ? (currentIndex + 1) % orderedList.length
       : (currentIndex - 1 + orderedList.length) % orderedList.length;

     return orderedList[nextIndex];
   }, [stations, currentStationId, favorites, searchQuery]);

    const handleNextStation = useCallback(() => {
      const nextStation = getPrevNextStation('next');
      if (nextStation) {
       navigate(getStationPath(nextStation.shortName), { replace: isStationPage });
      }
    }, [getPrevNextStation, isStationPage, navigate]);

   const handlePrevStation = useCallback(() => {
      const prevStation = getPrevNextStation('prev');
      if (prevStation) {
       navigate(getStationPath(prevStation.shortName), { replace: isStationPage });
      }
    }, [getPrevNextStation, isStationPage, navigate]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

   const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
     if (!isStationPage || stations.length === 0) return;

     const start = touchStartRef.current;
     const touch = event.changedTouches[0];
     touchStartRef.current = null;
     if (!start || !touch) return;

     const deltaX = touch.clientX - start.x;
     const deltaY = Math.abs(touch.clientY - start.y);

     if (Math.abs(deltaX) < 50 || deltaY > 50) return;

     // Use the same logic as keyboard shortcuts
     // Swipe left (deltaX < 0) -> next station
     // Swipe right (deltaX > 0) -> previous station
     if (deltaX < 0) {
       handleNextStation();
     } else {
       handlePrevStation();
     }
   };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      switch (event.code) {
        case 'Space':
        case 'KeyK':
          event.preventDefault();
          playerState.togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlePrevStation();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNextStation();
          break;
        case 'ArrowUp':
          event.preventDefault();
          playerState.setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          event.preventDefault();
          playerState.setVolume(Math.max(0, volume - 0.05));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStation, handlePrevStation, isEditableTarget, playerState, volume]);

  const desktopSidebarSkeleton = (
    <aside className="hidden w-72 flex-col border-r border-neutral-800 bg-neutral-900 md:flex animate-pulse">
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-neutral-800" />
          <div className="h-5 w-24 rounded bg-neutral-800" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl px-4 py-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-neutral-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-neutral-800" />
                <div className="h-2 w-1/2 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );

  const desktopPlayerSkeleton = (
    <div className="hidden md:flex h-24 border-t border-neutral-800 bg-neutral-900 px-4 md:px-6 items-center justify-between animate-pulse">
      <div className="flex items-center gap-4 w-1/3 min-w-0">
        <div className="h-14 w-14 rounded-md bg-neutral-800" />
        <div className="min-w-0 space-y-2">
          <div className="h-4 w-40 rounded bg-neutral-800" />
          <div className="h-3 w-28 rounded bg-neutral-800" />
        </div>
      </div>

      <div className="flex w-1/3 items-center justify-center gap-4">
        <div className="h-5 w-5 rounded-full bg-neutral-800" />
        <div className="h-10 w-10 rounded-full bg-neutral-800" />
        <div className="h-5 w-5 rounded-full bg-neutral-800" />
      </div>

      <div className="flex w-1/3 items-center justify-end">
        <div className="h-5 w-40 rounded bg-neutral-800" />
      </div>
    </div>
  );

  const mobilePlayerSkeleton = (
    <div className="md:hidden border-t border-neutral-800 bg-neutral-900 px-4 py-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-neutral-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-neutral-800" />
          <div className="h-2 w-1/2 rounded bg-neutral-800" />
        </div>
        <div className="h-9 w-9 rounded-full bg-neutral-800" />
      </div>
    </div>
  );

  const homeLoadingSkeleton = (
    <>
      <DesktopTitlebar />
      <DesktopResizeHandles />
      <div className={`bg-neutral-950 text-white ${appHeightClass} flex overflow-hidden`}>
      {desktopSidebarSkeleton}

      <div className="flex flex-1 flex-col">
        <div className="md:hidden border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-neutral-800" />
              <div className="h-4 w-20 rounded bg-neutral-800" />
            </div>
            <div className="h-9 w-9 rounded-lg bg-neutral-800" />
          </div>
        </div>

        <main className="flex-1 overflow-hidden bg-linear-to-b from-neutral-900 to-neutral-950 p-6 md:p-10">
          <div className="animate-pulse space-y-10">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="h-10 w-3/5 mx-auto rounded bg-neutral-800" />
              <div className="h-5 w-full rounded bg-neutral-800" />
              <div className="h-5 w-4/5 mx-auto rounded bg-neutral-800" />
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-7 w-48 rounded bg-neutral-800" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-3">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-neutral-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 rounded bg-neutral-800" />
                        <div className="h-2 w-1/2 rounded bg-neutral-800" />
                      </div>
                      <div className="h-8 w-8 rounded-full bg-neutral-800" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-7 w-52 rounded bg-neutral-800" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-3">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-neutral-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 rounded bg-neutral-800" />
                        <div className="h-2 w-1/2 rounded bg-neutral-800" />
                      </div>
                      <div className="h-8 w-8 rounded-full bg-neutral-800" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>

        {desktopPlayerSkeleton}
        {mobilePlayerSkeleton}
      </div>
      </div>
    </>
  );

  const stationLoadingSkeleton = (
    <>
      <DesktopTitlebar />
      <DesktopResizeHandles />
      <div className={`bg-neutral-950 text-white ${appHeightClass} flex overflow-hidden`}>
      {desktopSidebarSkeleton}

      <div className="flex flex-1 flex-col">
        <div className="md:hidden border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-neutral-800" />
              <div className="h-4 w-20 rounded bg-neutral-800" />
            </div>
            <div className="h-9 w-9 rounded-lg bg-neutral-800" />
          </div>
        </div>

        <main className="flex-1 overflow-hidden bg-linear-to-b from-neutral-900 to-neutral-950 p-6 md:p-10">
          <div className="animate-pulse grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col lg:flex-row gap-8 items-end">
                <div className="w-64 h-64 rounded-2xl bg-neutral-800 shadow-2xl" />
                <div className="flex-1 w-full space-y-4">
                  <div className="h-12 w-3/4 rounded bg-neutral-800" />
                  <div className="h-4 w-40 rounded bg-neutral-800" />
                  <div className="space-y-2">
                    <div className="h-6 w-2/3 rounded bg-neutral-800" />
                    <div className="h-5 w-1/2 rounded bg-neutral-800" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-12 w-36 rounded-full bg-neutral-800" />
                    <div className="h-12 w-12 rounded-full bg-neutral-800" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="h-6 w-48 rounded bg-neutral-800" />
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4 rounded-xl p-3">
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-neutral-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 rounded bg-neutral-800" />
                        <div className="h-2 w-1/2 rounded bg-neutral-800" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:h-full">
              <div className="h-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex flex-col">
                <div className="h-4 w-24 rounded bg-neutral-800" />
                <div className="mt-4 space-y-3">
                  <div className="h-3 w-full rounded bg-neutral-800" />
                  <div className="h-3 w-5/6 rounded bg-neutral-800" />
                  <div className="h-3 w-2/3 rounded bg-neutral-800" />
                  <div className="h-3 w-4/5 rounded bg-neutral-800" />
                </div>

                <div className="mt-auto pt-6 border-t border-neutral-800">
                  <div className="h-4 w-20 rounded bg-neutral-800" />
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="h-14 rounded-xl bg-neutral-800" />
                    <div className="h-14 rounded-xl bg-neutral-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {desktopPlayerSkeleton}
        {mobilePlayerSkeleton}
      </div>
      </div>
    </>
  );

  if (stationsLoading) {
    return isStationPage ? stationLoadingSkeleton : homeLoadingSkeleton;
  }

  return (
    <>
      <DesktopTitlebar />
      <DesktopResizeHandles />
      <ServiceWorkerRegistration />
      <div className={`bg-neutral-950 text-white ${appHeightClass} flex overflow-hidden`}>
        <Sidebar />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MobileMenu />
          <main
            className="relative flex-1 min-h-0 overflow-y-auto bg-linear-to-b from-neutral-900 to-neutral-950 p-6 pb-36 md:p-10"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {isStationPage ? (
              routeStation ? (
                <StationViewWrapper
                  station={routeStation}
                  isFavorite={isFavorite(routeStation.id)}
                  isPlaying={currentStationId === routeStation.id && isPlaying}
                  currentTrack={nowPlaying[routeStation.id] || null}
                  onFavoriteToggle={() => toggleFavorite(routeStation.id)}
                  audioError={audioError}
                  onClearError={clearError}
                  onPlayPause={() => {
                    if (currentStationId === routeStation.id) {
                      if (isPlaying) pause();
                      else togglePlay();
                    } else {
                      playStation(routeStation);
                    }
                  }}
                />
              ) : (
                <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
                  <h1 className="text-3xl font-bold">Nie znaleziono stacji</h1>
                  <p className="text-neutral-400">Sprawdź adres lub wróć do listy dostępnych stacji.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="rounded-full bg-white px-5 py-2 font-semibold text-black transition hover:bg-neutral-200"
                  >
                    Wróć na stronę główną
                  </button>
                </div>
              )
            ) : (
              children
            )}
          </main>
        </div>

         <PlayerBar
           isPlaying={isPlaying}
           currentTrack={currentTrack}
           currentStation={currentStation}
           onPlayPause={playerState.togglePlay}
           onNext={handleNextStation}
           onPrev={handlePrevStation}
           volume={volume}
           onVolumeChange={playerState.setVolume}
         />
      </div>
    </>
  );
}

export const AppShell = memo(AppShellContent);
