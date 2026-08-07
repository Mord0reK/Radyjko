import type { SongInfo } from "@/lib/types";

const NEGOTIATE_URL = "https://hubs.polskieradio.pl/music/currentTrack/negotiate?negotiateVersion=1";
const WEBSOCKET_URL = "https://hubs.polskieradio.pl/music/currentTrack";
const ORIGIN = "https://radiokierowcow.pl";
const RECORD_SEPARATOR = "\u001e";
const SIGNALR_HANDSHAKE = '{"protocol":"json","version":1}' + RECORD_SEPARATOR;
const SIGNALR_CONNECT =
  JSON.stringify({
    arguments: ["Radio Kierowców"],
    invocationId: "0",
    streamIds: [],
    target: "Connect",
    type: 1,
  }) + RECORD_SEPARATOR;
const CONNECTION_TIMEOUT_MS = 5000;

export const RADIO_KIEROWCOW_DEFAULT_TRACK: SongInfo = {
  title: "Wiadomości / Reklama",
  artist: "",
};

interface SignalRMessage {
  type?: unknown;
  target?: unknown;
  arguments?: unknown;
}

interface NegotiateResponse {
  connectionToken?: unknown;
}

interface CurrentTrack {
  artist?: unknown;
  title?: unknown;
  photo?: unknown;
}

export function parseRadioKierowcowMessage(payload: string): SongInfo | null {
  for (const segment of payload.split(RECORD_SEPARATOR)) {
    if (!segment) continue;

    let message: SignalRMessage;
    try {
      message = JSON.parse(segment) as SignalRMessage;
    } catch {
      continue;
    }

    if (message.type !== 1 || message.target !== "ReceiveCurrentTrack") continue;
    if (!Array.isArray(message.arguments)) continue;

    const track = message.arguments[0] as CurrentTrack | undefined;
    if (!track || typeof track !== "object") continue;
    if (typeof track.title !== "string" || !track.title.trim()
      || typeof track.artist !== "string" || !track.artist.trim()) {
      return { ...RADIO_KIEROWCOW_DEFAULT_TRACK };
    }

    return {
      title: track.title,
      artist: track.artist,
      ...(typeof track.photo === "string" && track.photo ? { cover: track.photo } : {}),
    };
  }

  return null;
}

function createTimeout(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

async function negotiate(): Promise<string> {
  const timeout = createTimeout();
  try {
    const response = await fetch(NEGOTIATE_URL, {
      method: "POST",
      headers: { Origin: ORIGIN },
      signal: timeout.signal,
    });
    if (!response.ok) throw new Error(`negotiate: ${response.status}`);

    const data = (await response.json()) as NegotiateResponse;
    if (typeof data.connectionToken !== "string" || !data.connectionToken) {
      throw new Error("negotiate: missing connectionToken");
    }
    return data.connectionToken;
  } finally {
    timeout.cancel();
  }
}

export async function connectRadioKierowcow(
  onTrack: (track: SongInfo) => void,
  onClose: () => void,
): Promise<WebSocket> {
  const connectionToken = await negotiate();
  const timeout = createTimeout();
  const response = await fetch(`${WEBSOCKET_URL}?id=${encodeURIComponent(connectionToken)}`, {
    headers: { Upgrade: "websocket", Origin: ORIGIN },
    signal: timeout.signal,
  }).finally(timeout.cancel);

  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`websocket: ${response.status}`);
  }

  const socket = response.webSocket;
  socket.accept();

  await new Promise<void>((resolve, reject) => {
    let handshakeComplete = false;
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("handshake timeout"));
        socket.close(1000, "handshake timeout");
      }
    }, CONNECTION_TIMEOUT_MS);

    socket.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
      for (const segment of data.split(RECORD_SEPARATOR)) {
        if (!segment) continue;

        let message: SignalRMessage;
        try {
          message = JSON.parse(segment) as SignalRMessage;
        } catch {
          continue;
        }

        if (!handshakeComplete && message.type === undefined) {
          handshakeComplete = true;
          socket.send(SIGNALR_CONNECT);
          clearTimeout(timeoutId);
          settled = true;
          resolve();
          continue;
        }

        const track = parseRadioKierowcowMessage(segment);
        if (track) {
          onTrack(track);
        }
      }
    });
    socket.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error("websocket error"));
      }
    });
    socket.send(SIGNALR_HANDSHAKE);
  });

  socket.addEventListener("close", onClose);
  socket.addEventListener("error", onClose);
  return socket;
}
