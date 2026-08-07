import { addPluginListener, invoke } from "@tauri-apps/api/core";
import { isTauriAndroid } from "./platform";

export interface MediaState {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  isPlaying?: boolean;
  stationId?: number;
  canPrev?: boolean;
  canNext?: boolean;
}

interface AndroidAutoState {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  isPlaying?: boolean;
  stationId?: number;
}

export interface AndroidAutoStation {
  id: number;
  name: string;
  artworkUrl: string;
  url: string;
  shortName: string;
  needsProxy: boolean;
  isOpenFM: boolean;
  openFmId: number | null;
}

export interface AndroidPlaybackState {
  isPlaying: boolean;
  stationId: number | null;
  error?: string | null;
}

export async function updateMediaSession(state: MediaState): Promise<void> {
  // Android korzysta wyłącznie z MediaSession natywnego odtwarzacza.
  // Druga sesja pluginu powodowała niezależne odtwarzanie dwóch stacji.
  void state;
}

export async function clearMediaSession(): Promise<void> {
  // Sesja jest zwalniana razem z natywnym serwisem odtwarzacza.
}

export async function updateAndroidAuto(state: AndroidAutoState): Promise<void> {
  if (!isTauriAndroid()) return;
  await invoke("update_android_auto", { state });
}

export async function syncAndroidAutoStations(stations: AndroidAutoStation[]): Promise<void> {
  if (!isTauriAndroid()) return;
  await invoke("sync_android_auto_stations", { stations });
}

export async function playAndroidStation(stationId: number): Promise<void> {
  if (!isTauriAndroid()) return;
  await invoke("play_android_auto_station", { stationId });
}

export async function pauseAndroidPlayback(): Promise<void> {
  if (!isTauriAndroid()) return;
  await invoke("pause_android_auto_playback");
}

export async function resumeAndroidPlayback(): Promise<void> {
  if (!isTauriAndroid()) return;
  await invoke("resume_android_auto_playback");
}

export async function setAndroidPlaybackVolume(volume: number): Promise<void> {
  if (!isTauriAndroid()) return;
  await invoke("set_android_auto_volume", { volume });
}

export async function getAndroidPlaybackState(): Promise<AndroidPlaybackState> {
  if (!isTauriAndroid()) return { isPlaying: false, stationId: null };
  return invoke<AndroidPlaybackState>("get_android_auto_playback_state");
}

export async function onAndroidPlaybackState(
  handler: (payload: AndroidPlaybackState) => void,
): Promise<() => void> {
  if (!isTauriAndroid()) return () => {};

  const listener = await addPluginListener<AndroidPlaybackState>(
    "radyjko-auto",
    "playbackStateChanged",
    handler,
  );

  return () => { void listener.unregister(); };
}
