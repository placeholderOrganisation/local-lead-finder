// Worker key + SPA-fallback helpers (#46). No network.

import test from "node:test";
import assert from "node:assert/strict";
import { objectKey, shouldSpaFallback } from "../workers/site/src/worker.js";

test("objectKey maps / and trailing slash to index.html", () => {
  assert.equal(objectKey("/"), "index.html");
  assert.equal(objectKey("/ChIJ_test/"), "ChIJ_test/index.html");
  assert.equal(objectKey("/_next/static/x.js"), "_next/static/x.js");
  assert.equal(objectKey("/ChIJ_test/config.json"), "ChIJ_test/config.json");
});

test("shouldSpaFallback is true for lead prefix and client routes, false for missing assets", () => {
  assert.equal(shouldSpaFallback("/"), true);
  assert.equal(shouldSpaFallback("/ChIJ_test/"), true);
  assert.equal(shouldSpaFallback("/ChIJ_test"), true);
  assert.equal(shouldSpaFallback("/ChIJ_test/about"), true);
  assert.equal(shouldSpaFallback("/ChIJ_test/about/"), true);
  assert.equal(shouldSpaFallback("/ChIJ_test/config.json"), false);
  assert.equal(shouldSpaFallback("/ChIJ_test/missing.js"), false);
  assert.equal(shouldSpaFallback("/_next/static/x.js"), false);
});
