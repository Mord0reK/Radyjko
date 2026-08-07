import assert from "node:assert/strict";
import test from "node:test";

import { getReconnectDelay } from "./reconnect";

test("increases reconnect delays and caps them at 15 seconds", () => {
  assert.equal(getReconnectDelay(0), 1_000);
  assert.equal(getReconnectDelay(1), 2_000);
  assert.equal(getReconnectDelay(4), 15_000);
  assert.equal(getReconnectDelay(20), 15_000);
});
