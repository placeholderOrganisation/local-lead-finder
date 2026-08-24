// Local stand-in for `wrangler dev` on hosts where workerd cannot run (macOS < 13.5).
// Exercises workers/site/src/worker.js against an in-memory R2 mock.

import { objectKey } from "../workers/site/src/worker.js";
import worker from "../workers/site/src/worker.js";

const FILES = new Map([
  [
    "index.html",
    {
      body: "<!doctype html><title>shared index</title>",
      type: "text/html; charset=utf-8",
    },
  ],
  [
    "_next/static/seed.js",
    { body: "console.log(1)", type: "text/javascript; charset=utf-8" },
  ],
  [
    "ChIJ_test/config.json",
    { body: '{"business":{"name":"Seed Lead"}}', type: "application/json" },
  ],
]);

class FakeObject {
  constructor(key, rec) {
    this.key = key;
    this.body = rec.body;
    this.httpEtag = `"${key}"`;
    this.type = rec.type;
  }
  writeHttpMetadata(headers) {
    headers.set("content-type", this.type);
  }
}

const env = {
  BUCKET: {
    async get(key) {
      const rec = FILES.get(key);
      return rec ? new FakeObject(key, rec) : null;
    },
  },
};

async function req(path) {
  const res = await worker.fetch(new Request("https://mockup-accountant.test" + path), env);
  const text = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", text, etag: res.headers.get("etag") };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const index = await req("/ChIJ_test/");
assert(index.status === 200, `/{placeId}/ → ${index.status}`);
assert(index.text.includes("shared index"), `/{placeId}/ body: ${index.text}`);
assert(objectKey("/ChIJ_test/") === "ChIJ_test/index.html", "trailing slash key");

const asset = await req("/_next/static/seed.js");
assert(asset.status === 200, `/_next → ${asset.status}`);
assert(asset.text.includes("console.log"), "/_next body");

const cfg = await req("/ChIJ_test/config.json");
assert(cfg.status === 200, `config.json → ${cfg.status}`);
assert(cfg.text.includes("Seed Lead"), "config body");
assert(cfg.type.includes("json"), `config type ${cfg.type}`);

const spa = await req("/ChIJ_test/about");
assert(spa.status === 200, `spa route → ${spa.status}`);
assert(spa.text.includes("shared index"), "spa fallback is root index.html");

const spa2 = await req("/ChIJ_test/about/");
assert(spa2.status === 200 && spa2.text.includes("shared index"), "spa trailing slash");

const missing = await req("/ChIJ_test/missing.js");
assert(missing.status === 404, `missing.js → ${missing.status} (want 404, no loop)`);

const missingNext = await req("/_next/static/nope.js");
assert(missingNext.status === 404, `missing hashed asset → ${missingNext.status}`);

console.log("worker fetch checks passed:");
console.log("  GET /ChIJ_test/            200 index.html");
console.log("  GET /_next/static/seed.js  200");
console.log("  GET /ChIJ_test/config.json 200 per-lead");
console.log("  GET /ChIJ_test/about       200 index.html (SPA)");
console.log("  GET /ChIJ_test/missing.js  404");
