#!/usr/bin/env node
// M4 mockup e2e (#45): build window.SITE for a real lead, serve /preview/,
// assert XSS escaping + no external asset requests, and (when R2 env is set)
// publish and GET the public URL. A child run with R2 vars stripped proves
// publish is skipped cleanly when hosting is not configured.
//
// Usage:  npm run verify:mockup
// Never fakes a pass — missing Mongo / leads exits 1.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "../src/env.js";
import { listLeads, getLead, saveMockup } from "../src/store.js";
import { close } from "../src/db.js";
import { buildSiteConfig } from "../src/mockup.js";
import { r2Enabled, publishMockup } from "../src/r2.js";
import { getHostingMode } from "../src/env.js";
import { serializeConfigJs } from "../src/site-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "MOCKUP_PUBLIC_BASE",
];

loadEnv();

let passed = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
  console.log("  ok - " + msg);
};

const ASSET_URL = /<(?:script|link|img|iframe|source)\b[^>]*(?:src|href)\s*=\s*["']https?:/i;
const CSS_REMOTE = /url\(\s*["']?https?:/i;

async function main() {
  if (process.argv.includes("--r2-off")) {
    ok(!r2Enabled(), "r2Enabled() is false when R2 env is absent");
    const url = await publishMockup("verify-skip", { meta: { placeId: "verify-skip" } });
    ok(url == null, "publishMockup returns null when R2 is off (no throw)");
    console.log(`\nR2-OFF ${passed} CHECKS PASSED`);
    return;
  }

  const leads = await listLeads({});
  ok(leads.length > 0, `Mongo returned ${leads.length} leads`);
  const preferred = "ChIJRypd4PlwXGcRLW6u6k17yu0";
  const lead = leads.find((l) => l._id === preferred) || leads[0];
  ok(Boolean(lead?._id), `using lead ${lead._id} (${lead.business || lead.name || "unnamed"})`);

  console.log("\n[1] buildSiteConfig — facts + copy + reviews, persisted as config not HTML");
  const site = await buildSiteConfig(lead);
  ok(site?.business?.name, "SITE.business.name is set");
  ok(typeof site.copy?.heroHeadline === "string" && site.copy.heroHeadline.length > 0, "SITE.copy.heroHeadline is set");
  ok(typeof site.copy?.about === "string" && site.copy.about.length > 0, "SITE.copy.about is set");
  ok(Array.isArray(site.copy?.services) && site.copy.services.length >= 1, "SITE.copy.services has items");
  ok(Array.isArray(site.copy?.faq) && site.copy.faq.length >= 1, "SITE.copy.faq has items");
  ok(Array.isArray(site.reviews) && site.reviews.length <= 5, "SITE.reviews is an array of at most 5");
  ok(site.meta?.placeId === lead._id, "SITE.meta.placeId matches the lead");
  ok(!Object.prototype.hasOwnProperty.call(site, "html") || !site.html, "SITE has no html field");

  const stored = await getLead(lead._id);
  ok(stored?.mockup?.config?.business?.name === site.business.name, "mockup.config persisted on the lead");
  ok(!stored.mockup.html && !stored.mockup.html, "lead.mockup.html is not stored");

  console.log("\n[2] serializeConfigJs — XSS escaping");
  const sneaky = serializeConfigJs({
    ...site,
    copy: { ...site.copy, about: `${site.copy.about} </script><img src=x onerror=alert(1)>` },
  });
  ok(sneaky.startsWith("window.SITE = "), "config.js assigns window.SITE");
  ok(!sneaky.includes("</script>"), "serialized config does not contain a raw </script>");
  ok(!sneaky.includes("<img"), "serialized config escapes <");

  console.log("\n[3] /preview/:placeId/ — renders template, escaped, no external requests");
  const port = Number(process.env.VERIFY_MOCKUP_PORT) || 4011;
  const base = `http://127.0.0.1:${port}`;
  const child = await startDashboard(port);
  try {
    const indexRes = await fetch(`${base}/preview/${encodeURIComponent(lead._id)}/`);
    ok(indexRes.ok, `GET /preview/:id/ → ${indexRes.status}`);
    const html = await indexRes.text();
    ok(/noindex/i.test(html), "preview HTML is noindex");
    ok(/Preview \/ mockup/i.test(html), "preview title/banner is present");
    ok(!ASSET_URL.test(html), "preview HTML has no external script/link/img/iframe URLs");
    ok(!CSS_REMOTE.test(html), "preview HTML has no remote CSS url()");

    const jsonRes = await fetch(`${base}/preview/${encodeURIComponent(lead._id)}/config.json`);
    ok(jsonRes.ok, `GET /preview/:id/config.json → ${jsonRes.status}`);
    const cfg = await jsonRes.json();
    ok(cfg?.business?.name === site.business.name, "preview config.json includes the business name");

    const absCfg = await fetch(`${base}/${encodeURIComponent(lead._id)}/config.json`);
    ok(absCfg.ok, `GET /:id/config.json (absolute, Next contract) → ${absCfg.status}`);

    const nextAsset = html.match(/\/_next\/static\/[^"']+/);
    ok(nextAsset, "preview HTML references /_next/static/…");
    const nextRes = await fetch(`${base}${nextAsset[0]}`);
    ok(nextRes.ok, `GET ${nextAsset[0]} → ${nextRes.status}`);

    const about = await fetch(`${base}/preview/${encodeURIComponent(lead._id)}/about/`);
    ok(about.ok, `GET /preview/:id/about/ SPA fallback → ${about.status}`);

    const redir = await fetch(`${base}/mockup/${encodeURIComponent(lead._id)}`, { redirect: "manual" });
    ok(redir.status === 302, `GET /mockup/:id redirects (${redir.status})`);
    ok(
      String(redir.headers.get("location") || "").includes(`/preview/${encodeURIComponent(lead._id)}/`),
      "legacy /mockup/:id points at /preview/:id/"
    );
  } finally {
    await stop(child);
  }

  console.log("\n[4] R2 publish (when configured)");
  if (r2Enabled()) {
    const publicUrl = await publishMockup(lead._id, stored.mockup.config, lead.category);
    if (getHostingMode() === "worker") {
      ok(typeof publicUrl === "string" && /workers\.dev\/.+\/$/.test(publicUrl), `published ${publicUrl}`);
      const live = await fetch(publicUrl);
      ok(live.ok, `public URL GET → ${live.status}`);
      const liveHtml = await live.text();
      ok(/noindex/i.test(liveHtml), "public page is noindex");
      const cfgUrl = new URL("config.json", publicUrl).href;
      const liveCfg = await fetch(cfgUrl);
      ok(liveCfg.ok, `public config.json GET → ${liveCfg.status}`);
      const liveJson = await liveCfg.json();
      ok(liveJson?.business?.name === site.business.name, "public config.json is personalized");
    } else {
      ok(typeof publicUrl === "string" && publicUrl.includes("/index.html"), `published ${publicUrl}`);
      const live = await fetch(publicUrl);
      ok(live.ok, `public URL GET → ${live.status}`);
      const liveHtml = await live.text();
      ok(/Reviews via Google/i.test(liveHtml), "public page has Reviews via Google");
      const cfgUrl = publicUrl.replace(/index\.html$/i, "config.js");
      const liveCfg = await fetch(cfgUrl);
      ok(liveCfg.ok, `public config.js GET → ${liveCfg.status}`);
      const liveJs = await liveCfg.text();
      ok(liveJs.includes(site.business.name), "public config.js is personalized");
    }
    const after = await saveMockup(lead._id, {
      config: stored.mockup.config,
      generatedAt: stored.mockup.generatedAt,
      model: stored.mockup.model,
      publicUrl,
    });
    ok(after?.mockup?.publicUrl === publicUrl, "publicUrl persisted on the lead");
  } else {
    console.log("  skip - R2 env not set (publish not required for this run)");
    ok(true, "R2 skipped because env is not configured");
  }

  console.log("\n[5] R2 env absent → skip publish without error");
  await runR2OffChild();

  console.log(`\nALL ${passed} MOCKUP E2E CHECKS PASSED`);
}

function startDashboard(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/server.js"], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    const onOut = (chunk) => {
      buf += chunk.toString();
      if (/dashboard/i.test(buf)) {
        child.stdout.off("data", onOut);
        resolve(child);
      }
    };
    child.stdout.on("data", onOut);
    child.stderr.on("data", (c) => {
      buf += c.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code && code !== 0) reject(new Error(`dashboard exited ${code}: ${buf}`));
    });
    setTimeout(() => reject(new Error("dashboard did not start:\n" + buf)), 15_000);
  });
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    child.on("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      resolve();
    }, 2000);
  });
}

function runR2OffChild() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    // Empty (not deleted) so loadEnv() will not refill them from .env.
    for (const k of R2_KEYS) env[k] = "";
    env.HOSTING_MODE = "bucket";
    env.VERIFY_MOCKUP_NESTED = "1";
    const child = spawn(process.execPath, ["scripts/verify-mockup.mjs", "--r2-off"], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (c) => {
      out += c;
      process.stdout.write(c);
    });
    child.stderr.on("data", (c) => {
      out += c;
      process.stderr.write(c);
    });
    child.on("exit", (code) => {
      if (code === 0) {
        passed++;
        console.log("  ok - nested --r2-off run passed");
        resolve();
      } else {
        reject(new Error(`--r2-off child exited ${code}\n${out}`));
      }
    });
  });
}

main()
  .catch((e) => {
    console.error("\n" + e.message + "\n");
    process.exitCode = 1;
  })
  .finally(() => close());
