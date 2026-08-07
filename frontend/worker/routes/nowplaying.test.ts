import { strict as assert } from "node:assert";
import test from "node:test";
import { getNowPlaying } from "./nowplaying";

function createEnv(response: Response) {
  let instanceName = "";
  let forwardedRequest: Request | undefined;
  const namespace = {
    idFromName(name: string) {
      instanceName = name;
      return { name };
    },
    get() {
      return {
        async fetch(request: Request) {
          forwardedRequest = request;
          return response;
        },
      };
    },
  };

  return {
    env: { NOWPLAYING_DO: namespace } as unknown as Pick<CloudflareEnv, "NOWPLAYING_DO">,
    getInstanceName: () => instanceName,
    getForwardedRequest: () => forwardedRequest,
  };
}

test("routes regular now-playing GET through the singleton and adds CORS", async () => {
  const fixture = createEnv(Response.json({ type: "snapshot" }));
  const request = new Request("https://example.com/api/nowplaying");

  const response = await getNowPlaying(request, fixture.env);

  assert.equal(fixture.getInstanceName(), "singleton");
  assert.equal(fixture.getForwardedRequest(), request);
  assert.deepEqual(await response.json(), { type: "snapshot" });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("returns the Durable Object WebSocket response without consuming it", async () => {
  const doResponse = new Response(null, { status: 204, headers: { "X-Handshake": "preserved" } });
  const fixture = createEnv(doResponse);
  const request = new Request("https://example.com/api/nowplaying", {
    headers: { Upgrade: "websocket" },
  });

  const response = await getNowPlaying(request, fixture.env);

  assert.equal(response, doResponse);
  assert.equal(fixture.getForwardedRequest(), request);
  assert.equal(response.headers.get("X-Handshake"), "preserved");
});
