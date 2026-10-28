import test from "node:test";
import assert from "node:assert/strict";
import { recommend, distanceMeters } from "../backend/src/recommendation.js";
import { wgs84ToGcj02 } from "../frontend/src/services/coordinates.js";
import { number, text } from "../backend/src/http.js";
const origin = {
  lng: 121.4737,
  lat: 31.2304,
  radius: 1500,
  keyword: "",
  budget: null,
};
const restaurant = {
  id: 1,
  sourceId: "a",
  lng: 121.474,
  lat: 31.2304,
  price: 38,
  reviewCount: 0,
  averageRating: null,
};
test("distance changes with the search origin, no persisted distance is used", () => {
  assert.equal(distanceMeters(origin, origin), 0);
  assert.ok(distanceMeters(origin, restaurant) > 0);
  assert.equal(recommend([restaurant], { ...origin, lng: 120 }).length, 0);
});
test("budget excludes unknown prices; no invented value enters ranking", () => {
  const unknown = { ...restaurant, id: 2, sourceId: "b", price: null };
  assert.equal(recommend([unknown], origin)[0].price, null);
  assert.equal(recommend([unknown], { ...origin, budget: 50 }).length, 0);
  assert.equal(recommend([restaurant], { ...origin, budget: 30 }).length, 0);
});
test("onsite ratings only contribute once 3 reviews exist; explanation agrees", () => {
  const two = recommend(
    [{ ...restaurant, reviewCount: 2, averageRating: 5 }],
    origin,
  )[0];
  const three = recommend(
    [{ ...restaurant, reviewCount: 3, averageRating: 5 }],
    origin,
  )[0];
  assert.equal(two.scoreBreakdown.reviews, 0);
  assert.equal(three.scoreBreakdown.reviews, 20);
  assert.match(two.reasons.join(" "), /不足 3 条/);
  assert.match(three.reasons.join(" "), /3 条评价/);
});
test("WGS84 conversion preserves outside-China coordinates and offsets Shanghai", () => {
  assert.deepEqual(wgs84ToGcj02(-74, 40), { lng: -74, lat: 40 });
  const converted = wgs84ToGcj02(121.4737, 31.2304);
  assert.ok(converted.lng > 121.477 && converted.lng < 121.48);
  assert.ok(converted.lat > 31.227 && converted.lat < 31.23);
});
test("input validation rejects coercion surprises and unsupported ranges", () => {
  for (const value of ["", null, undefined, true, [], {}, " ", Infinity, "NaN"])
    assert.throws(() => number(value, "n", 1, 5));
  assert.throws(() => number(1.5, "n", 1, 5, true));
  assert.throws(() => text("   ", "comment", 5, 500));
  assert.equal(number("3", "n", 1, 5, true), 3);
});
