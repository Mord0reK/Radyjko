import { strict as assert } from "node:assert";
import test from "node:test";
import { getStations } from "./stations";

test("queries env.DB and returns the station array unchanged", async () => {
  const stations = [{ id: 1, name: "Test", shortName: "test" }];
  let sql = "";
  const db = {
    prepare(query: string) {
      sql = query;
      return { all: async () => ({ results: stations }) };
    },
  };

  const response = await getStations(
    new Request("https://example.com/api/stations"),
    { DB: db as unknown as D1Database },
  );

  assert.equal(response.status, 200);
  assert.match(sql, /FROM stations/);
  assert.deepEqual(await response.json(), stations);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("returns a controlled error without DB binding", async () => {
  const response = await getStations(
    new Request("https://example.com/api/stations"),
    {},
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Database binding not found" });
});
