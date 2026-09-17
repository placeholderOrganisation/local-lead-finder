#!/usr/bin/env node
// Deploy the v0-modern-design-mockups app to the mockup-scope R2 bucket.
//
//   node scripts/deploy-mockups.mjs [--skip-build]
//
// Builds the mockups Vite app (which also regenerates public/manifest.json) and
// uploads its dist/ to the bucket root. The mockup-scope Worker then serves the
// app statically; the professionals-repo widget fetches /manifest.json and the
// per-template thumbnails (added separately by shoot-mockups.mjs).
//
// Reuses src/r2.js putObject (retry-hardened) + src/env.js. The mockups repo is
// assumed to be a sibling under ~/Projects; override with MOCKUPS_DIR.

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, extname } from "node:path";
import { loadEnv, getCloudflareToken } from "../src/env.js";
import { putObject } from "../src/r2.js";

loadEnv();

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MOCKUPS_DIR = process.env.MOCKUPS_DIR || resolve(ROOT, "..", "v0-modern-design-mockups");
const DIST = join(MOCKUPS_DIR, "dist");
const BUCKET = "mockup-scope";
const skipBuild = process.argv.includes("--skip-build");

if (!getCloudflareToken()) {
  console.error("Missing CLOUDFLARE_API_TOKEN in .env — required to write to R2.");
  process.exit(1);
}
if (!existsSync(MOCKUPS_DIR)) {
  console.error(`Mockups repo not found at ${MOCKUPS_DIR}. Set MOCKUPS_DIR to its path.`);
  process.exit(1);
}

if (!skipBuild) {
  console.log(`→ building mockups app (${MOCKUPS_DIR})`);
  execSync("npm run build", { cwd: MOCKUPS_DIR, stdio: "inherit" });
}
if (!existsSync(DIST)) {
  console.error(`No dist/ at ${DIST}. Run without --skip-build.`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

// Hashed asset files (Vite puts them in assets/) can cache forever; the HTML
// shell and manifest must stay fresh so new deploys are picked up quickly.
const cacheFor = (key) => {
  if (key.startsWith("assets/")) return "public, max-age=31536000, immutable";
  if (key === "index.html" || key === "manifest.json") return "public, max-age=60";
  return "public, max-age=300";
};

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const files = walk(DIST);
console.log(`→ uploading ${files.length} file(s) to r2://${BUCKET}/`);

// Small concurrency pool; putObject already retries transient socket drops.
const CONCURRENCY = 4;
let i = 0;
async function worker() {
  while (i < files.length) {
    const full = files[i++];
    const key = relative(DIST, full).split("\\").join("/");
    const body = readFileSync(full);
    const type = MIME[extname(full).toLowerCase()] || "application/octet-stream";
    await putObject(BUCKET, key, body, type, cacheFor(key));
    console.log(`  ${key}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log("\n✓ deployed. Next: npm run seed:scope  (screenshot per-template thumbnails)");
