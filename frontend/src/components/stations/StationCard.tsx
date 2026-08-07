import { Link } from 'react-router-dom';
import { Heart, Play } from 'lucide-react';
import type { Station, SongInfo } from '@/lib/types';
import { getIconPath } from '@/contexts/AppContext';
import { getStationPath } from '@/lib/clientRoutes';

interface StationCardProps {
  station: Station;
  isFavorite?: boolean;
  isPlaying?: boolean;
  nowPlaying?: SongInfo | null;
  onFavoriteClick?: (stationId: number) => void;
  onPlayClick?: (station: Station) => void;
}

function getStationColor(shortName: string): string {
  if (shortName.includes('rmf')) return 'bg-yellow-400';
  if (shortName.includes('radio-zet') || shortName.includes('radiozet')) return 'bg-red-600';
  if (shortName.includes('antyradio')) return 'bg-neutral-800';
  if (shortName.includes('eska')) return 'bg-green-600';
  if (shortName.includes('voxfm')) return 'bg-purple-600';
  if (shortName.includes('openfm')) return 'bg-blue-500';
  if (shortName.includes('rp-')) return 'bg-orange-500';
  if (shortName.includes('meloradio')) return 'bg-amber-500';
  if (shortName.includes('krzakfm')) return 'bg-emerald-600';
  return 'bg-neutral-700';
}

export function StationCard({
  station,
  isFavorite = false,
  nowPlaying,
  onFavoriteClick,
  onPlayClick,
}: StationCardProps) {
  const color = getStationColor(station.shortName);
  const initials = station.name.substring(0, 3).toUpperCase();

  const displayArtist = nowPlaying?.artist || station.genre || '';

  return (
    <Link to={getStationPath(station.shortName)}>
      <div className="group cursor-pointer bg-neutral-900/50 hover:bg-neutral-800/70 rounded-2xl p-4 border border-neutral-800/50 hover:border-neutral-700 transition-all">
        <div className="relative mb-4">
          <div
            className={`w-full aspect-square rounded-xl ${color} flex items-center justify-center overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow relative`}
          >
            <img
              src={getIconPath(station.shortName)}
              alt={station.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="w-full h-full items-center justify-center text-2xl font-bold text-white/80 hidden"
            >
              {initials}
            </div>

            {onFavoriteClick && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFavoriteClick(station.id);
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <Heart
                  className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`}
                />
              </button>
            )}

            {onPlayClick && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPlayClick(station);
                }}
                className="absolute bottom-2 right-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-400">
                  <Play className="w-5 h-5 text-black ml-0.5 fill-black" />
                </div>
              </button>
            )}
          </div>
        </div>

        <h3 className="font-bold text-sm truncate text-white group-hover:text-green-400 transition-colors">
          {station.name}
        </h3>
        <p className="text-xs text-neutral-500 truncate group-hover:text-neutral-400">
          {displayArtist}
        </p>
      </div>
    </Link>
  );
}
