import { strict as assert } from "node:assert";
import test from "node:test";
import { shouldSchedulePollingAlarm } from "./alarmSchedule";

test("schedules polling when no alarm exists", () => {
  assert.equal(shouldSchedulePollingAlarm(null, 20_000), true);
});

test("replaces an alarm left too far in the future", () => {
  assert.equal(shouldSchedulePollingAlarm(365 * 24 * 60 * 60 * 1000, 20_000), true);
});

test("keeps an alarm that will run before the next polling deadline", () => {
  assert.equal(shouldSchedulePollingAlarm(15_000, 20_000), false);
});
