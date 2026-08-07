import { createContext, useContext, useCallback, useState, useEffect, useRef, type ReactNode } from 'react';
import { getReconnectDelay } from '@/lib/audio/reconnect';
import {
  getAndroidPlaybackState,
  onAndroidPlaybackState,
  pauseAndroidPlayback,
  playAndroidStation,
  resumeAndroidPlayback,
  setAndroidPlaybackVolume,
} from '@/lib/mediaSession';
import { isTauriAndroid } from '@/lib/platform';
interface AudioState {
  isPlaying: boolean;
  volume: number;
  currentStationId: number | null;
  audioError: string | null;
  play: (streamUrl: string, stationId: number, isHls?: boolean) => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  clearError: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  hlsRef: React.MutableRefObject<unknown>;
}

function getInitialVolume(): number {
  if (typeof window === 'undefined') return 0.7;

  const savedVolume = window.localStorage.getItem('savedVolume');
  if (savedVolume === null) return 0.7;

  const parsed = Number.parseFloat(savedVolume);
  if (Number.isNaN(parsed)) return 0.7;

  return Math.min(1, Math.max(0, parsed / 100));
}

function useAudioPlayer(): AudioState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  interface HlsInstance { destroy: () => void }
  const hlsRef = useRef<HlsInstance | null>(null);
  const playRequestIdRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const currentStreamRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(getInitialVolume);
  const [currentStationId, setCurrentStationId] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnectRef.current || !currentStreamRef.current || reconnectTimerRef.current) return;

    const delay = getReconnectDelay(reconnectAttemptRef.current++);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      const audio = audioRef.current;
      const streamUrl = currentStreamRef.current;
      if (!audio || !streamUrl || !shouldReconnectRef.current) return;

      audio.src = streamUrl;
      audio.load();
      audio.play().catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Audio reconnect error:', error);
        }
      });
    }, delay);
  }, []);

  useEffect(() => {
    if (isTauriAndroid()) return;

    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;
    }
    const audio = audioRef.current;

    const handlePlay = () => {
      reconnectAttemptRef.current = 0;
      setIsPlaying(true);
      setAudioError(null);
    };
    const handlePause = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setAudioError('Wystąpił błąd przy odtwarzaniu streamu');
      setIsPlaying(false);
      scheduleReconnect();
    };
    const handleEnded = () => scheduleReconnect();

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      clearReconnectTimer();
    };
  }, [clearReconnectTimer, scheduleReconnect]);

  useEffect(() => {
    if (!isTauriAndroid()) return;

    let disposed = false;
    let refreshInProgress = false;
    let unsubscribe: (() => void) | null = null;
    const applyNativeState = (state: {
      isPlaying: boolean;
      stationId: number | null;
      error?: string | null;
    }): void => {
      if (disposed) return;
      setIsPlaying(state.isPlaying);
      setCurrentStationId(state.stationId);
      setAudioError(state.error || null);
    };

    const refreshNativeState = async (): Promise<void> => {
      if (disposed || refreshInProgress) return;
      refreshInProgress = true;
      try {
        applyNativeState(await getAndroidPlaybackState());
      } catch (error) {
        if (!disposed) setAudioError(error instanceof Error ? error.message : String(error));
      } finally {
        refreshInProgress = false;
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void refreshNativeState();
    };

    void refreshNativeState();
    void onAndroidPlaybackState(applyNativeState).then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    });

    // Zdarzenie pluginu pozostaje podstawowym źródłem zmian. Odpytywanie jest
    // zabezpieczeniem dla WebView, które może zgubić zdarzenie podczas zmiany
    // stanu aplikacji albo przejścia sterowania z Android Auto.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNativeState();
    }, 500);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (isTauriAndroid()) {
      void setAndroidPlaybackVolume(volume).catch((error) => {
        console.error('Błąd ustawiania głośności natywnego odtwarzacza:', error);
      });
    } else if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem('savedVolume', String(Math.round(volume * 100)));
    } catch {
      /* ignore storage failures */
    }
  }, [volume]);

  const play = useCallback((streamUrl: string, stationId: number, isHls = false) => {
    if (isTauriAndroid()) {
      clearReconnectTimer();
      setCurrentStationId(stationId);
      setIsPlaying(false);
      setAudioError(null);
      void playAndroidStation(stationId).catch((error) => {
        setIsPlaying(false);
        setAudioError(error instanceof Error ? error.message : 'Nie udało się uruchomić stacji');
      });
      return;
    }

    if (!audioRef.current) return;

    const requestId = ++playRequestIdRef.current;
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    shouldReconnectRef.current = true;
    currentStreamRef.current = streamUrl;
    setIsPlaying(false);
    setAudioError(null);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const audio = audioRef.current;
    audio.pause();
    const safePlay = () => {
      audio.play().catch((error) => {
        setIsPlaying(false);
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error(error);
        }
      });
    };

    if (isHls || streamUrl.includes('.m3u8')) {
      import('hls.js').then((HlsModule) => {
        if (requestId !== playRequestIdRef.current) return;

        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (requestId !== playRequestIdRef.current) return;
            safePlay();
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (requestId !== playRequestIdRef.current) return;

            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else { hls.destroy(); audio.src = streamUrl; safePlay(); }
            }
          });
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          if (requestId !== playRequestIdRef.current) return;
          audio.src = streamUrl;
          safePlay();
        }
      }).catch(() => {
        if (requestId !== playRequestIdRef.current) return;
        audio.src = streamUrl;
        safePlay();
      });
    } else {
      if (requestId !== playRequestIdRef.current) return;
      audio.src = streamUrl;
      safePlay();
    }

    setCurrentStationId(stationId);
  }, [clearReconnectTimer]);

  const pause = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    if (isTauriAndroid()) {
      void pauseAndroidPlayback().catch((error) => {
        setAudioError(error instanceof Error ? error.message : 'Nie udało się wstrzymać odtwarzania');
      });
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [clearReconnectTimer]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (currentStationId) {
      if (isTauriAndroid()) {
        void resumeAndroidPlayback().catch((error) => {
          setAudioError(error instanceof Error ? error.message : 'Nie udało się wznowić odtwarzania');
        });
        return;
      }
      shouldReconnectRef.current = true;
      audioRef.current?.play().catch(console.error);
    }
  }, [isPlaying, pause, currentStationId]);

  const clearError = useCallback(() => {
    setAudioError(null);
  }, []);

  return { isPlaying, volume, currentStationId, audioError, play, pause, togglePlay, setVolume, clearError, audioRef, hlsRef };
}

type PlayerContextType = AudioState;

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer(): PlayerContextType {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioState = useAudioPlayer();

  return (
    <PlayerContext.Provider value={audioState}>
      {children}
    </PlayerContext.Provider>
  );
}
