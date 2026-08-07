import { strict as assert } from "node:assert";
import test from "node:test";
import { getRadioCmpSchedule } from "./schedule-radiocmp";
import { getRadioPartySchedule } from "./schedule-radioparty";

test("both schedule routes reject a day outside 0-6", async () => {
  const request = new Request("https://example.com/api/schedule/test?day=7");
  const cmp = await getRadioCmpSchedule(request);
  const party = await getRadioPartySchedule(request);

  assert.equal(cmp.status, 400);
  assert.equal(party.status, 400);
  assert.deepEqual(await cmp.json(), {
    error: "Invalid day parameter. Must be 0-6 (0=Sunday)",
  });
});

test("Radio CMP preserves response fields and ten-minute cache", async () => {
  const response = await getRadioCmpSchedule(
    new Request("https://example.com/api/schedule/radiocmp?day=2"),
    async () => ({
      schedule: [{ time: "10:00", presenter: "DJ" }],
      notice: "notice",
      currentShow: { presenter: "DJ", show: "Show" },
    }),
  );

  assert.equal(response.headers.get("Cache-Control"), "public, max-age=600");
  assert.deepEqual(await response.json(), {
    success: true,
    day: 2,
    schedule: [{ time: "10:00", presenter: "DJ" }],
    notice: "notice",
    currentShow: { presenter: "DJ", show: "Show" },
  });
});

test("RadioParty preserves response fields and ten-minute cache", async () => {
  const response = await getRadioPartySchedule(
    new Request("https://example.com/api/schedule/radioparty?day=3"),
    async () => ({
      schedule: [{ time: "11:00", presenter: "DJ" }],
      currentShow: null,
    }),
  );

  assert.equal(response.headers.get("Cache-Control"), "public, max-age=600");
  assert.deepEqual(await response.json(), {
    success: true,
    day: 3,
    schedule: [{ time: "11:00", presenter: "DJ" }],
    currentShow: null,
  });
});
