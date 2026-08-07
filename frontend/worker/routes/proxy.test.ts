import { strict as assert } from "node:assert";
import test from "node:test";
import { getStream, MAX_MANIFEST_BYTES } from "./proxy";

function createEnv(station: { url: string; needsProxy: number } | null): CloudflareEnv {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => station,
        }),
      }),
    },
  } as CloudflareEnv;
}

test("requires a station shortName", async () => {
  const response = await getStream(
    new Request("https://example.com/api/stream"),
    createEnv(null),
  );

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Missing 'station' query parameter");
});

test("uses the station URL instead of an arbitrary client URL", async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = "";
  globalThis.fetch = async (input) => {
    fetchedUrl = input.toString();
    return new Response();
  };

  try {
    const response = await getStream(
      new Request("https://example.com/api/stream?station=radiofreee&url=https%3A%2F%2Fevil.example"),
      createEnv({ url: "https://stream.example/radiofreee", needsProxy: 1 }),
    );

    assert.equal(response.status, 200);
    assert.equal(fetchedUrl, "https://stream.example/radiofreee");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streams a station response and removes Content-Length", async () => {
  const originalFetch = globalThis.fetch;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("audio"));
      controller.close();
    },
  });
  globalThis.fetch = async () => new Response(body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": "5",
    },
  });

  try {
    const response = await getStream(
      new Request("https://example.com/api/stream?station=radiofreee"),
      createEnv({ url: "https://stream.example/radiofreee", needsProxy: 1 }),
    );

    assert.equal(await response.text(), "audio");
    assert.equal(response.headers.get("Content-Length"), null);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an oversized manifest without buffering its body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("#EXTM3U", {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Content-Length": String(MAX_MANIFEST_BYTES + 1),
    },
  });

  try {
    const response = await getStream(
      new Request("https://example.com/api/stream?station=radiofreee"),
      createEnv({ url: "https://stream.example/playlist.m3u8", needsProxy: 1 }),
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Manifest exceeds the size limit" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects HLS resources outside the station origin", async () => {
  const response = await getStream(
    new Request("https://example.com/api/stream?station=radiofreee&resource=https%3A%2F%2Fevil.example%2Fsegment.ts"),
    createEnv({ url: "https://stream.example/playlist.m3u8", needsProxy: 1 }),
  );

  assert.equal(response.status, 403);
});
