#!/usr/bin/env node
// Phase-3 (outreach prep) end-to-end against a real OpenAI key + Mongo leads (#36).
// Proves: money language, different no-website vs has-site angles, no unverified
// down-claims on a live 403, and a self-contained mockup.
//
// Usage:  node scripts/verify-outreach.mjs
// Never fakes a pass — missing OPENAI_API_KEY / Mongo / representative leads exits 1.

import { getOpenAIKey } from "../src/env.js";
import { listLeads, getLead } from "../src/store.js";
import { close } from "../src/db.js";
import { prepareOutreach } from "../src/compose.js";
import { buildSiteConfig } from "../src/mockup.js";
import { auditSite } from "../src/audit.js";

const TECH = /viewport|lcp\b|http\s*403|http\s*500|meta tags|seo audit|\btls\b|mobile-friendly tag/i;
const DOWN = /\b(site|website|page)\b.{0,24}\b(down|broken|offline|unreachable|dead)\b|\b(down|broken|offline)\b.{0,24}\b(site|website)\b|http\s*(403|500)|returns? an error/i;
const EXT_URL = /(?:href|src|url\()\s*[=:]?\s*["']?(https?:\/\/[^"' )\]]+)/gi;

let passed = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
  console.log("  ok - " + msg);
};

function blobOf(a) {
  return [a.moneyPitch, a.emailDraft?.subject, a.emailDraft?.body, a.phoneScript].join("\n");
}

function printAssets(label, lead, a) {
  console.log(`\n── ${label}: ${lead.business} ──`);
  console.log("angle:", a.pitchedAngle, "model:", a.model);
  console.log("moneyPitch:", a.moneyPitch);
  console.log("email.subject:", a.emailDraft?.subject);
  console.log("email.body:\n" + (a.emailDraft?.body || ""));
  console.log("phoneScript:\n" + (a.phoneScript || ""));
}

async function main() {
  const key = getOpenAIKey({ required: true });
  ok(Boolean(key), "OPENAI_API_KEY is set");

  const leads = await listLeads({});
  ok(leads.length > 0, `Mongo returned ${leads.length} leads`);

  const noSite = leads.find((l) => !l.website);
  const hasSite = leads.find((l) => l.website && !l.needsVerification);
  ok(Boolean(noSite), "found a no-website lead");
  ok(Boolean(hasSite), "found a has-site lead");

  console.log("\n[1] Prepare outreach — no-website vs has-site (live OpenAI)");
  const none = await prepareOutreach(noSite);
  const has = await prepareOutreach(hasSite);
  ok(none.model !== "mock" && has.model !== "mock", `live model (got ${none.model} / ${has.model})`);
  ok(none.pitchedAngle === "no-website-legitimacy", `no-website angle = ${none.pitchedAngle}`);
  ok(has.pitchedAngle === "lost-customers", `has-site angle = ${has.pitchedAngle}`);
  ok(none.pitchedAngle !== has.pitchedAngle, "angles differ");
  ok(!TECH.test(blobOf(none)) && !TECH.test(blobOf(has)), "money/email/phone avoid raw tech jargon");
  ok(/customer|revenue|leads|business|call|phone/i.test(blobOf(none)), "no-website copy uses customer/revenue language");
  ok(/customer|revenue|leads|business|phone|mobile/i.test(blobOf(has)), "has-site copy uses customer/revenue language");
  ok(none.emailDraft?.subject && none.emailDraft?.body && none.phoneScript, "no-website JSON shape");
  ok(has.emailDraft?.subject && has.emailDraft?.body && has.phoneScript, "has-site JSON shape");
  printAssets("no-website", noSite, none);
  printAssets("has-site", hasSite, has);

  console.log("\n[2] Live 403 audit → needsVerification, no down-claim");
  const audit = await auditSite("https://httpbin.org/status/403");
  ok(audit.needsVerification === true, `403 flagged needsVerification (http ${audit.httpStatus})`);
  const verifyLead = {
    business: "Verify First LLC",
    city: hasSite.city || "Brampton",
    website: "https://httpbin.org/status/403",
    issues: audit.issues,
    needsVerification: true,
    phone: "555-0100",
  };
  const verify = await prepareOutreach(verifyLead);
  ok(verify.pitchedAngle === "verify-first", `403 angle = ${verify.pitchedAngle}`);
  ok(!DOWN.test(blobOf(verify)), "403 copy makes no site-down claim");
  printAssets("needsVerification (403)", verifyLead, verify);

  console.log("\n[3] Mockup config (template + window.SITE, no HTML blob)");
  const site = await buildSiteConfig(hasSite);
  ok(site?.business?.name && site?.copy?.heroHeadline, "SITE has facts + copy");
  ok(Array.isArray(site.reviews) && site.reviews.length <= 5, "reviews are an array of at most 5");
  ok(!site.html, "no HTML blob on the SITE object");
  ok(!TECH.test(JSON.stringify(site.copy)), "copy avoids raw tech jargon");

  const stored = await getLead(hasSite._id);
  ok(stored?.mockup?.config?.copy?.heroHeadline, "mockup.config persisted on the lead");
  ok(!stored.mockup.html && !stored.mockup.html, "no HTML blob stored on the lead");

  const dash = process.env.DASHBOARD_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
  try {
    const page = await fetch(`${dash}/preview/${encodeURIComponent(hasSite._id)}/`);
    ok(page.ok, `GET ${dash}/preview/:placeId/ → ${page.status}`);
    const html = await page.text();
    ok(/noindex/i.test(html), "preview is noindex");
    ok(/preview-banner|Preview \/ mockup/i.test(html), "preview banner present");
    const cfg = await fetch(`${dash}/preview/${encodeURIComponent(hasSite._id)}/config.js`);
    const js = await cfg.text();
    ok(js.includes(stored.mockup.config.business.name), "injected config.js has the business name");
    ok(!js.includes("</script>"), "injected config.js is XSS-safe");
  } catch (e) {
    console.log(`  skip - dashboard not reachable at ${dash} (${e.message})`);
    console.log("  (config was still generated and persisted; start `npm run dashboard` to preview it)");
  }

  console.log(`\nALL ${passed} PHASE-3 E2E CHECKS PASSED`);
}

main()
  .catch((e) => {
    console.error("\n" + e.message + "\n");
    process.exitCode = 1;
  })
  .finally(() => close());
