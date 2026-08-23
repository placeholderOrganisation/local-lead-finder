// Pure unit tests for the Bayesian, web-selling-correct lead scoring (#37).
// No DB / network. Run: node --test

import test from "node:test";
import assert from "node:assert/strict";
import { qualify, scoreLead, bayesianRating } from "../src/leads.js";

const place = (over) => ({
  displayName: { text: "Biz" },
  businessStatus: "OPERATIONAL",
  ...over,
});

test("bayesian rating pulls low-review ratings toward the 4.0 prior", () => {
  const fiveOne = bayesianRating(5, 1);
  const fourSixEightHundred = bayesianRating(4.6, 800);
  // 5★/1-review is dragged well below its face value...
  assert.ok(fiveOne < 4.2, `expected 5/1 (${fiveOne.toFixed(3)}) pulled below 4.2`);
  // ...and below the well-established 4.6/800 business.
  assert.ok(fiveOne < fourSixEightHundred, "5/1 must not beat 4.6/800 on adjusted rating");
});

test("a 5★/1-review lead does NOT outrank a 4.6★/800-review lead (equal website status)", () => {
  const thin = scoreLead({ rating: 5, reviews: 1, website: "https://thin.example" });
  const solid = scoreLead({ rating: 4.6, reviews: 800, website: "https://solid.example" });
  assert.ok(solid.score > thin.score, `4.6/800 (${solid.score}) must beat 5/1 (${thin.score})`);
});

test("no-website lead scores HIGHER priority than an equivalent has-website lead (inverted signal)", () => {
  const noSite = scoreLead({ rating: 4.5, reviews: 50, website: "" });
  const hasSite = scoreLead({ rating: 4.5, reviews: 50, website: "https://has.example" });
  assert.ok(noSite.score > hasSite.score, "no-website must outscore has-website");
  assert.ok(noSite.priority > hasSite.priority, "no-website must outrank has-website on priority");
});

test("established review volume boosts the score", () => {
  const established = scoreLead({ rating: 4.5, reviews: 500, website: "https://a.example" });
  const fresh = scoreLead({ rating: 4.5, reviews: 5, website: "https://a.example" });
  assert.ok(established.score > fresh.score, "500 reviews must outscore 5 reviews at equal rating");
});

test("scoreLead exposes explainable factors and a numeric priority", () => {
  const s = scoreLead({ rating: 4.5, reviews: 50, website: "" });
  assert.ok(Array.isArray(s.factors) && s.factors.length >= 3, "factors[] present");
  assert.ok(s.factors.every((f) => typeof f.label === "string" && typeof f.points === "number"), "factors shaped {label,points}");
  assert.ok(Number.isFinite(s.priority) && s.priority >= 1 && s.priority <= 5, "priority in 1..5");
});

test("non-operational businesses sink to a zero score", () => {
  const dead = scoreLead({ rating: 4.8, reviews: 300, website: "", operational: false });
  assert.equal(dead.score, 0, "closed business scores 0");
});

test("qualify() attaches Bayesian scoring end-to-end and preserves ordering", () => {
  const thin = qualify(place({ rating: 5, userRatingCount: 1, websiteUri: "https://thin.example" }));
  const solid = qualify(place({ rating: 4.6, userRatingCount: 800, websiteUri: "https://solid.example" }));
  const noSite = qualify(place({ rating: 4.5, userRatingCount: 50 })); // no websiteUri
  const hasSite = qualify(place({ rating: 4.5, userRatingCount: 50, websiteUri: "https://has.example" }));

  assert.ok(typeof thin.bayesRating === "number" && Array.isArray(thin.factors), "qualify surfaces bayesRating + factors");
  assert.ok(solid.score > thin.score, "qualify: 4.6/800 beats 5/1");
  assert.ok(noSite.priority > hasSite.priority, "qualify: no-website beats has-website on priority");
});
