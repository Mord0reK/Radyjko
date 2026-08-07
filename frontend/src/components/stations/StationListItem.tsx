import { Link } from 'react-router-dom';
import { Heart, Play } from 'lucide-react';
import type { Station, SongInfo } from '@/lib/types';
import { getIconPath } from '@/contexts/AppContext';
import { getStationPath } from '@/lib/clientRoutes';

interface StationListItemProps {
  station: Station;
  isFavorite?: boolean;
  isPlaying?: boolean;
  nowPlaying?: SongInfo | null;
  onFavoriteClick?: (stationId: number) => void;
  onPlayClick?: (station: Station) => void;
}

export function StationListItem({
  station,
  isFavorite = false,
  isPlaying = false,
  nowPlaying,
  onFavoriteClick,
  onPlayClick,
}: StationListItemProps) {
  const displayArtist = nowPlaying?.artist || station.genre || 'Radio';
  const displayTitle = nowPlaying?.title || '';

  return (
    <div className="group relative flex items-center gap-4 p-3 bg-neutral-900/40 hover:bg-neutral-800/60 rounded-xl border border-neutral-800/50 hover:border-neutral-700 transition-all">
      <Link 
        to={getStationPath(station.shortName)}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Przejdź do stacji ${station.name}`}
      />
      
      <div className="relative z-10 shrink-0">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-md">
          <img
            src={getIconPath(station.shortName)}
            alt={station.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
              <div className="flex gap-0.5 items-end h-3">
                <div className="w-0.5 bg-green-500 animate-[music-bar_0.6s_ease-in-out_infinite]" />
                <div className="w-0.5 bg-green-500 animate-[music-bar_0.9s_ease-in-out_infinite]" />
                <div className="w-0.5 bg-green-500 animate-[music-bar_0.7s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 min-w-0 pointer-events-none">
        <div className="flex flex-col">
          <h3 className="font-bold text-sm text-white truncate group-hover:text-green-400 transition-colors">
            {station.name}
          </h3>
          <p className="text-xs text-neutral-500 truncate">
            <span className="text-neutral-300">{displayArtist}</span>
            {displayTitle && <span className="mx-1">•</span>}
            {displayTitle}
          </p>
        </div>
      </div>

      <div className="relative z20 flex items-center gap-2">
        {onFavoriteClick && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFavoriteClick(station.id);
            }}
            className={`p-2.5 rounded-full transition-all md:opacity-0 md:group-hover:opacity-100 ${
              isFavorite
                  ? 'border-red-500 bg-red-500/20 text-red-500'
                  : 'border-neutral-600 hover:border-white text-white'
            }`}
            aria-label={isFavorite ? `Usuń ${station.name} z ulubionych` : `Dodaj ${station.name} do ulubionych`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {onPlayClick && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlayClick(station);
            }}
            className={`p-2.5 rounded-full transition-all hidden md:block ${
              isPlaying 
                ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                : 'bg-neutral-800 text-white hover:bg-green-500 hover:text-black md:opacity-0 md:group-hover:opacity-100'
            }`}
          >
            <Play className={`w-4 h-4 ${isPlaying ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}
