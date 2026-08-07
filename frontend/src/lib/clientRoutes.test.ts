import { strict as assert } from "node:assert";
import test from "node:test";
import { getRouteStationName, getStationPath } from "./clientRoutes";

test("recognizes the home route", () => {
  assert.equal(getRouteStationName("/"), null);
});

test("decodes a station route and encodes station links", () => {
  assert.equal(getRouteStationName("/radio%20%C5%82%C3%B3d%C5%BA"), "radio łódź");
  assert.equal(getStationPath("radio łódź"), "/radio%20%C5%82%C3%B3d%C5%BA");
});

test("treats malformed and nested paths as unknown stations", () => {
  assert.equal(getRouteStationName("/%E0%A4%A"), null);
  assert.equal(getRouteStationName("/station/extra"), null);
});
