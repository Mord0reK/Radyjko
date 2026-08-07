import type { NowPlayingResponse, Station } from "@/lib/types";
import { getApiUrl, getStreamUrl, getWebSocketApiUrl } from "@/lib/apiUrls";

const TIMEOUT = 10000;
const NOW_PLAYING_RECONNECT_MS = 5000;
const NOW_PLAYING_MAX_RECONNECT_MS = 60000; // Max 60s backoff

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function fetchStations(): Promise<Station[]> {
  try {
    const response = await fetchWithTimeout(getApiUrl('/stations'));
    const data = (await response.json()) as Station[];
    return data || [];
  } catch (error) {
    console.error('Błąd pobierania stacji:', error);
    return [];
  }
}

interface NowPlayingStreamHandlers {
  onSnapshot: (payload: NowPlayingResponse) => void;
  onUpdate: (payload: NowPlayingResponse) => void;
  onFailure?: (payload: { source: string; error: string }) => void;
  onError?: (event: Event) => void;
}

interface NowPlayingEnvelope {
  type: 'snapshot' | 'update' | 'failure' | 'heartbeat';
  payload: NowPlayingResponse | { source: string; error: string } | { ts: number };
}

function mergeNowPlayingPayload(
  current: NowPlayingResponse,
  incoming: NowPlayingResponse
): NowPlayingResponse {
  return {
    nowPlaying: {
      ...current.nowPlaying,
      ...incoming.nowPlaying,
    },
    failures: incoming.failures ?? current.failures ?? [],
  };
}

export function connectNowPlayingStream(handlers: NowPlayingStreamHandlers): () => void {
  const wsUrl = getWebSocketApiUrl('/nowplaying');

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let lastSnapshot: NowPlayingResponse = { nowPlaying: {}, failures: [] };
  let reconnectAttempts = 0;

  const clearReconnectTimer = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const getReconnectDelay = (): number => {
    // Exponential backoff: 5s, 10s, 20s, 40s, 60s, 60s, ...
    const delay = NOW_PLAYING_RECONNECT_MS * Math.pow(2, reconnectAttempts);
    return Math.min(delay, NOW_PLAYING_MAX_RECONNECT_MS);
  };

  const scheduleReconnect = (): void => {
    if (closed || reconnectTimer) return;

    const delay = getReconnectDelay();
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const handleMessage = (event: MessageEvent<string>): void => {
    try {
      const envelope = JSON.parse(event.data) as NowPlayingEnvelope;

      if (envelope.type === 'snapshot' || envelope.type === 'update') {
        const payload = envelope.payload as NowPlayingResponse;
        const normalized = {
          nowPlaying: payload.nowPlaying || {},
          failures: payload.failures || [],
        };

        if (envelope.type === 'snapshot') {
          lastSnapshot = normalized;
          reconnectAttempts = 0; // Reset backoff on successful connection
          handlers.onSnapshot(normalized);
          return;
        }

        lastSnapshot = mergeNowPlayingPayload(lastSnapshot, normalized);
        handlers.onUpdate(lastSnapshot);
        return;
      }

      if (envelope.type === 'heartbeat') {
        // Heartbeat - just reset attempts count, no action needed
        reconnectAttempts = 0;
        return;
      }

      if (envelope.type === 'failure') {
        handlers.onFailure?.(envelope.payload as { source: string; error: string });
      }
    } catch (error) {
      console.error('Błąd parsowania WebSocket nowplaying:', error);
    }
  };

  const connect = (): void => {
    clearReconnectTimer();

    socket = new WebSocket(wsUrl);
    socket.onopen = (): void => {
      // No-op: DO sends the snapshot immediately after upgrade.
    };
    socket.onmessage = handleMessage;
    socket.onerror = (event): void => {
      handlers.onError?.(event);
      // Close socket to avoid dead connection
      socket?.close();
    };
    socket.onclose = (): void => {
      if (!closed) {
        scheduleReconnect();
      }
    };
  };

  connect();

  return () => {
    closed = true;
    clearReconnectTimer();
    socket?.close();
  };
}

export async function proxyFetch(shortName: string): Promise<Response> {
  try {
    const response = await fetchWithTimeout(getStreamUrl(shortName));
    return response;
  } catch (error) {
    console.error('Błąd proxy fetch:', error);
    throw error;
  }
}
