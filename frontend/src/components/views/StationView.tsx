import { Heart, Play, Pause, Music, Info, TriangleAlert, RotateCcw } from 'lucide-react';
import type { Station, SongInfo } from '@/lib/types';
import { getIconPath } from '@/contexts/AppContext';
import { SearchButtons } from '@/components/common/SearchButtons';
import { RadioPartyScheduleWidget } from '@/components/schedule/RadioPartyScheduleWidget';

interface StationViewProps {
  station: Station;
  isFavorite: boolean;
  isPlaying: boolean;
  currentTrack?: SongInfo | null;
  onFavoriteToggle: () => void;
  onPlayPause: () => void;
  audioError?: string | null;
  onClearError?: () => void;
}

function getStationColor(shortName: string): string {
  if (shortName.includes('rmf')) return 'bg-yellow-400';
  if (shortName.includes('radio-zet') || shortName.includes('radiozet')) return 'bg-red-600';
  if (shortName.includes('antyradio')) return 'bg-neutral-800';
  if (shortName.includes('eska')) return 'bg-green-600';
  if (shortName.includes('voxfm')) return 'bg-purple-600';
  if (shortName.includes('openfm')) return 'bg-blue-500';
  if (shortName.includes('radio-cmp')) return 'bg-orange-500';
  if (shortName.includes('rp-')) return 'bg-orange-500';
  if (shortName.includes('meloradio')) return 'bg-amber-500';
  if (shortName.includes('krzakfm')) return 'bg-emerald-600';
  return 'bg-neutral-700';
}

function getStationGroup(station: Station): string {
  if (station.shortName.includes('rmf')) return 'Grupa RMF';
  if (station.shortName.includes('radio-zet') || station.shortName.includes('radiozet') || station.shortName.includes('antyradio') || station.shortName.includes('meloradio')) return 'Eurozet';
  if (station.shortName.includes('eska')) return 'Eska';
  if (station.shortName.includes('voxfm')) return 'VoxFM';
  if (station.shortName.includes('openfm')) return 'OpenFM';
  if (station.shortName.includes('radio-cmp')) return 'Radio CMP';
  if (station.shortName.includes('rp-')) return 'RadioParty';
  return 'Inne';
}

function isSameTrack(a?: { title: string; artist: string }, b?: { title: string; artist: string }): boolean {
  if (!a || !b) return false;
  return a.title.trim().toLowerCase() === b.title.trim().toLowerCase()
    && a.artist.trim().toLowerCase() === b.artist.trim().toLowerCase();
}

function dedupeTracks(
  tracks: Array<{ title: string; artist: string }>,
  currentTrack?: { title?: string | null; artist?: string | null } | null,
): Array<{ title: string; artist: string }> {
  const current = currentTrack?.title && currentTrack?.artist
    ? { title: currentTrack.title, artist: currentTrack.artist }
    : null;

  return tracks.filter((track) => {
    if (!track.title && !track.artist) return false;
    if (!current) return true;
    return !isSameTrack(track, current);
  });
}

function isRadioCmpStation(station: Station): boolean {
  const shortName = station.shortName.toLowerCase();
  const name = station.name.toLowerCase();

  return shortName.includes('radio-cmp') || shortName.includes('cmp') || name.includes('cmp');
}

export function StationView({
  station,
  isFavorite,
  isPlaying,
  currentTrack,
  onFavoriteToggle,
  onPlayPause,
  audioError,
  onClearError,
}: StationViewProps) {
  const color = getStationColor(station.shortName);
  const songTitle = currentTrack?.title;
  const songArtist = currentTrack?.artist;
  const hasCurrentTrackInfo = station.shortName !== 'radio-cmp'
    || Boolean(currentTrack?.presenter || songTitle || songArtist);
  const nextTracks = dedupeTracks(currentTrack?.next || [], currentTrack);
  const previousTracks = dedupeTracks(currentTrack?.previous || [], currentTrack);
  const hasPlaylistData = nextTracks.length > 0 || previousTracks.length > 0;

  const isRadioParty = station.shortName === 'rp-kanalglowny';
  const isRadioCmp = isRadioCmpStation(station);
  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-8 items-start mb-12">
        <div
          className={`w-full lg:w-64 lg:h-64 aspect-square rounded-2xl shadow-2xl ${color} flex items-center justify-center relative overflow-hidden group transition-colors duration-500`}
        >
          <img
            src={getIconPath(station.shortName)}
            alt={station.name}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            onClick={onPlayPause}
          />
        </div>

        <div className="flex-1 w-full flex flex-col lg:h-64">
          <h1 className="text-3xl md:text-6xl font-black tracking-tight leading-none text-white">
            {station.name}
          </h1>

          <div className="mt-4 flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
            {hasCurrentTrackInfo && (
              <div className="min-h-[3.25rem] flex flex-col gap-1">
                <span className="text-xl text-white font-medium">
                  {songTitle || 'Brak informacji'}
                </span>
                <span className="text-md text-neutral-400">
                  {songArtist || ''}
                </span>
              </div>
            )}

{station.isExplicit && (
          <div className="inline-flex items-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 w-fit max-w-full self-start">
            <TriangleAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm md:text-base leading-snug">
              Ta stacja może zawierać treści nieprzyzwoite, niezalecane dla niepełnoletnich.
            </p>
          </div>
        )}
          </div>

          <div className="mt-4 flex gap-4 lg:mt-auto lg:shrink-0">
            <button
              onClick={() => {
                if (audioError && onClearError) {
                  onClearError();
                  onPlayPause();
                } else {
                  onPlayPause();
                }
              }}
              className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-colors transform active:scale-95 shadow-lg ${
                audioError
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                  : 'bg-green-500 hover:bg-green-400 text-black shadow-green-500/20'
              }`}
            >
              {audioError ? (
                <>
                  <RotateCcw className="w-5 h-5" />
                  <span>Retry</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pauza</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                  <span>Słuchaj teraz</span>
                </>
              )}
            </button>

            <button
              onClick={onFavoriteToggle}
              className={`border w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isFavorite
                  ? 'border-red-500 bg-red-500/20 text-red-500'
                  : 'border-neutral-600 hover:border-white text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Music className="text-green-500 w-6 h-6" />
              Ramówka / Playlista
            </h2>
          </div>

          <div className="bg-neutral-900/50 rounded-2xl border border-neutral-800/50 overflow-hidden">
            <div className="divide-y divide-neutral-800">
              {(isRadioParty || isRadioCmp) && (
                <RadioPartyScheduleWidget
                  station={station}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  color={color}
                  scheduleEndpoint={isRadioCmp ? '/schedule/radiocmp' : '/schedule/radioparty'}
                />
              )}

              {!isRadioParty && !isRadioCmp && (
                <>
                  {nextTracks.length > 0 && (
                    <div className="border-b border-neutral-800">
                      <div className="px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider bg-neutral-900/50">
                        Następne utwory
                      </div>
                      {nextTracks.slice(0, 3).reverse().map((track, idx) => (
                        <div key={`next-${idx}`} className="p-4 flex items-center gap-4 hover:bg-neutral-800/30 transition-colors group">
                          <div className="text-neutral-500 text-sm font-mono w-5 text-center group-hover:text-white transition-colors">
                            {nextTracks.slice(0, 3).length - idx}
                          </div>
                          <div className="w-10 h-10 rounded bg-neutral-800 shrink-0 flex items-center justify-center text-neutral-600 overflow-hidden">
                            <Music className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{track.title || 'Nieznany utwór'}</div>
                            <div className="text-sm text-neutral-500 truncate">{track.artist || 'Nieznany artysta'}</div>
                          </div>
                          <SearchButtons title={track.title} artist={track.artist} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-b border-neutral-800">
                    <div className="px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider bg-neutral-900/50">
                      Teraz grane
                    </div>
                      <div className="p-4 flex items-center gap-4 bg-green-900/20">
                        <div className="flex items-end gap-1 h-4 animate-eq ml-auto">
                          <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-1/2" />
                          <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-3/4" />
                          <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-1/2" />
                          <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-full" />
                        </div>
                        <div className={`w-10 h-10 rounded ${color} shrink-0 flex items-center justify-center text-white text-xs font-bold shadow overflow-hidden relative`}>
                          <img src={getIconPath(station.shortName)} className="absolute inset-0 h-full w-full object-cover" alt="" loading="lazy" decoding="async" />
                        </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-green-400 font-medium truncate">{songTitle || 'Brak Informacji'}</div>
                        <div className="text-sm text-neutral-400 truncate">{songArtist || station.name}</div>
                      </div>
                      {songTitle && songTitle !== 'Brak Informacji' && (
                        <SearchButtons title={songTitle} artist={songArtist} />
                      )}
                    </div>
                  </div>

                  {previousTracks.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider bg-neutral-900/50">
                        Poprzednie utwory
                      </div>
                      {previousTracks.slice(0, 3).map((track, idx) => (
                        <div key={`prev-${idx}`} className="p-4 flex items-center gap-4 hover:bg-neutral-800/30 transition-colors group">
                          <div className="text-neutral-500 text-sm font-mono w-12 text-center group-hover:text-white transition-colors">
                            {idx + 1}
                          </div>
                          <div className="w-10 h-10 rounded bg-neutral-800 shrink-0 flex items-center justify-center text-neutral-600 overflow-hidden">
                            <Music className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{track.title || 'Nieznany utwór'}</div>
                            <div className="text-sm text-neutral-500 truncate">{track.artist || 'Nieznany artysta'}</div>
                          </div>
                          <SearchButtons title={track.title} artist={track.artist} />
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasPlaylistData && !isRadioParty && !isRadioCmp && (
                    <div className="p-6 text-center text-neutral-500">
                      <Info className="w-8 h-8 mx-auto mb-3 text-neutral-600" />
                      <p className="font-medium text-neutral-400">Ta stacja nie udostępnia playlisty</p>
                      <p className="text-sm mt-1">Informacje o następnych i poprzednich utworach nie są dostępne</p>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 h-full">
            <h3 className="font-bold text-lg mb-4 text-neutral-200">O stacji</h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              {station.Opis || `Słuchaj ${station.name} online`}
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-neutral-800 pt-4">
              <div>
                <div className="text-xs uppercase text-neutral-500 font-semibold mb-1">Jakość</div>
                <div className="text-white text-sm">{station.Jakosc || '—'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-neutral-500 font-semibold mb-1">Gatunek</div>
                <div className="text-white text-sm">{station.genre || getStationGroup(station)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-32" />
    </div>
  );
}
