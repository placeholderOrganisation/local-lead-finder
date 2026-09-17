#!/usr/bin/env node
// Screenshot each deployed template → webp thumbnail in the mockup-scope bucket.
//
//   node scripts/shoot-mockups.mjs [--only <businessType|key>]
//
// Reads the deployed manifest.json, renders {base}/?t=<businessType>/<id> for
// every template, and uploads thumbs/<businessType>/<id>.webp. The widget shows
// these as the "3 directions"; a missing thumbnail just falls back to a themed
// card, so a browser-launch failure here is non-fatal.
//
// Prereq: deploy-mockups.mjs has run (app + manifest.json are live). Reuses
// src/r2.js putObject + src/env.js, and the system Chrome like seed-scope.

import { loadEnv, getCloudflareToken, getWorkersSubdomain } from "../src/env.js";
import { putObject } from "../src/r2.js";

loadEnv();

const args = process.argv.slice(2);
const onlyIdx = args.indexOf("--only");
const only = onlyIdx !== -1 ? String(args[onlyIdx + 1] || "") : "";

const BUCKET = "mockup-scope";
const VIEWPORT = { width: 1200, height: 900 }; // ~4:3, matches the widget thumb ratio

if (!getCloudflareToken()) {
  console.error("Missing CLOUDFLARE_API_TOKEN in .env — required to write to R2.");
  process.exit(1);
}
const subdomain = getWorkersSubdomain();
if (!subdomain) {
  console.error("Missing WORKERS_SUBDOMAIN in .env — needed to reach the deployed previews.");
  process.exit(1);
}
const base = `https://${BUCKET}.${subdomain.replace(/^\./, "")}`;

const res = await fetch(`${base}/manifest.json`, { cache: "no-store" });
if (!res.ok) {
  console.error(`Could not fetch ${base}/manifest.json (${res.status}). Deploy first: npm run deploy:scope`);
  process.exit(1);
}
let templates = await res.json();
if (only) {
  templates = templates.filter((t) => t.key === only || t.businessType === only);
  if (!templates.length) {
    console.error(`--only "${only}" matched no templates. Examples: professional, professional/meridian`);
    process.exit(1);
  }
}

console.log(`→ shooting ${templates.length} template thumbnail(s) into r2://${BUCKET}/thumbs/`);

let browser;
let sharp;
try {
  const puppeteer = (await import("puppeteer")).default;
  sharp = (await import("sharp")).default;
  const launchOpts = {
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  else launchOpts.channel = "chrome";
  browser = await puppeteer.launch(launchOpts);
} catch (err) {
  console.warn(`\n⚠ Could not launch a browser: ${String(err?.message || err).split("\n")[0]}`);
  console.warn("  Thumbnails skipped; the widget falls back to themed cards. Set PUPPETEER_EXECUTABLE_PATH and re-run.");
  process.exit(0);
}

try {
  for (const t of templates) {
    const url = `${base}/?t=${t.businessType}/${t.id}`;
    const page = await browser.newPage();
    try {
      await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 800)); // let fonts/render settle
      const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...VIEWPORT } });
      const webp = await sharp(png).webp({ quality: 78 }).toBuffer();
      const key = `thumbs/${t.businessType}/${t.id}.webp`;
      await putObject(BUCKET, key, webp, "image/webp", "public, max-age=300");
      console.log(`  ${key}  (${(webp.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.warn(`  ⚠ ${t.key}: ${String(err?.message || err).split("\n")[0]}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log("\n✓ thumbnails done.");
