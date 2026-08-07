import { invoke } from "@tauri-apps/api/core";
import { getIconPath } from "@/contexts/StationsContext";
import { getPublicAssetUrl } from "@/lib/apiUrls";
import { isTauriDesktop } from "@/lib/platform";
import type { SongInfo } from "@/lib/types";

interface PresenceStation {
  name: string;
  shortName: string;
}

export interface DiscordPresence {
  details: string;
  state: string;
  largeImage: string;
  largeText: string;
  smallImage: string;
  smallText: string;
}

export function createDiscordPresence(
  station: PresenceStation,
  song?: Pick<SongInfo, "artist" | "title" | "presenter">,
  assetBaseUrl = getPublicAssetUrl("/"),
): DiscordPresence {
  const presenter = song?.presenter || song?.artist;
  const isRadioParty = station.shortName.startsWith("rp-");
  const state = isRadioParty
    ? `Prezenter: ${presenter || "brak informacji"}`
    : song?.artist || "Nieznany wykonawca";

  return {
    details: isRadioParty ? station.name : song?.title || station.name,
    state,
    largeImage: new URL(getIconPath(station.shortName), assetBaseUrl).toString(),
    largeText: station.name,
    smallImage: new URL("/icon.png", assetBaseUrl).toString(),
    smallText: "Radyjko",
  };
}

// Re-export for backward compatibility
export { isTauriDesktop };

export async function setDiscordPresence(presence: DiscordPresence): Promise<void> {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID?.trim();
  if (!isTauriDesktop() || !clientId) return;
  await invoke("set_discord_presence", { clientId, presence });
}

export async function clearDiscordPresence(): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke("clear_discord_presence");
}
