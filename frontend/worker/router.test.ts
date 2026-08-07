import { strict as assert } from "node:assert";
import test from "node:test";
import { routeApiRequest, type ApiRoutes } from "./router";

const routes: ApiRoutes<Record<string, never>> = {
  "/api/stations": {
    GET: async () => Response.json([]),
    OPTIONS: async () => new Response(null, { status: 204 }),
  },
};

test("returns JSON 404 for an unknown API route", async () => {
  const response = await routeApiRequest(
    new Request("https://example.com/api/unknown"),
    {},
    {} as ExecutionContext,
    routes,
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
});

test("returns 405 and Allow for an unsupported method", async () => {
  const response = await routeApiRequest(
    new Request("https://example.com/api/stations", { method: "POST" }),
    {},
    {} as ExecutionContext,
    routes,
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, OPTIONS");
  assert.deepEqual(await response.json(), { error: "Method not allowed" });
});
