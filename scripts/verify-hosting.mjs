#!/usr/bin/env node
// M5 hosting e2e (#49): live Worker 200 + config.json + SPA fallback + 404,
// compose CTA carries the Worker publicUrl, HOSTING_MODE rollback URL flips.
// Never fakes a pass — missing env / lead / config exits 1.

import { loadEnv, getHostingMode, getWorkersSubdomain } from "../src/env.js";
import { listLeads } from "../src/store.js";
import { close } from "../src/db.js";
import { publicUrlFor, r2Enabled } from "../src/r2.js";
import { mockOutreach } from "../src/compose.js";

loadEnv();

const ASH = "ChIJRypd4PlwXGcRLW6u6k17yu0";
let passed = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
  console.log("  ok - " + msg);
};

async function main() {
  const sub = getWorkersSubdomain();
  if (!sub) {
    console.error("Missing WORKERS_SUBDOMAIN — cannot verify Worker hosting.");
    process.exit(1);
  }
  if (!r2Enabled()) {
    console.error("R2 env is missing — cannot verify hosting.");
    process.exit(1);
  }
  ok(getHostingMode() === "worker", `HOSTING_MODE=${getHostingMode()} (want worker)`);

  const leads = await listLeads({});
  ok(leads.length > 0, `Mongo returned ${leads.length} leads`);
  const lead = leads.find((l) => l._id === ASH) || leads.find((l) => /ash tax/i.test(l.business || l.name || "")) || leads[0];
  ok(Boolean(lead?._id), `using ${lead._id} (${lead.business || lead.name})`);
  ok(Boolean(lead.mockup?.config?.business?.name), "reusing existing mockup.config (no OpenAI/Place Details)");

  const url = publicUrlFor(lead._id, lead.category || "accountant");
  ok(/https:\/\/mockup-accountant\.[^/]+\.workers\.dev\/.+\/$/.test(url), `worker publicUrl ${url}`);

  const stored = lead.mockup?.publicUrl || lead.mockup?.publicUrl || "";
  ok(stored === url || stored.includes("workers.dev"), `lead.mockup.publicUrl is Worker URL (${stored || "unset — using computed"})`);

  console.log("\n[1] live Worker");
  const page = await fetch(url);
  ok(page.ok, `GET ${url} → ${page.status}`);
  const html = await page.text();
  ok(/noindex/i.test(html), "HTML is noindex");
  ok(/Preview \/ mockup/i.test(html), "empty-shell title present (data comes from config.json)");

  const cfgRes = await fetch(new URL("config.json", url));
  ok(cfgRes.ok, `GET config.json → ${cfgRes.status}`);
  const cfg = await cfgRes.json();
  ok(cfg?.business?.name === lead.mockup.config.business.name, `config.json business.name = ${cfg?.business?.name}`);

  const spa = await fetch(new URL("about/", url));
  ok(spa.ok, `GET about/ SPA fallback → ${spa.status}`);
  ok(/text\/html/i.test(spa.headers.get("content-type") || ""), "SPA fallback is HTML");

  const miss = await fetch(new URL("_next/static/missing-asset.js", url));
  ok(miss.status === 404, `missing hashed asset → ${miss.status}`);

  console.log("\n[2] compose email CTA");
  const withUrl = {
    ...lead,
    mockup: { ...(lead.mockup || {}), publicUrl: url, publicUrl: url },
  };
  const assets = mockOutreach(withUrl);
  ok(String(assets.emailDraft?.body || "").includes(url), "email body contains the Worker publicUrl");

  console.log("\n[3] HOSTING_MODE rollback");
  const saved = process.env.HOSTING_MODE;
  try {
    process.env.HOSTING_MODE = "bucket";
    const bucketUrl = publicUrlFor(lead._id, lead.category || "accountant");
    ok(/\/index\.html$/.test(bucketUrl), `bucket mode URL ${bucketUrl}`);
    const legacy = await fetch(bucketUrl);
    ok(legacy.ok, `legacy public-bucket GET → ${legacy.status} (not deleted)`);
    process.env.HOSTING_MODE = "worker";
    ok(publicUrlFor(lead._id, "accountant") === url, "flipping back to worker restores Worker URL");
  } finally {
    if (saved === undefined) delete process.env.HOSTING_MODE;
    else process.env.HOSTING_MODE = saved;
  }

  console.log(`\nALL ${passed} HOSTING CHECKS PASSED`);
}

main()
  .catch((e) => {
    console.error("\n" + e.message + "\n");
    process.exitCode = 1;
  })
  .finally(() => close());
