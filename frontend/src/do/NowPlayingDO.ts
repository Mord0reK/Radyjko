import type { NowPlayingResponse, SongInfo, Station } from "@/lib/types";
import { withTimeout } from "@/lib/fetchers/timeout";
import { fetchOpenFMData } from "@/lib/fetchers/openfm";
import { fetchRmfData } from "@/lib/fetchers/rmf";
import { fetchEskaData } from "@/lib/fetchers/eska";
import { fetchVoxFMData } from "@/lib/fetchers/voxfm";
import { fetchEurozetData } from "@/lib/fetchers/eurozet";
import { fetchRadioPartyData } from "@/lib/fetchers/radioparty";
import { fetchRadioCmpData } from "@/lib/fetchers/radiocmp";
import {
  connectRadioKierowcow,
  RADIO_KIEROWCOW_DEFAULT_TRACK,
} from "@/lib/fetchers/radiokierowcow";
import { shouldSchedulePollingAlarm } from "@/do/alarmSchedule";
import { DurableObject } from "cloudflare:workers";

const TIMEOUT_MS = 1000;
const POLL_INTERVAL_MS = 10000;
const CACHE_KEY = "cached";
const RADIO_KIEROWCOW_RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

type NowPlayingEnvelope =
  | { type: "snapshot"; payload: NowPlayingResponse }
  | { type: "heartbeat"; payload: { ts: number } }
  | { type: "failure"; payload: { source: string; error: string } };

function extractVoxFMId(url: string): string | null {
  const match = url.match(/\/(\d+)-/);
  return match ? match[1] : null;
}

function parseNowPlayingPayload(serialized: string | null): NowPlayingResponse | null {
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as NowPlayingResponse;

    return {
      nowPlaying: parsed.nowPlaying || {},
      failures: parsed.failures || [],
    };
  } catch {
    return null;
  }
}

function serializeEnvelope(envelope: NowPlayingEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Serializes a NowPlayingResponse snapshot to JSON string.
 * Preserves all SongInfo fields including:
 * - Basic: title, artist
 * - Metadata: cover, duration, timestamp
 * - History: previous tracks
 * - Queue: next tracks
 * - Schedule: RadioParty schedule
 * 
 * JSON.stringify automatically includes all fields in the object.
 */
function serializeSnapshot(snapshot: NowPlayingResponse): string {
  return JSON.stringify({
    nowPlaying: snapshot.nowPlaying || {},
    failures: snapshot.failures || [],
  });
}

export class NowPlayingDO extends DurableObject<CloudflareEnv> {
  private cached: string | null = null;
  private hydratePromise: Promise<void> | null = null;
  private alarmCount = 0;
  private radioKierowcowSocket: WebSocket | null = null;
  private radioKierowcowConnectPromise: Promise<void> | null = null;
  private radioKierowcowReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private radioKierowcowReconnectAttempt = 0;

  private async hydrateCache(): Promise<void> {
    if (this.hydratePromise) {
      await this.hydratePromise;
      return;
    }

    this.hydratePromise = (async () => {
      if (this.cached !== null) return;

      const stored = await this.ctx.storage.get<string>(CACHE_KEY);
      this.cached = stored ?? null;
    })();

    await this.hydratePromise;
  }

  private async loadStations(): Promise<Station[]> {
    const { results } = await this.env.DB.prepare(
      "SELECT id, shortName, isOpenFM, openFmId, RmfID, EskaID, url FROM stations"
    ).all<Station>();

    return results;
  }

  private async updateRadioKierowcow(track: SongInfo): Promise<void> {
    const stations = await this.loadStations();
    const station = stations.find((item) => item.shortName === "radio-kierowcow");
    if (!station) {
      return;
    }

    const snapshot = (await this.getCurrentSnapshot()) ?? { nowPlaying: {} };
    const serializedBefore = serializeSnapshot(snapshot);
    snapshot.nowPlaying[station.id] = track;
    const serialized = serializeSnapshot(snapshot);

    if (serialized === serializedBefore) return;
    this.cached = serialized;
    await this.ctx.storage.put(CACHE_KEY, serialized);
    this.broadcast({ type: "snapshot", payload: snapshot });
  }

  private scheduleRadioKierowcowReconnect(): void {
    if (!this.hasActiveClients() || this.radioKierowcowReconnectTimer) return;

    const delay = RADIO_KIEROWCOW_RECONNECT_DELAYS[
      Math.min(this.radioKierowcowReconnectAttempt, RADIO_KIEROWCOW_RECONNECT_DELAYS.length - 1)
    ];
    this.radioKierowcowReconnectAttempt++;
    this.radioKierowcowReconnectTimer = setTimeout(() => {
      this.radioKierowcowReconnectTimer = null;
      void this.ensureRadioKierowcowUpstream();
    }, delay);
  }

  private async ensureRadioKierowcowUpstream(): Promise<void> {
    if (!this.hasActiveClients() || this.radioKierowcowSocket || this.radioKierowcowConnectPromise) return;

    this.radioKierowcowConnectPromise = connectRadioKierowcow(
      (track) => {
        this.radioKierowcowReconnectAttempt = 0;
        this.ctx.waitUntil(this.updateRadioKierowcow(track));
      },
      () => {
        this.radioKierowcowSocket = null;
        this.scheduleRadioKierowcowReconnect();
      },
    )
      .then((socket) => {
        if (!this.hasActiveClients()) {
          socket.close(1000, "no active clients");
          return;
        }
        this.radioKierowcowSocket = socket;
      })
      .catch(() => {
        this.scheduleRadioKierowcowReconnect();
      })
      .finally(() => {
        this.radioKierowcowConnectPromise = null;
      });

    await this.radioKierowcowConnectPromise;
  }

  private stopRadioKierowcowUpstream(): void {
    if (this.radioKierowcowReconnectTimer) {
      clearTimeout(this.radioKierowcowReconnectTimer);
      this.radioKierowcowReconnectTimer = null;
    }
    this.radioKierowcowReconnectAttempt = 0;
    this.radioKierowcowSocket?.close(1000, "no active clients");
    this.radioKierowcowSocket = null;
  }

  /**
   * Loads now-playing data from all fetchers and maps to stations.
   * 
   * Field Flow:
   * - RMF: Returns SongInfo with previous/next tracks (via mapToSongInfo)
   * - Eurozet: Returns SongInfo with cover/duration/timestamp (via mapToSongInfo)
   * - RadioParty: Returns SongInfo with schedule (via mapToSongInfo)
   * - All other fetchers: Return basic SongInfo with title/artist
   * 
   * All fields are preserved through JSON serialization for cache and WebSocket broadcast.
   */
  private async loadNowPlaying(): Promise<NowPlayingResponse> {
    const stations = await this.loadStations();

    // Fetch from all sources in parallel with timeout protection
    const [resOpenFM, resRmf, resEska, resVox, resEurozet, resRadioParty, resRadioCmp] = await Promise.all([
      withTimeout(fetchOpenFMData(), TIMEOUT_MS, "openFM"),
      withTimeout(fetchRmfData(stations), TIMEOUT_MS, "rmf"),
      withTimeout(fetchEskaData(stations), TIMEOUT_MS, "eska"),
      withTimeout(fetchVoxFMData(stations), TIMEOUT_MS, "voxFM"),
      withTimeout(fetchEurozetData(), TIMEOUT_MS, "eurozet"),
      withTimeout(fetchRadioPartyData(), TIMEOUT_MS, "radioParty"),
      withTimeout(fetchRadioCmpData(), TIMEOUT_MS, "radioCmp"),
    ]);

    // Extract data from successful results (fetchers return complete SongInfo objects)
    const openFmData = resOpenFM.success ? (resOpenFM.data || {}) : {};
    const rmfData = resRmf.success ? (resRmf.data || {}) : {}; // Includes previous/next
    const eskaData = resEska.success ? (resEska.data || {}) : {};
    const voxFmData = resVox.success ? (resVox.data || {}) : {};
    const eurozetData = resEurozet.success ? (resEurozet.data || {}) : {}; // Includes cover/duration/timestamp
    const radioPartyData = resRadioParty.success ? resRadioParty.data : null; // Includes schedule
    const radioCmpData = resRadioCmp.success ? resRadioCmp.data : null;

    // Track failures for response
    const failures = [resOpenFM, resRmf, resEska, resVox, resEurozet, resRadioParty, resRadioCmp]
      .filter((result) => result && !result.success && result.source)
      .map((result) => ({ source: result.source, error: result.error || "unknown" }));

    const nowPlaying: NowPlayingResponse["nowPlaying"] = {};

    // Map each station to its fetcher result, preserving all SongInfo fields
    for (const station of stations) {
      let songData: SongInfo | null = null;

      if (station.isOpenFM && station.openFmId && openFmData[station.openFmId]) {
        songData = openFmData[station.openFmId];
      } else if (station.RmfID && rmfData[station.RmfID]) {
        // RMF data includes previous/next tracks
        songData = rmfData[station.RmfID];
      } else if (station.EskaID && eskaData[station.EskaID]) {
        songData = eskaData[station.EskaID];
      } else if (station.shortName?.toLowerCase().includes("voxfm")) {
        const voxId = extractVoxFMId(station.url);
        if (voxId && voxFmData[voxId]) {
          songData = voxFmData[voxId];
        }
      } else if (station.shortName === "radio-zet" && eurozetData.radiozet) {
        // Eurozet data includes cover/duration/timestamp
        songData = eurozetData.radiozet;
      } else if (station.shortName === "radiozet-dance" && eurozetData.zetdance) {
        songData = eurozetData.zetdance;
      } else if (station.shortName === "meloradio" && eurozetData.meloradio) {
        songData = eurozetData.meloradio;
      } else if (station.shortName === "antyradio" && eurozetData.antyradio) {
        songData = eurozetData.antyradio;
      } else if (station.shortName === "rp-kanalglowny" && radioPartyData?.["rp-kanalglowny"]) {
        // RadioParty data includes schedule
        songData = radioPartyData["rp-kanalglowny"];
      } else if (station.shortName === "radio-cmp" && radioCmpData?.["radio-cmp"]) {
        songData = radioCmpData["radio-cmp"];
      }

      if (songData) {
        // All SongInfo fields (title, artist, cover, duration, timestamp, previous, next, schedule)
        // are preserved through assignment and JSON serialization
        nowPlaying[station.id] = songData;
      } else if (station.shortName === "radio-kierowcow") {
        nowPlaying[station.id] = RADIO_KIEROWCOW_DEFAULT_TRACK;
      }
    }

    return {
      nowPlaying,
      ...(failures.length > 0 && { failures }),
    };
  }

  private async getCurrentSnapshot(): Promise<NowPlayingResponse | null> {
    await this.hydrateCache();
    return parseNowPlayingPayload(this.cached);
  }

  private async refreshSnapshot(): Promise<{ snapshot: NowPlayingResponse; serialized: string }> {
    const snapshot = await this.loadNowPlaying();
    const cachedSnapshot = await this.getCurrentSnapshot();
    if (cachedSnapshot?.nowPlaying) {
      const stations = await this.loadStations();
      const radioKierowcow = stations.find((station) => station.shortName === "radio-kierowcow");
      if (
        radioKierowcow &&
        (!snapshot.nowPlaying[radioKierowcow.id] ||
          snapshot.nowPlaying[radioKierowcow.id].title === RADIO_KIEROWCOW_DEFAULT_TRACK.title)
      ) {
        const cachedTrack = cachedSnapshot.nowPlaying[radioKierowcow.id];
        if (cachedTrack && cachedTrack.title !== RADIO_KIEROWCOW_DEFAULT_TRACK.title) {
          snapshot.nowPlaying[radioKierowcow.id] = cachedTrack;
        }
      }
    }
    const serialized = serializeSnapshot(snapshot);

    if (serialized !== this.cached) {
      this.cached = serialized;
      await this.ctx.storage.put(CACHE_KEY, serialized);
    }

    return { snapshot, serialized };
  }

  /**
   * Broadcasts envelope to all connected WebSocket clients.
   * Envelope contains complete NowPlayingResponse with all SongInfo fields preserved.
   * 
   * Field preservation through broadcast:
   * 1. serializeEnvelope() uses JSON.stringify
   * 2. JSON.stringify includes all fields (previous, next, schedule, cover, duration, timestamp)
   * 3. Clients receive complete data for all stations
   */
  private broadcast(envelope: NowPlayingEnvelope): void {
    const payload = serializeEnvelope(envelope);

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // Ignore dead sockets; hibernation will clean them up.
      }
    }
  }

  private hasActiveClients(): boolean {
    return this.ctx.getWebSockets().length > 0;
  }

  private async ensureAlarm(): Promise<void> {
    if (!this.hasActiveClients()) {
      await this.cancelAlarm();
      this.stopRadioKierowcowUpstream();
      return;
    }

    const alarm = await this.ctx.storage.getAlarm();
    const nextPoll = Date.now() + POLL_INTERVAL_MS;
    if (shouldSchedulePollingAlarm(alarm, nextPoll)) {
      await this.ctx.storage.setAlarm(nextPoll);
    }
  }

  private async cancelAlarm(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
  }

  async fetch(request: Request): Promise<Response> {
    await this.hydrateCache();

    const upgradeHeader = request.headers.get("Upgrade")?.toLowerCase();

    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.ctx.acceptWebSocket(server);

      let snapshot: NowPlayingResponse | null;
      try {
        const refreshed = await this.refreshSnapshot();
        snapshot = refreshed.snapshot;
      } catch (error) {
        console.error("Failed to refresh now playing snapshot for websocket:", error);
        snapshot = await this.getCurrentSnapshot();
      }

      if (snapshot) {
        server.send(serializeEnvelope({ type: "snapshot", payload: snapshot }));
      } else {
        server.send(serializeEnvelope({ type: "failure", payload: { source: "nowplaying", error: "empty-cache" } }));
      }

      await this.ensureAlarm();
      this.ctx.waitUntil(this.ensureRadioKierowcowUpstream());

      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    let snapshot = await this.getCurrentSnapshot();

    if (!snapshot) {
      try {
        const refreshed = await this.refreshSnapshot();
        snapshot = refreshed.snapshot;
      } catch (error) {
        console.error("Failed to load now playing snapshot:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Don't ensure alarm for GET requests - only WebSocket clients should trigger polling
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  async alarm(): Promise<void> {
    // Only run alarm if there are active WebSocket clients
    if (!this.hasActiveClients()) {
      await this.cancelAlarm();
      this.stopRadioKierowcowUpstream();
      return;
    }

    await this.hydrateCache();
    await this.ensureRadioKierowcowUpstream();

    try {
      const previous = this.cached;
      const { snapshot, serialized } = await this.refreshSnapshot();

      if (serialized !== previous && snapshot) {
        this.broadcast({ type: "snapshot", payload: snapshot });
        this.alarmCount = 0; // Reset heartbeat counter on data change
      } else {
        // No data change - send heartbeat every 2-3 alarms (~20-30s)
        if (this.alarmCount % 3 === 0) {
          this.broadcast({
            type: "heartbeat",
            payload: { ts: Date.now() },
          });
        }
      }
      
      this.alarmCount++;
    } catch (error) {
      console.error("Failed to refresh now playing in alarm:", error);
      this.broadcast({
        type: "failure",
        payload: { source: "nowplaying", error: "internal" },
      });
    }

    // Only reschedule alarm if still have clients
    if (this.hasActiveClients()) {
      await this.ctx.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
    } else {
      await this.cancelAlarm();
      this.stopRadioKierowcowUpstream();
    }
  }

  webSocketClose(): void {
    if (!this.hasActiveClients()) this.stopRadioKierowcowUpstream();
  }

  webSocketError(): void {
    if (!this.hasActiveClients()) this.stopRadioKierowcowUpstream();
  }
}
