import { expect, test } from "bun:test";
import { getMobileDayMenuPosition } from "./mobileDayMenuPosition";

test("places the day menu below the trigger when it fits above the player", () => {
  expect(
    getMobileDayMenuPosition(
      { left: 16, top: 120, bottom: 168, width: 328 },
      800,
    ),
  ).toEqual({ left: 16, top: 176, width: 328, maxHeight: 288 });
});

test("keeps the day menu below the trigger when little room remains", () => {
  expect(
    getMobileDayMenuPosition(
      { left: 16, top: 500, bottom: 548, width: 328 },
      640,
    ),
  ).toEqual({ left: 16, top: 556, width: 328, maxHeight: 76 });
});
