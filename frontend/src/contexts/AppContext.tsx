import React, { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Station, SongInfo } from '@/lib/types';
import { usePlayer } from './PlayerContext';
import { useStations } from './StationsContext';
import { useFavorites } from './FavoritesContext';
import { getOrderedStations, getIconPath, getStationGroup } from './StationsContext';
import { getStationPath } from '@/lib/clientRoutes';
import { getStreamUrl, getPublicAssetUrl } from '@/lib/apiUrls';
import { clearDiscordPresence, createDiscordPresence, setDiscordPresence } from '@/lib/desktop/discordPresence';
import { syncAndroidAutoStations, updateAndroidAuto, updateMediaSession, clearMediaSession } from '@/lib/mediaSession';
import { isTauriAndroid } from '@/lib/platform';

// Re-export utility functions for backward compatibility
export { getIconPath, getStationGroup, getOrderedStations };

async function fetchOpenFMStreamUrl(stationId: number): Promise<string | null> {
  try {
    const response = await fetch(`https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM${stationId}/ngrp:standard/playlist.m3u8`, { cache: 'no-store' });
    const data = (await response.json()) as { url?: string };
    return data.url || null;
  } catch {
    return null;
  }
}

interface PlayStationState {
  playStation: (station: Station) => void;
  previousStation: () => void;
  nextStation: () => void;
}

function usePlayStationLogic(
  stations: Station[],
  favorites: number[],
  searchQuery: string,
  playerState: ReturnType<typeof usePlayer>,
  nowPlaying: Record<number, SongInfo>
): PlayStationState {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { play } = playerState;
  const { isPlaying: playerIsPlaying, togglePlay: togglePlayerPlay } = playerState;
  const streamUrlsRef = React.useRef<Record<number, string>>({});
  const lastStationRef = React.useRef<Station | null>(null);
  const streamRequestIdRef = React.useRef(0);
  const lastDiscordPresenceRef = React.useRef<string | null>(null);

  const setStreamUrl = useCallback((id: number, url: string) => {
    streamUrlsRef.current[id] = url;
  }, []);

  const playStation = useCallback((station: Station) => {
    const requestId = ++streamRequestIdRef.current;

    if (isTauriAndroid()) {
      play('', station.id);
      return;
    }

    const existing = streamUrlsRef.current[station.id];
    if (existing) { play(existing, station.id); return; }

    if (station.isOpenFM && station.openFmId) {
      fetchOpenFMStreamUrl(station.openFmId).then((url) => {
        if (requestId !== streamRequestIdRef.current) return;
        if (url) { setStreamUrl(station.id, url); play(url, station.id); }
      });
    } else if (station.url) {
      const streamUrl = station.needsProxy
        ? getStreamUrl(station.shortName)
        : station.url;
      play(streamUrl, station.id, station.url.toLowerCase().includes('.m3u8'));
    }
  }, [play, setStreamUrl]);

  const getNextStation = useCallback((
    direction: 'prev' | 'next',
  ): Station | undefined => {
    if (stations.length === 0 || playerState.currentStationId === null) return undefined;

    const orderedList = getOrderedStations(stations, favorites, searchQuery);
    const currentIndex = orderedList.findIndex((station) => station.id === playerState.currentStationId);
    if (currentIndex === -1) return undefined;

    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % orderedList.length
      : (currentIndex - 1 + orderedList.length) % orderedList.length;

    return orderedList[nextIndex];
  }, [stations, playerState.currentStationId, favorites, searchQuery]);

  const previousStation = useCallback(() => {
    const prev = getNextStation('prev');
    if (prev) {
      navigate(getStationPath(prev.shortName), { replace: pathname !== '/' });
      playStation(prev);
    }
  }, [getNextStation, navigate, pathname, playStation]);

  const nextStation = useCallback(() => {
    const next = getNextStation('next');
    if (next) {
      navigate(getStationPath(next.shortName), { replace: pathname !== '/' });
      playStation(next);
    }
  }, [getNextStation, navigate, pathname, playStation]);

  useEffect(() => {
    if (!isTauriAndroid() || stations.length === 0) return;
    void syncAndroidAutoStations(stations.map((station) => ({
      id: station.id,
      name: station.name,
      artworkUrl: getPublicAssetUrl(getIconPath(station.shortName)),
      url: station.url,
      shortName: station.shortName,
      needsProxy: Boolean(station.needsProxy),
      isOpenFM: Boolean(station.isOpenFM),
      openFmId: station.openFmId,
    })));
  }, [stations]);

// Setup Web MediaSession controls. Android uses the single native listener above.
useEffect(() => {
    const handlePreviousTrack = () => {
      const prev = getNextStation('prev');
      if (prev) navigate(getStationPath(prev.shortName), { replace: pathname !== '/' });
    };

    const handleNextTrack = () => {
      const next = getNextStation('next');
      if (next) navigate(getStationPath(next.shortName), { replace: pathname !== '/' });
    };

    if (isTauriAndroid()) return;

    // Desktop/Web: use Web MediaSession API
    if (!('mediaSession' in navigator)) return;

    const mediaSession = navigator.mediaSession;

    mediaSession.setActionHandler('play', () => {
      if (!playerIsPlaying) togglePlayerPlay();
    });
    mediaSession.setActionHandler('pause', () => {
      if (playerIsPlaying) togglePlayerPlay();
    });
    mediaSession.setActionHandler('previoustrack', handlePreviousTrack);
    mediaSession.setActionHandler('nexttrack', handleNextTrack);

    return () => {
      mediaSession.setActionHandler('play', null);
      mediaSession.setActionHandler('pause', null);
      mediaSession.setActionHandler('previoustrack', null);
      mediaSession.setActionHandler('nexttrack', null);
    };
  }, [getNextStation, navigate, pathname, playerIsPlaying, togglePlayerPlay]);

  // Update media session metadata when station changes
  // Android: native plugin notification; Desktop/Web: Web MediaSession API
  useEffect(() => {
    const currentStation = stations.find((s) => s.id === playerState.currentStationId);

    // Keep reference to last known station
    if (currentStation) {
      lastStationRef.current = currentStation;
    }

    const stationToUse = currentStation || lastStationRef.current;

    if (!stationToUse) {
      if (isTauriAndroid()) {
        void clearMediaSession();
      } else if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
      return;
    }

    const iconPath = getIconPath(stationToUse.shortName);
    const artworkUrl = getPublicAssetUrl(iconPath);
    const songInfo = nowPlaying[stationToUse.id];

    if (isTauriAndroid()) {
      // Android: native notification with absolute artwork URL
      void updateMediaSession({
        title: songInfo?.title || stationToUse.name,
        artist: songInfo?.artist || '',
        album: stationToUse.name,
        artworkUrl,
         isPlaying: playerState.isPlaying,
         stationId: stationToUse.id,
        canPrev: true,
        canNext: true,
      });
      void updateAndroidAuto({
        title: songInfo?.title || stationToUse.name,
        artist: songInfo?.artist || '',
        album: stationToUse.name,
        artworkUrl,
         isPlaying: playerState.isPlaying,
         stationId: stationToUse.id,
      });
      return;
    }

    // Desktop/Web: Web MediaSession API
    if (!('mediaSession' in navigator)) return;

    const mediaSession = navigator.mediaSession;
    const mimeType = iconPath?.endsWith('.png') ? 'image/png' : 'image/webp';

    mediaSession.metadata = new MediaMetadata({
      title: songInfo?.title || stationToUse.name,
      artist: songInfo?.artist || '',
      album: stationToUse.name,
      artwork: [{ src: artworkUrl, type: mimeType }],
    });

    mediaSession.playbackState = playerState.isPlaying ? 'playing' : 'paused';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.currentStationId, playerState.isPlaying]);

  // Update title/artist when track changes (without re-setting artwork)
  useEffect(() => {
    const currentStation = stations.find((s) => s.id === playerState.currentStationId);
    const stationToUse = currentStation || lastStationRef.current;

    if (!stationToUse) return;

    const songInfo = nowPlaying[stationToUse.id];
    const newTitle = songInfo?.title || stationToUse.name;
    const newArtist = songInfo?.artist || '';

    if (isTauriAndroid()) {
      // Android: merge update (only send changed fields)
      void updateMediaSession({ title: newTitle, artist: newArtist });
      void updateAndroidAuto({ title: newTitle, artist: newArtist });
      return;
    }

    // Desktop/Web: Web MediaSession API
    if (!('mediaSession' in navigator)) return;

    const mediaSession = navigator.mediaSession;
    if (!mediaSession.metadata) return;

    const currentTitle = mediaSession.metadata.title;
    const currentArtist = mediaSession.metadata.artist;

    if (currentTitle !== newTitle || currentArtist !== newArtist) {
      const existingArtwork = mediaSession.metadata.artwork;
      mediaSession.metadata = new MediaMetadata({
        title: newTitle,
        artist: newArtist,
        album: stationToUse.name,
        artwork: existingArtwork && existingArtwork.length > 0 
          ? Array.from(existingArtwork)
          : [{ src: getPublicAssetUrl(getIconPath(stationToUse.shortName)), 
               type: getIconPath(stationToUse.shortName).endsWith('.png') ? 'image/png' : 'image/webp' }],
      });
    }
  }, [nowPlaying, playerState.currentStationId, stations]);

  useEffect(() => {
    const currentStation = stations.find((station) => station.id === playerState.currentStationId);
    if (!playerState.isPlaying || !currentStation) {
      if (lastDiscordPresenceRef.current) {
        lastDiscordPresenceRef.current = null;
        void clearDiscordPresence().catch((error) => {
          console.debug('Discord Rich Presence cleanup failed:', error);
        });
      }
      return;
    }

    const presence = createDiscordPresence(currentStation, nowPlaying[currentStation.id]);
    const serializedPresence = JSON.stringify(presence);
    if (serializedPresence === lastDiscordPresenceRef.current) return;

    lastDiscordPresenceRef.current = serializedPresence;
    void setDiscordPresence(presence).catch((error) => {
      console.debug('Discord Rich Presence update failed:', error);
    });
  }, [nowPlaying, playerState.currentStationId, playerState.isPlaying, stations]);

  return { playStation, previousStation, nextStation };
}

interface AppContextType {
  playStation: (station: Station) => void;
  previousStation: () => void;
  nextStation: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppActions(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppActions must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const playerState = usePlayer();
  const stationsState = useStations();
  const favoritesState = useFavorites();

  const playStationLogic = usePlayStationLogic(
    stationsState.stations,
    favoritesState.favorites,
    stationsState.searchQuery,
    playerState,
    stationsState.nowPlaying
  );

  const value: AppContextType = {
    playStation: playStationLogic.playStation,
    previousStation: playStationLogic.previousStation,
    nextStation: playStationLogic.nextStation,
    audioRef: playerState.audioRef,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Combine all hooks for convenience
export function useApp() {
  const playerState = usePlayer();
  const stationsState = useStations();
  const favoritesState = useFavorites();
  const appActions = useAppActions();

  return {
    // Player state
    isPlaying: playerState.isPlaying,
    volume: playerState.volume,
    currentStationId: playerState.currentStationId,
    audioError: playerState.audioError,
    play: playerState.play,
    pause: playerState.pause,
    togglePlay: playerState.togglePlay,
    setVolume: playerState.setVolume,
    clearError: playerState.clearError,
    audioRef: playerState.audioRef,
    
    // Stations state
    stations: stationsState.stations,
    stationsLoading: stationsState.stationsLoading,
    nowPlaying: stationsState.nowPlaying,
    nowPlayingLoading: stationsState.nowPlayingLoading,
    searchQuery: stationsState.searchQuery,
    setSearchQuery: stationsState.setSearchQuery,
    
    // Favorites state
    favorites: favoritesState.favorites,
    toggleFavorite: favoritesState.toggleFavorite,
    isFavorite: favoritesState.isFavorite,
    
    // Actions
    playStation: appActions.playStation,
    previousStation: appActions.previousStation,
    nextStation: appActions.nextStation,
  };
}
