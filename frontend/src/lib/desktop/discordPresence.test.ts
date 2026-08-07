import assert from "node:assert/strict";
import test from "node:test";

import { createDiscordPresence } from "./discordPresence";

test("creates a Rich Presence payload from the station and current track", () => {
  assert.deepEqual(
    createDiscordPresence(
      { name: "Radio Freee", shortName: "radio-freee" },
      { artist: "Wykonawca", title: "Utwór" },
      "https://radyjko.example",
    ),
    {
      details: "Utwór",
      state: "Wykonawca",
      largeImage: "https://radyjko.example/ikony/radio-freee.webp",
      largeText: "Radio Freee",
      smallImage: "https://radyjko.example/icon.png",
      smallText: "Radyjko",
    },
  );
});

test("shows the RadioParty presenter instead of track metadata", () => {
  assert.deepEqual(
    createDiscordPresence(
      { name: "RadioParty Kanał Główny", shortName: "rp-kanalglowny" },
      { artist: "RadioParty.pl", title: "Pasmo", presenter: "DJ Ropucha" },
      "https://radyjko.example",
    ),
    {
      details: "RadioParty Kanał Główny",
      state: "Prezenter: DJ Ropucha",
      largeImage: "https://radyjko.example/ikony/rp-kanalglowny.webp",
      largeText: "RadioParty Kanał Główny",
      smallImage: "https://radyjko.example/icon.png",
      smallText: "Radyjko",
    },
  );
});
