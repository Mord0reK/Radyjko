import { strict as assert } from "node:assert";
import test from "node:test";
import { buildApiUrl, buildWebSocketApiUrl, getStreamUrl } from "./apiUrls";

test("builds API URLs from API-relative and absolute API paths", () => {
  assert.equal(
    buildApiUrl("/stations", "https://radio.example"),
    "https://radio.example/api/stations",
  );
  assert.equal(
    buildApiUrl("/api/schedule/radioparty", "https://radio.example/ignored"),
    "https://radio.example/api/schedule/radioparty",
  );
});

test("builds WebSocket URLs using the matching secure protocol", () => {
  assert.equal(
    buildWebSocketApiUrl("/nowplaying", "https://radio.example"),
    "wss://radio.example/api/nowplaying",
  );
  assert.equal(
    buildWebSocketApiUrl("/nowplaying", "http://localhost:5173"),
    "ws://localhost:5173/api/nowplaying",
  );
});

test("rejects unsupported API base URL protocols", () => {
  assert.throws(
    () => buildApiUrl("/stations", "file:///tmp/radyjko"),
    /must use HTTP or HTTPS/,
  );
});

test("builds a stream URL from a station shortName", () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://radio.example" } },
  });

  try {
    assert.equal(
      getStreamUrl("radio freee"),
      "https://radio.example/api/stream?station=radio+freee",
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});
