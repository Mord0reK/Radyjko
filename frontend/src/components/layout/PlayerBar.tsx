import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';
import type { SongInfo, Station } from '@/lib/types';
import { getIconPath } from '@/contexts/AppContext';

interface PlayerBarProps {
  isPlaying: boolean;
  currentTrack?: SongInfo | null;
  currentStation?: Station | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function PlayerBar({
  isPlaying,
  currentTrack,
  currentStation,
  onPlayPause,
  onNext,
  onPrev,
  volume,
  onVolumeChange,
}: PlayerBarProps) {
  if (!currentStation) return null;

  const trackTitle = currentTrack?.title || currentStation.name;
  const trackArtist = currentTrack?.artist || '';

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 z-40 shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* MOBILE VIEW: 2 rows */}
      <div className="md:hidden flex flex-col">
        {/* Row 1: Station & Track Info */}
        <div className="h-12 px-4 flex items-center gap-3 border-b border-neutral-800/50">
          <div className="relative w-10 h-10 rounded-md shrink-0 overflow-hidden bg-neutral-700 flex items-center justify-center">
            <img
              src={getIconPath(currentStation.shortName)}
              alt={currentStation.name}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-white font-medium truncate text-sm leading-tight">
              {trackTitle}
            </div>
            <div className="text-xs text-neutral-400 truncate">
              {trackArtist || currentStation.name}
            </div>
          </div>
        </div>

        {/* Row 2: Controls */}
        <div className="h-14 px-4 flex items-center justify-start gap-3">
          {/* Skip Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white active:scale-95 transition-all"
            title="Poprzednia stacja (ArrowLeft)"
            aria-label="Previous station"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-white/20"
            title="Odtwórz / Pauza (Space)"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-black fill-black" />
            ) : (
              <Play className="w-6 h-6 text-black ml-0.5 fill-black" />
            )}
          </button>

          {/* Skip Next */}
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white active:scale-95 transition-all"
            title="Następna stacja (ArrowRight)"
            aria-label="Next station"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          {/* Volume Control - Slider (expanded) */}
          <div className="flex-1 flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
            <VolumeX className="w-5 h-5 text-neutral-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <Volume2 className="w-5 h-5 text-neutral-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW: 1 row */}
      <div className="hidden md:flex h-24 items-center justify-between px-6 gap-4">
        {/* Left: Station & Track Info */}
        <div className="flex items-center gap-4 w-1/3 min-w-0 text-left">
          <div className={`relative w-14 h-14 rounded-md items-center justify-center shrink-0 overflow-hidden flex ${currentStation.Jakosc?.includes('hd') ? 'bg-purple-600' : 'bg-neutral-700'}`}>
            <img
              src={getIconPath(currentStation.shortName)}
              alt={currentStation.name}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-white font-medium truncate text-sm">
              {trackTitle}
            </div>
            <div className="text-xs text-neutral-400 truncate flex gap-1">
              {trackArtist && (
                <>
                  <span>{trackArtist}</span>
                  <span className="hidden">•</span>
                </>
              )}
              <span>{currentStation.name}</span>
            </div>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center justify-center w-1/3 gap-6">
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Poprzednia stacja (ArrowLeft)"
            aria-label="Previous station"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
            title="Odtwórz / Pauza (Space)"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-black fill-black" />
            ) : (
              <Play className="w-5 h-5 text-black ml-1 fill-black" />
            )}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Następna stacja (ArrowRight)"
            aria-label="Next station"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Control - Slider */}
        <div className="flex items-center justify-end w-1/3 gap-4">
          <div className="flex items-center gap-2 group w-64" onClick={(e) => e.stopPropagation()}>
            <Volume2 className="text-neutral-400 w-5 h-5" />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
