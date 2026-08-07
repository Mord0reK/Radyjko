export interface Station {
  id: number;
  name: string;
  url: string;
  shortName: string;
  isOpenFM: number;
  openFmId: number | null;
  RmfID: number | null;
  EskaID: number | null;
  Opis: string | null;
  Jakosc: string | null;
  isExplicit: boolean;
  genre?: string;
  needsProxy?: boolean;
}

/**
 * Represents metadata for a currently playing song or track.
 * Includes current track info, playback history, upcoming tracks, and schedule.
 */
export interface SongInfo {
  /** The title of the currently playing song or track */
  title: string;
  /** The artist or performer of the track */
  artist: string;
  /** Optional URL to the album/track cover image */
  cover?: string | null;
  /** Optional Unix timestamp when the track started playing */
  timestamp?: number | null;
  /** Optional duration of the track in seconds */
  duration?: number | null;
  /** Optional presenter or host name (e.g., for radio shows) */
  presenter?: string | null;
  /** Array of upcoming tracks in the queue or playlist */
  next?: Array<{ title: string; artist: string; cover?: string }>;
  /** Array of previously played tracks with optional cover art */
  previous?: Array<{ title: string; artist: string; cover?: string }>;
  /** Array of scheduled programs or shows with timing information */
  schedule?: Array<{
    /** Start time of the program (ISO 8601 or HH:mm format) */
    time: string;
    /** Optional end time of the program */
    timeEnd?: string;
    /** Name of the program presenter or host */
    presenter: string;
    /** Optional name of the show or program */
    show?: string;
    /** Optional flag indicating if this is a break/interlude */
    isBreak?: boolean;
  }>;
}

export interface NowPlayingResponse {
  nowPlaying: Record<number, SongInfo>;
  failures?: Array<{ source: string; error: string }>;
}

export interface FetchResult<T> {
  success: boolean;
  data: T | null;
  source: string;
  error?: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentStationId: number | null;
  currentTrack: SongInfo | null;
  currentTime: number;
  duration: number;
}

export interface AppState {
  stations: Station[];
  favorites: number[];
  activeStationId: number | null;
  playerState: PlayerState;
  nowPlaying: Record<number, SongInfo>;
  isLoading: boolean;
  error: string | null;
}
