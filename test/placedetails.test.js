// Place Details review mapping (#42). No network.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewsFromPlace, fetchReviews } from "../src/placedetails.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("reviewsFromPlace maps up to 5 verbatim quotes (originalText untouched)", () => {
  const verbatim = "Priya filed our T2 a week early. </script> no edits please.";
  const data = {
    rating: 4.9,
    userRatingCount: 87,
    reviews: [
      {
        rating: 5,
        originalText: { text: verbatim },
        text: { text: "TRANSLATED AND TRIMMED…" },
        relativePublishTimeDescription: "2 months ago",
        authorAttribution: { displayName: "Daniel M." },
      },
      {
        rating: 4,
        text: { text: "Clean books, no jargon." },
        relativePublishTimeDescription: "a year ago",
        authorAttribution: { displayName: "Lena T." },
      },
      { rating: 5, text: { text: "third" }, authorAttribution: { displayName: "A" } },
      { rating: 5, text: { text: "fourth" }, authorAttribution: { displayName: "B" } },
      { rating: 5, text: { text: "fifth" }, authorAttribution: { displayName: "C" } },
      { rating: 5, text: { text: "sixth should drop" }, authorAttribution: { displayName: "D" } },
    ],
  };
  const out = reviewsFromPlace(data);
  assert.equal(out.rating, 4.9);
  assert.equal(out.reviewCount, 87);
  assert.equal(out.reviews.length, 5);
  assert.equal(out.reviews[0].text, verbatim);
  assert.equal(out.reviews[0].author, "Daniel M.");
  assert.equal(out.reviews[0].relativeTime, "2 months ago");
  assert.equal(out.reviews[1].text, "Clean books, no jargon.");
  assert.ok(!out.reviews.some((r) => r.text.includes("sixth")));
});

test("fetchReviews fail-soft: no placeId → empty, no throw", async () => {
  const empty = await fetchReviews("");
  assert.deepEqual(empty.reviews, []);
  assert.equal(empty.rating, null);
});

test("worker.js and places.js never call Place Details / reviews", () => {
  const worker = readFileSync(join(ROOT, "src/worker.js"), "utf8");
  const places = readFileSync(join(ROOT, "src/places.js"), "utf8");
  assert.doesNotMatch(worker, /placedetails|fetchReviews/);
  assert.doesNotMatch(places, /placedetails|fetchReviews/);
  assert.doesNotMatch(places, /\/v1\/places\/\$\{/);
  assert.doesNotMatch(places, /X-Goog-FieldMask.*reviews/);
  assert.match(places, /places:searchText/);
});

test("template shows Reviews via Google attribution", () => {
  const app = readFileSync(join(ROOT, "template/accountant/components/designs/emerald.tsx"), "utf8");
  assert.match(app, /Reviews via Google/);
});
