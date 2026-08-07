import assert from "node:assert/strict";
import test from "node:test";

import { rewriteM3U8Manifest } from "./rewriteM3U8";

test("rewrites relative playlist URIs to proxied absolute URLs", () => {
  const manifest = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=1280000",
    "chunklist.m3u8",
  ].join("\n");

  const rewritten = rewriteM3U8Manifest(
    manifest,
    "https://example.com/live/master.m3u8",
    (resourceUrl) => `/api/stream?station=radiofreee&resource=${encodeURIComponent(resourceUrl)}`,
  );

  assert.match(
    rewritten,
    /\/api\/stream\?station=radiofreee&resource=https%3A%2F%2Fexample\.com%2Flive%2Fchunklist\.m3u8/,
  );
});
