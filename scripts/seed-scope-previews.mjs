#!/usr/bin/env node
// Seed the "Scope your site" leaf-node previews into the mockup-scope bucket.
//
//   node scripts/seed-scope-previews.mjs [--only <slug|businessType>] [--no-shots]
//
// Steps per leaf (businessType × mainJob):
//   1. PUT {slug}/config.json          (always — the shareable preview data)
//   2. screenshot {base}/{slug}/?design=1|2|3 → PUT {slug}/thumb-{n}.webp
//      (best-effort: needs a launchable Chrome; skipped with a warning otherwise)
//
// Prereqs: the shared template must already be deployed to the bucket root
//   (npm run deploy:site -- scope --template accountant), and CLOUDFLARE_API_TOKEN
//   + R2 env present in .env. The worker base is derived from WORKERS_SUBDOMAIN.

import { loadEnv, getCloudflareToken, getWorkersSubdomain } from "../src/env.js";
import { putObject } from "../src/r2.js";
import { allLeaves, buildLeafConfig } from "../data/scope-previews/leaves.js";

loadEnv();

const args = process.argv.slice(2);
const onlyIdx = args.indexOf("--only");
const only = onlyIdx !== -1 ? String(args[onlyIdx + 1] || "") : "";
const noShots = args.includes("--no-shots");

const BUCKET = "mockup-scope";
const DESIGNS = [1, 2, 3];
const VIEWPORT = { width: 1200, height: 900 }; // ~4:3, matches the widget thumb ratio

if (!getCloudflareToken()) {
  console.error("Missing CLOUDFLARE_API_TOKEN in .env — required to write to R2.");
  process.exit(1);
}

const subdomain = getWorkersSubdomain();
if (!subdomain && !noShots) {
  console.error("Missing WORKERS_SUBDOMAIN in .env — needed to screenshot live previews. Re-run with --no-shots to upload configs only.");
  process.exit(1);
}
const base = subdomain ? `https://${BUCKET}.${subdomain.replace(/^\./, "")}` : "";

let leaves = allLeaves();
if (only) {
  leaves = leaves.filter((l) => l.slug === only || l.businessType === only);
  if (!leaves.length) {
    console.error(`--only "${only}" matched no leaves. Examples: salon-bookings, salon`);
    process.exit(1);
  }
}

console.log(`→ seeding ${leaves.length} leaf preview(s) into r2://${BUCKET}/`);

// 1. Upload every config.json first (cheap, always works).
for (const { businessType, mainJob, slug } of leaves) {
  const config = buildLeafConfig(businessType, mainJob);
  const body = JSON.stringify(config);
  await putObject(BUCKET, `${slug}/config.json`, body, "application/json; charset=utf-8", "public, max-age=60");
  console.log(`  ${slug}/config.json`);
}

if (noShots) {
  console.log("\nSkipped screenshots (--no-shots). Configs uploaded.");
  printLinks(leaves, base);
  process.exit(0);
}

// 2. Best-effort screenshots. A browser launch failure (e.g. no compatible
//    Chrome on this OS) is non-fatal: configs are already up, and the widget
//    falls back to a themed card for any missing thumbnail.
let browser;
let sharp;
try {
  const puppeteer = (await import("puppeteer")).default;
  sharp = (await import("sharp")).default;
  // Prefer the system Chrome (channel) — the bundled Chrome-for-Testing may not
  // run on older macOS. Override with PUPPETEER_EXECUTABLE_PATH if needed.
  const launchOpts = {
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  else launchOpts.channel = "chrome";
  browser = await puppeteer.launch(launchOpts);
} catch (err) {
  console.warn(`\n⚠ Could not launch a browser for screenshots: ${String(err?.message || err).split("\n")[0]}`);
  console.warn("  Configs are uploaded; thumbnails skipped. Set PUPPETEER_EXECUTABLE_PATH to a working Chrome and re-run to add them.");
  printLinks(leaves, base);
  process.exit(0);
}

try {
  for (const { slug } of leaves) {
    for (const design of DESIGNS) {
      const url = `${base}/${slug}/?design=${design}`;
      const page = await browser.newPage();
      try {
        await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 2 });
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        // Let the SPA fetch config.json and render the chosen theme.
        await new Promise((r) => setTimeout(r, 1200));
        const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...VIEWPORT } });
        const webp = await sharp(png).webp({ quality: 78 }).toBuffer();
        await putObject(BUCKET, `${slug}/thumb-${design}.webp`, webp, "image/webp", "public, max-age=300");
        console.log(`  ${slug}/thumb-${design}.webp  (${(webp.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.warn(`  ⚠ ${slug} design ${design}: ${String(err?.message || err).split("\n")[0]}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

printLinks(leaves, base);

function printLinks(leaves, base) {
  if (!base) return;
  console.log("\nLive previews:");
  for (const { slug } of leaves.slice(0, 6)) console.log(`  ${base}/${slug}/`);
  if (leaves.length > 6) console.log(`  … and ${leaves.length - 6} more`);
}
