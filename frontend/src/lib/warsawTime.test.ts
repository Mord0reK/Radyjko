import assert from "node:assert/strict";
import test from "node:test";

import { getWarsawDateTime } from "./warsawTime";

test("converts winter UTC time to Europe/Warsaw", () => {
  assert.deepEqual(getWarsawDateTime(new Date("2026-01-12T23:30:00Z")), {
    day: 2,
    time: "00:30",
  });
});

test("converts summer UTC time to Europe/Warsaw", () => {
  assert.deepEqual(getWarsawDateTime(new Date("2026-07-13T22:15:00Z")), {
    day: 2,
    time: "00:15",
  });
});
