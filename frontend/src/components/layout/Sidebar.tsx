import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, TriangleAlert } from 'lucide-react';
import { useApp, getStationGroup, getIconPath } from '@/contexts/AppContext';
import type { Station } from '@/lib/types';
import { getStationPath } from '@/lib/clientRoutes';

interface StationItemProps {
  station: Station;
  isActive: boolean;
  isFav: boolean;
  isPlaying: boolean;
  nowPlayingText: string;
}

function StationItem({ station, isActive, isFav, isPlaying, nowPlayingText, onPlay }: StationItemProps & { onPlay: (station: Station) => void }) {
  return (
    <button
      onClick={() => onPlay(station)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 text-left group cursor-pointer ${
        isActive
          ? 'bg-neutral-800 text-white shadow-lg'
          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
      }`}
    >
      <div className={`relative w-10 h-10 shrink-0 rounded-lg overflow-hidden ${station.Jakosc?.includes('hd') ? 'bg-purple-600' : 'bg-neutral-700'}`}>
        <img
          src={getIconPath(station.shortName)}
          alt={station.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
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

      {isFav && (
        <Heart className="w-3 h-3 text-red-400 fill-red-400 shrink-0" />
      )}

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

export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    stations,
    currentStationId,
    isPlaying,
    favorites,
    isFavorite,
    nowPlaying,
    searchQuery,
  } = useApp();

  const handleStationSelect = (station: Station) => {
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
    <aside suppressHydrationWarning className="hidden w-72 flex-col border-r border-neutral-800 bg-neutral-900 md:flex">
      <Link to="/" className="p-6 border-b border-neutral-800 flex items-center gap-3 cursor-pointer hover:bg-neutral-800/50 transition-colors">
        <div className="relative h-6 w-6 shrink-0 overflow-hidden">
          <img src="/ikony/icon.png" alt="Logo" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Radyjko</h1>
      </Link>

      <div className="flex-1 overflow-y-auto px-2 pb-24 scrollbar-hide">
        {favoriteStations.length > 0 && (
          <>
            <h3 className="px-4 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 mt-4 flex items-center gap-2">
              <Heart className="w-3 h-3 fill-red-400" /> Ulubione
            </h3>
             {favoriteStations.map((station) => (
               <StationItem
                 key={station.id}
                 station={station}
                 isActive={station.id === currentStationId}
                 isFav
                 isPlaying={isPlaying}
                 nowPlayingText={getNowPlayingText(station)}
                 onPlay={handleStationSelect}
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
               <StationItem
                 key={station.id}
                 station={station}
                 isActive={station.id === currentStationId}
                 isFav={isFavorite(station.id)}
                 isPlaying={isPlaying}
                 nowPlayingText={getNowPlayingText(station)}
                 onPlay={handleStationSelect}
               />
             ))}
          </div>
        ))}

        {filteredStations.length === 0 && (
          <p className="text-center py-8 text-neutral-500 text-sm">
            Brak stacji spełniających kryteria
          </p>
        )}
      </div>
    </aside>
  );
}
