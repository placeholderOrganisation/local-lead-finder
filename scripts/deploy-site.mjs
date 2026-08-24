#!/usr/bin/env node
// npm run deploy:site -- <type>
// Create mockup-<type> bucket, Next static export, upload out/ to bucket root, deploy Worker.

import { spawnSync } from "node:child_process";
import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { getCloudflareToken, getR2Config, getWorkersSubdomain, loadEnv } from "../src/env.js";
import { putObject, r2Enabled } from "../src/r2.js";
import { mimeFor } from "../src/site-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const type = slug(process.argv[2] || "");

loadEnv();

if (!type) {
  console.error("Usage: npm run deploy:site -- <type>   e.g. accountant");
  process.exit(1);
}

const token = getCloudflareToken();
if (!token) {
  console.error("Missing CLOUDFLARE_API_TOKEN (or CLOUDFLARE_API_TOKEN) in .env");
  process.exit(1);
}
if (!r2Enabled()) {
  const c = getR2Config();
  console.error("Missing R2 S3 creds. Need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, MOCKUP_PUBLIC_BASE.");
  console.error(`  accountId=${c.accountId ? "ok" : "missing"} bucket=${c.bucket || "missing"}`);
  process.exit(1);
}

const subdomain = getWorkersSubdomain();
if (!subdomain) {
  console.error("Missing WORKERS_SUBDOMAIN (or WORKERS_SUBDOMAIN) in .env — e.g. your-name.workers.dev");
  process.exit(1);
}

const templateDir = join(ROOT, "template", type);
const pkg = join(templateDir, "package.json");
if (!existsSync(pkg)) {
  console.error(`No Next app at template/${type}/ (missing package.json)`);
  process.exit(1);
}

const bucket = `mockup-${type}`;
const wranglerDir = join(ROOT, "workers", "site");
const wranglerEnv = { ...process.env, CLOUDFLARE_API_TOKEN: token };

console.log(`→ ensure R2 bucket ${bucket}`);
const created = wrangler(["r2", "bucket", "create", bucket], ROOT);
if (created.status !== 0) {
  const msg = (created.stdout || "") + (created.stderr || "");
  if (!/already exists|409/i.test(msg)) {
    console.error(msg);
    process.exit(created.status || 1);
  }
  console.log(`  bucket exists (ok)`);
}

console.log(`→ npm --prefix template/${type} install`);
run("npm", ["install"], templateDir);

console.log(`→ npm --prefix template/${type} run build`);
run("npm", ["run", "build"], templateDir);

const outDir = join(templateDir, "out");
if (!existsSync(join(outDir, "index.html"))) {
  console.error(`Build did not produce template/${type}/out/index.html`);
  process.exit(1);
}

// Cloudflare's API WAF blocks object keys containing `..` (Next/Turbopack
// sometimes emits chunks like `hash..js`). Rename and rewrite references.
await sanitizeOutDir(outDir);

console.log(`→ upload out/ → r2://${bucket}/`);
const files = await walkFiles(outDir);
const CONCURRENCY = 4;
for (let i = 0; i < files.length; i += CONCURRENCY) {
  const slice = files.slice(i, i + CONCURRENCY);
  await Promise.all(
    slice.map(async (abs) => {
      const key = relative(outDir, abs).split("\\").join("/");
      const body = await readFile(abs);
      const cache = cacheControlFor(key);
      await putObject(bucket, key, body, mimeFor(abs), cache);
      console.log(`  ${key}  (${cache.includes("immutable") ? "immutable" : "short"})`);
    })
  );
}

console.log(`→ wrangler deploy -e ${type}`);
const deployed = wrangler(["deploy", "-e", type], wranglerDir);
if (deployed.status !== 0) {
  console.error(deployed.stdout + deployed.stderr);
  process.exit(deployed.status || 1);
}
process.stdout.write(deployed.stdout);
if (deployed.stderr) process.stderr.write(deployed.stderr);

const wranglerUrl = `${deployed.stdout || ""}${deployed.stderr || ""}`.match(
  /https:\/\/[a-z0-9.-]+\.workers\.dev/i
);
const url = (wranglerUrl ? wranglerUrl[0] : `https://${bucket}.${subdomain}`).replace(/\/?$/, "/");
if (wranglerUrl && subdomain && !wranglerUrl[0].includes(`.${subdomain.replace(/^\./, "")}`) && !wranglerUrl[0].endsWith(`.${subdomain}`)) {
  console.warn(`Note: wrangler deployed to ${wranglerUrl[0]} (WORKERS_SUBDOMAIN=${subdomain}). Using wrangler URL.`);
}
console.log(`\nLive: ${url}`);

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

async function sanitizeOutDir(dir) {
  const files = await walkFiles(dir);
  const renames = [];
  for (const abs of files) {
    const name = basename(abs);
    if (!name.includes("..")) continue;
    const safe = name.replace(/\.\.+/g, "._.");
    const dest = join(dirname(abs), safe);
    await rename(abs, dest);
    renames.push({ from: name, to: safe });
    console.log(`  sanitize ${name} → ${safe}`);
  }
  if (!renames.length) return;
  const textExt = new Set([".html", ".js", ".css", ".json", ".txt", ".map", ".xml", ".svg"]);
  for (const abs of await walkFiles(dir)) {
    if (!textExt.has(extname(abs).toLowerCase())) continue;
    let text = await readFile(abs, "utf8");
    let changed = false;
    for (const { from, to } of renames) {
      if (text.includes(from)) {
        text = text.split(from).join(to);
        changed = true;
      }
    }
    if (changed) await writeFile(abs, text);
  }
}

function cacheControlFor(key) {
  const k = key.replace(/\\/g, "/");
  if (k === "index.html" || k.endsWith("/index.html") || extname(k) === ".html") {
    return "public, max-age=60";
  }
  if (k.includes("_next/static/")) return "public, max-age=31536000, immutable";
  return "public, max-age=300";
}

async function walkFiles(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const abs = join(dir, name);
    const st = await stat(abs);
    if (st.isDirectory()) out.push(...(await walkFiles(abs)));
    else if (st.isFile()) out.push(abs);
  }
  return out;
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, env: process.env, encoding: "utf8", stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}

function wrangler(args, cwd) {
  return spawnSync("npx", ["wrangler", ...args], {
    cwd,
    env: wranglerEnv,
    encoding: "utf8",
  });
}
