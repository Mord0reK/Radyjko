import { Heart, TrendingUp } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { StationListItem } from '@/components/stations/StationListItem';

export function HomeView() {
  const {
    stations,
    favorites,
    nowPlaying,
    toggleFavorite,
    playStation,
    currentStationId,
    isPlaying,
  } = useApp();

  const favoriteStations = stations.filter((s) => favorites.includes(s.id));
  const popularStations = stations.filter((s) => !favorites.includes(s.id)).slice(0, 8);

  return (
    <div className="fade-in">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          Witaj w Radyjku!
        </h1>
      </div>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="text-red-500 w-6 h-6" />
            Ulubione stacje
          </h2>
        </div>

        {favoriteStations.length === 0 ? (
          <div className="text-center py-12 bg-neutral-900/50 rounded-2xl border border-neutral-800/50">
            <Heart className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400">Nie masz jeszcze ulubionych stacji.</p>
            <p className="text-neutral-500 text-sm mt-2">
              Kliknij ikonę serca przy stacji, aby dodać ją do ulubionych.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {favoriteStations.map((station) => (
              <StationListItem
                key={station.id}
                station={station}
                isFavorite
                isPlaying={currentStationId === station.id && isPlaying}
                nowPlaying={nowPlaying[station.id] || null}
                onFavoriteClick={toggleFavorite}
                onPlayClick={playStation}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="text-green-500 w-6 h-6" />
            Popularne stacje
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {popularStations.map((station) => (
            <StationListItem
              key={station.id}
              station={station}
              isFavorite={favorites.includes(station.id)}
              isPlaying={currentStationId === station.id && isPlaying}
              nowPlaying={nowPlaying[station.id] || null}
              onFavoriteClick={toggleFavorite}
              onPlayClick={playStation}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
