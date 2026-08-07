import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Heart, TriangleAlert } from 'lucide-react';
import { useApp, getStationGroup, getIconPath } from '@/contexts/AppContext';
import type { Station } from '@/lib/types';
import { getStationPath } from '@/lib/clientRoutes';
import { DownloadMenu } from '@/components/common/DownloadSection';

interface MobileStationItemProps {
  station: Station;
  isActive: boolean;
  isFav: boolean;
  isPlaying: boolean;
  nowPlayingText: string;
  onSelect: () => void;
}

function MobileStationItem({ station, isActive, isFav, isPlaying, nowPlayingText, onSelect }: MobileStationItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 text-left group cursor-pointer ${
        isActive
          ? 'bg-neutral-800 text-white shadow-lg'
          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
      }`}
    >
      <div className={`relative w-10 h-10 shrink-0 rounded-lg overflow-hidden ${station.Jakosc?.includes('hd') ? 'bg-purple-600' : 'bg-neutral-700'}`}>
        <img src={getIconPath(station.shortName)} alt={station.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      </div>

      <div className="overflow-hidden flex-1">
        <div className="font-medium truncate text-sm flex items-center gap-1.5">
          <span className="truncate">{station.name}</span>
          {station.isExplicit && (
            <TriangleAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Stacja może zawierać treści nieprzyzwoite" />
          )}
        </div>
        <div className="text-xs text-neutral-500 truncate group-hover:text-neutral-400">
          {nowPlayingText}
        </div>
      </div>

      {isFav && <Heart className="w-3 h-3 text-red-400 fill-red-400 shrink-0 ml-auto" />}

      {isActive && isPlaying && (
        <div className="flex items-end gap-1 h-4 animate-eq ml-auto">
          <div className="w-1 bg-green-500 rounded-t-sm eq-bar h-1/2" />
          <div className="w-1 bg-green-500 rounded-t-sm eq-bar h-3/4" />
          <div className="w-1 bg-green-500 rounded-t-sm eq-bar h-1/3" />
          <div className="w-1 bg-green-500 rounded-t-sm eq-bar h-full" />
        </div>
      )}
    </button>
  );
}

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { stations, currentStationId, isPlaying, favorites, nowPlaying, searchQuery } = useApp();

  useEffect(() => {
    const closeTimer = window.setTimeout(() => {
      setIsOpen(false);
    }, 0);

    return () => window.clearTimeout(closeTimer);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);
  const handleToggle = () => setIsOpen((prev) => !prev);
  const handleStationSelect = (station: Station) => {
    setIsOpen(false);
    navigate(getStationPath(station.shortName), { replace: pathname !== '/' });
  };

  const filteredStations = stations.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.shortName.toLowerCase().includes(q) ||
      (s.Opis?.toLowerCase().includes(q) ?? false)
    );
  });

  const favoriteStations = filteredStations.filter((s) => favorites.includes(s.id));
  const nonFavoriteStations = filteredStations.filter((s) => !favorites.includes(s.id));

  const groups: Record<string, Station[]> = {};
  nonFavoriteStations.forEach((s) => {
    const group = getStationGroup(s);
    if (!groups[group]) groups[group] = [];
    groups[group].push(s);
  });

  const getNowPlayingText = (station: Station) => {
    const np = nowPlaying[station.id];
    if (np?.title && np.title !== 'Brak Informacji') {
      return np.artist ? `${np.title} - ${np.artist}` : np.title;
    }
    return station.genre || '';
  };

  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 z-20" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <Link to="/" onClick={handleClose} className="font-bold flex items-center gap-2 cursor-pointer">
          <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-md">
            <img src="/ikony/icon.png" alt="Logo" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
          </div>
          Radyjko
        </Link>

        <button
          onClick={handleToggle}
          className="p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Zamknij menu' : 'Otwórz menu'}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 flex items-end ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

        <div
          className={`relative w-full max-h-[75vh] bg-neutral-900 border-t border-neutral-800 rounded-t-2xl flex flex-col transform transition-transform duration-300 ease-out ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
            <h2 className="font-bold text-lg">Stacje radiowe</h2>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-neutral-800 transition-colors" aria-label="Zamknij menu">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="shrink-0 border-b border-neutral-800">
            <DownloadMenu onOpen={handleClose} />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-8 scrollbar-hide" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
            {favoriteStations.length > 0 && (
              <>
                <h3 className="px-4 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 mt-4 flex items-center gap-2">
                  <Heart className="w-3 h-3 fill-red-400" /> Ulubione
                </h3>
                {favoriteStations.map((station) => (
                  <MobileStationItem
                    key={station.id}
                    station={station}
                    isActive={station.id === currentStationId}
                    isFav
                    isPlaying={isPlaying}
                    nowPlayingText={getNowPlayingText(station)}
                    onSelect={() => handleStationSelect(station)}
                  />
                ))}
              </>
            )}

            {Object.entries(groups).map(([groupName, groupStations]) => (
              <div key={groupName}>
                <h3 className="px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 mt-4">
                  {groupName}
                </h3>
                {groupStations.map((station) => (
                  <MobileStationItem
                    key={station.id}
                    station={station}
                    isActive={station.id === currentStationId}
                    isFav={favorites.includes(station.id)}
                    isPlaying={isPlaying}
                    nowPlayingText={getNowPlayingText(station)}
                    onSelect={() => handleStationSelect(station)}
                  />
                ))}
              </div>
            ))}

            {filteredStations.length === 0 && <p className="text-center py-8 text-neutral-500 text-sm">Brak stacji</p>}
          </div>
        </div>
      </div>
    </>
  );
}
