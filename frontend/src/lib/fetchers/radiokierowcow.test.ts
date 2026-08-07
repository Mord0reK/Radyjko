import { strict as assert } from "node:assert";
import test from "node:test";
import {
  parseRadioKierowcowMessage,
  RADIO_KIEROWCOW_DEFAULT_TRACK,
} from "./radiokierowcow";

const RECORD_SEPARATOR = "\u001e";

function receiveCurrentTrack(track: unknown): string {
  return JSON.stringify({
    type: 1,
    target: "ReceiveCurrentTrack",
    arguments: [track],
  }) + RECORD_SEPARATOR;
}

test("zwraca aktualny utwór Radio Kierowców", () => {
  assert.deepEqual(
    parseRadioKierowcowMessage(receiveCurrentTrack({
      title: "Testowy utwór",
      artist: "Testowy artysta",
      photo: "https://example.com/cover.jpg",
    })),
    {
      title: "Testowy utwór",
      artist: "Testowy artysta",
      cover: "https://example.com/cover.jpg",
    },
  );
});

test("zamienia null/null z SignalR na stan wiadomości lub reklamy", () => {
  assert.deepEqual(
    parseRadioKierowcowMessage(receiveCurrentTrack({ title: null, artist: null })),
    RADIO_KIEROWCOW_DEFAULT_TRACK,
  );
});
