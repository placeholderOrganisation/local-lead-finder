#!/usr/bin/env node
// Brampton website study 2026 — sample collection + measurement.
// Uses Local Lead Finder Places search + CRM import, then public HTML + PSI.
//
//   node scripts/brampton-study-2026.mjs --find
//   node scripts/brampton-study-2026.mjs --audit
//   node scripts/brampton-study-2026.mjs --find --audit
//
// Does not contact businesses. Does not submit forms.

import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getApiKey } from "../src/env.js";
import { searchBusinesses } from "../src/places.js";
import { qualify } from "../src/leads.js";
import { importRecords } from "../src/store.js";
import { getColl, close } from "../src/db.js";
import { runPageSpeed } from "../src/pagespeed.js";
import { stringifyCsv } from "../src/csv.js";
import { inspectPublicSite } from "./brampton-study-inspect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT_DIR = join(ROOT, "data", "brampton-website-study-2026");
const MINTEK_DIR =
  "/Users/sakshamahluwalia/Documents/mintek-client-onboarding/research/brampton-website-study-2026/data";

const CITY = "Brampton, ON";
const CAP_PER_SEARCH = 12;
const DATE_TESTED = "2026-09-11";

const SEARCHES = [
  { category: "dentists", industry: "Dental/medical", maxPages: 2, keep: 6 },
  { category: "chiropractors", industry: "Dental/medical", maxPages: 2, keep: 3 },
  { category: "physiotherapy", industry: "Dental/medical", maxPages: 2, keep: 3 },
  { category: "optometrists", industry: "Dental/medical", maxPages: 2, keep: 3 },
  { category: "lawyers", industry: "Legal", maxPages: 2, keep: 8 },
  { category: "accountants", industry: "Accounting", maxPages: 2, keep: 8, fromCrm: true },
  { category: "plumbers", industry: "Home services", maxPages: 1, keep: 3, fromCrm: true },
  { category: "hvac", industry: "Home services", maxPages: 2, keep: 3 },
  { category: "electricians", industry: "Home services", maxPages: 2, keep: 2 },
  { category: "landscapers", industry: "Home services", maxPages: 2, keep: 2 },
  { category: "roofers", industry: "Construction/renovation", maxPages: 1, keep: 8, fromCrm: true },
  { category: "restaurants", industry: "Restaurants", maxPages: 3, keep: 10 },
  { category: "hair salons", industry: "Beauty/personal care", maxPages: 2, keep: 5 },
  { category: "spas", industry: "Beauty/personal care", maxPages: 2, keep: 3 },
  { category: "auto repair", industry: "Automotive", maxPages: 2, keep: 7 },
  { category: "real estate agents", industry: "Real estate", maxPages: 2, keep: 7 },
  { category: "gyms", industry: "Fitness", maxPages: 2, keep: 6 },
  { category: "driving schools", industry: "Education", maxPages: 2, keep: 3 },
  { category: "tutoring", industry: "Education", maxPages: 2, keep: 3 },
  { category: "florists", industry: "Retail", maxPages: 2, keep: 4 },
  { category: "jewelers", industry: "Retail", maxPages: 2, keep: 3 },
  { category: "bookstores", industry: "Retail", maxPages: 1, keep: 2 },
];

const CHAIN_RX = new RegExp(
  [
    "mcdonald",
    "tim horton",
    "subway\\b",
    "starbucks",
    "pizza pizza",
    "pizza hut",
    "kfc\\b",
    "burger king",
    "wendy'?s",
    "taco bell",
    "a\\s*&\\s*w\\b",
    "shoppers drug",
    "walmart",
    "canadian tire",
    "home depot",
    "lowe'?s",
    "best buy",
    "la fitness",
    "goodlife fitness",
    "h&r block",
    "hr block",
    "liberty tax",
    "great clips",
    "first choice hair",
    "lenscrafters",
    "7-eleven",
    "circle k",
    "young drivers",
    "boston pizza",
    "swiss chalet",
    "popeyes",
    "mary brown",
    "no frills",
    "food basics",
    "costco",
  ].join("|"),
  "i"
);

function parseArgs(argv) {
    const args = { find: false, audit: false, maxPer: CAP_PER_SEARCH };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--find") args.find = true;
    else if (argv[i] === "--audit") args.audit = true;
    else if (argv[i] === "--retry-psi") args.retryPsi = true;
    else if (argv[i] === "--max-per") args.maxPer = Number(argv[++i]);
  }
  if (!args.find && !args.audit && !args.retryPsi) args.find = true;
  return args;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(MINTEK_DIR, { recursive: true });
  const args = parseArgs(process.argv.slice(2));
  const samplePath = join(OUT_DIR, "sample.json");

  try {
    if (args.find) {
      const sample = await findSample(args.maxPer);
      writeJson(samplePath, sample);
      syncCopy(samplePath);
      console.log(`\nSample ${sample.length} businesses -> ${samplePath}`);
    }
    if (args.audit) {
      if (!existsSync(samplePath)) throw new Error("Run --find first (no sample.json)");
      const sample = JSON.parse(readFileSync(samplePath, "utf8"));
      const measured = await auditSample(sample);
      writeOutputs(measured);
    }
    if (args.retryPsi) {
      const datasetPath = join(OUT_DIR, "dataset.json");
      if (!existsSync(datasetPath)) throw new Error("No dataset.json — run --audit first");
      const rows = JSON.parse(readFileSync(datasetPath, "utf8"));
      const updated = await retryPsi(rows);
      writeOutputs(updated);
    }
  } finally {
    await close();
  }
}

async function findSample(maxPer) {
  const apiKey = getApiKey({ required: true });
  const byIndustry = new Map();
  const seenPlace = new Set();
  const seenHost = new Set();

  const crmLeads = await loadCrmLeads();
  console.log(`CRM has ${crmLeads.length} existing leads to reuse.`);

  for (const spec of SEARCHES) {
    let places = [];
    if (spec.fromCrm) {
      places = crmLeads
        .filter((l) => matchesCrmSearch(l, spec.category))
        .map(crmToPlaceLike);
      console.log(`\n[crm] ${spec.category}: ${places.length} stored leads`);
    }
    if (!spec.fromCrm || places.length < 8) {
      const query = `${spec.category} in ${CITY}`;
      console.log(`\n[places] ${query}`);
      const { places: found } = await searchBusinesses({
        apiKey,
        query,
        maxPages: spec.maxPages,
        log: (m) => console.log(m),
      });
      places = places.concat(found);
    }

    const keepLimit = spec.keep ?? maxPer;
    const qualified = places
      .map((p) => ({ spec, place: p, lead: qualify(placeShape(p)) }))
      .sort((a, b) => (b.lead.reviews || 0) - (a.lead.reviews || 0));
    if (!byIndustry.has(spec.category)) byIndustry.set(spec.category, []);
    const list = byIndustry.get(spec.category);
    for (const row of qualified) {
      if (list.length >= keepLimit) break;
      const reason = excludeReason(row.lead, row.place, seenPlace, seenHost);
      if (reason) continue;
      seenPlace.add(row.lead.placeId);
      const host = hostOf(row.lead.website);
      if (host) seenHost.add(host);
      list.push(toSampleRow(row.lead, spec, row.place));
    }
    console.log(`  kept ${list.length}/${keepLimit} for ${spec.category} (${spec.industry})`);
  }

  const sample = [...byIndustry.values()].flat();

  const records = sample.map(sampleToCrmRecord);
  const { inserted, updated } = await importRecords(records, { searchLabel: "brampton-website-study-2026" });
  console.log(`\nCRM import: ${inserted} inserted, ${updated} updated (label: brampton-website-study-2026)`);
  return sample;
}

function matchesCrmSearch(lead, category) {
  const blob = `${(lead.searches || []).join(" ")} ${lead.category || ""}`.toLowerCase();
  if (category === "accountants") return /account/.test(blob) || /consultant/.test(lead.category || "");
  if (category === "plumbers") return /plumb/.test(blob);
  if (category === "roofers") return /roof/.test(blob);
  return blob.includes(category.toLowerCase());
}

function crmToPlaceLike(l) {
  return {
    id: l.placeId || l._id,
    displayName: { text: l.business },
    formattedAddress: l.address,
    nationalPhoneNumber: l.phone,
    websiteUri: l.website,
    rating: l.rating,
    userRatingCount: l.reviews,
    googleMapsUri: l.mapsUrl,
    primaryTypeDisplayName: { text: l.category },
    businessStatus: "OPERATIONAL",
  };
}

function placeShape(p) {
  if (p.displayName) return p;
  return crmToPlaceLike(p);
}

function excludeReason(lead, place, seenPlace, seenHost) {
  if (!lead.placeId) return "no place id";
  if (seenPlace.has(lead.placeId)) return "duplicate place";
  if (lead.tier === "SKIP") return "not operational";
  if (!lead.website) return "no website";
  if (lead.tier === "WARM") return "social/builder only";
  if (lead.tier !== "AUDIT") return `tier ${lead.tier}`;
  const address = String(lead.address || "");
  if (!/brampton/i.test(address)) return "address not Brampton";
  if (CHAIN_RX.test(lead.name)) return "national chain name";
  const host = hostOf(lead.website);
  if (!host) return "bad host";
  if (seenHost.has(host)) return "duplicate hostname";
  if (/(facebook|instagram|linktr\.ee|business\.site|sites\.google)/i.test(host)) return "not independent site";
  return null;
}

function toSampleRow(lead, spec, place) {
  return {
    business_name: lead.name,
    website: lead.website,
    industry: spec.industry,
    places_category: lead.category,
    brampton_evidence: lead.address,
    source: `Google Places Text Search: "${spec.category} in ${CITY}"`,
    source_urls: lead.mapsUrl,
    place_id: lead.placeId,
    phone_places: lead.phone,
    rating_places: lead.rating === "" ? null : lead.rating,
    reviews_places: lead.reviews,
    date_accessed: DATE_TESTED,
    search_category: spec.category,
  };
}

function sampleToCrmRecord(row) {
  return {
    placeId: row.place_id,
    business: row.business_name,
    phone: row.phone_places || "",
    website: row.website,
    category: row.places_category || row.industry,
    address: row.brampton_evidence,
    mapsUrl: row.source_urls,
    rating: row.rating_places ?? "",
    reviews: row.reviews_places || 0,
    tier: "AUDIT",
    priority: null,
    issues: [],
    pitch: "",
    https: null,
    mobile: null,
    loadSec: null,
    sizeKb: null,
    copyright: null,
    psiMobile: null,
    psiSeo: null,
    lcp: null,
    email: "",
    socials: [],
    needsVerification: false,
  };
}

async function loadCrmLeads() {
  try {
    const leads = await getColl("leads");
    return leads.find({}).toArray();
  } catch (e) {
    console.warn("CRM unavailable:", e.message);
    return [];
  }
}

async function auditSample(sample) {
  const apiKey = getApiKey({ required: true });
  const results = [];
  const progressPath = join(OUT_DIR, "measurements.jsonl");
  const done = loadDone(progressPath);

  console.log(`\nAuditing ${sample.length} homepages (HTML + PageSpeed mobile). Already done: ${done.size}`);
  let i = 0;
  for (const row of sample) {
    i++;
    if (done.has(row.place_id)) {
      results.push(done.get(row.place_id));
      console.log(`  [${i}/${sample.length}] ${row.business_name} — cached`);
      continue;
    }
    console.log(`  [${i}/${sample.length}] ${row.business_name} — inspect + PSI`);
    const htmlPart = await inspectPublicSite(row.website);
    let psi = { ok: false, error: "not run" };
    if (htmlPart.ok !== false || htmlPart.httpStatus < 400) {
      psi = await runPageSpeed({ url: htmlPart.finalUrl || row.website, apiKey, strategy: "mobile" });
    }
    const merged = mergeRow(row, htmlPart, psi);
    results.push(merged);
    appendJsonl(progressPath, merged);
    done.set(row.place_id, merged);
  }
  return results;
}

function mergeRow(row, html, psi) {
  const a11yIssues = psi.ok ? (psi.accessibilityFailedAudits || []).slice(0, 8).join("; ") : "not available";
  return {
    ...row,
    date_tested: DATE_TESTED,
    lighthouse_source: psi.ok ? "PageSpeed Insights API v5 (mobile)" : "not available",
    lighthouse_version: psi.ok ? psi.lighthouseVersion : "not available",
    lighthouse_fetch_time: psi.ok ? psi.fetchTime : "not available",
    lighthouse_error: psi.ok ? null : psi.error || "not available",
    lighthouse_performance: psi.ok ? psi.performance : "not available",
    lighthouse_accessibility: psi.ok ? psi.accessibility : "not available",
    lighthouse_best_practices: psi.ok ? psi.bestPractices : "not available",
    lighthouse_seo: psi.ok ? psi.seo : "not available",
    lcp: psi.ok && psi.lcpSec != null ? psi.lcpSec : "not available",
    fcp: psi.ok && psi.fcpSec != null ? psi.fcpSec : "not available",
    tbt: psi.ok && psi.tbtMs != null ? Math.round(psi.tbtMs) : "not available",
    cls: psi.ok && psi.cls != null ? Number(psi.cls.toFixed(3)) : "not available",
    page_size: psi.ok && psi.pageBytes != null ? Math.round(psi.pageBytes) : html.htmlBytes ?? "not available",
    request_count: psi.ok && psi.requestCount != null ? psi.requestCount : "not available",
    https: html.https ?? "not available",
    cms: html.cms ?? "not available",
    cdn: html.cdn ?? "not available",
    analytics_detected: html.analyticsDetected ?? "not available",
    gtm_detected: html.gtmDetected ?? "not available",
    ga4_detected: html.ga4Detected ?? "not available",
    schema_present: html.jsonLdPresent ?? "not available",
    localbusiness_schema: html.localBusinessSchema ?? "not available",
    address_present: html.addressPresent ?? "not available",
    phone_present: html.phonePresent ?? "not available",
    brampton_location_present: html.bramptonLocationPresent ?? "not available",
    service_pages_present: html.servicePagesPresent ?? "not available",
    contact_form: html.contactForm ?? "not available",
    click_to_call: html.clickToCall ?? "not available",
    booking: html.booking ?? null,
    primary_cta: html.primaryCta ?? null,
    reviews_testimonials: html.reviewsTestimonials ?? "not available",
    business_hours: html.businessHours ?? "not available",
    xml_sitemap: html.xmlSitemap ?? "not available",
    robots_txt: html.robotsTxt ?? "not available",
    canonical: Boolean(html.canonical),
    title_tag: Boolean(html.title),
    meta_description: Boolean(html.metaDescription),
    h1: Boolean(html.h1),
    indexable_homepage: html.indexableHomepage ?? "not available",
    mobile_viewport: html.viewport ?? "not available",
    mobile_issues: html.viewport === false,
    images_without_alt: html.imagesWithoutAlt ?? "not available",
    accessibility_auto_issues: a11yIssues,
    faq_present: html.faqPresent ?? "not available",
    blog_present: html.blogPresent ?? "not available",
    pricing_present: html.pricingPresent ?? "not available",
    trust_indicators: html.trustIndicators ?? "not available",
    inspect_ok: html.ok,
    inspect_status: html.httpStatus ?? "not available",
    inspect_error: html.error || null,
    notes: [html.error, psi.ok ? null : psi.error].filter(Boolean).join("; ") || null,
  };
}

async function retryPsi(rows) {
  const apiKey = getApiKey({ required: true });
  const missing = rows.filter((r) => r.lighthouse_performance === "not available");
  console.log(`\nRetrying PageSpeed for ${missing.length}/${rows.length} sites without a score.`);
  const byId = new Map(rows.map((r) => [r.place_id, r]));
  let i = 0;
  for (const row of missing) {
    i++;
    console.log(`  [${i}/${missing.length}] ${row.business_name}`);
    const psi = await runPageSpeed({ url: row.website, apiKey, strategy: "mobile" });
    const merged = mergeRow(row, {
      ok: row.inspect_ok,
      https: row.https,
      htmlBytes: typeof row.page_size === "number" ? row.page_size : undefined,
      cms: row.cms,
      cdn: row.cdn,
      analyticsDetected: row.analytics_detected,
      gtmDetected: row.gtm_detected,
      ga4Detected: row.ga4_detected,
      jsonLdPresent: row.schema_present,
      localBusinessSchema: row.localbusiness_schema,
      addressPresent: row.address_present,
      phonePresent: row.phone_present,
      bramptonLocationPresent: row.brampton_location_present,
      servicePagesPresent: row.service_pages_present,
      contactForm: row.contact_form,
      clickToCall: row.click_to_call,
      booking: row.booking,
      primaryCta: row.primary_cta,
      reviewsTestimonials: row.reviews_testimonials,
      businessHours: row.business_hours,
      xmlSitemap: row.xml_sitemap,
      robotsTxt: row.robots_txt,
      canonical: row.canonical ? "yes" : "",
      title: row.title_tag ? "yes" : "",
      metaDescription: row.meta_description ? "yes" : "",
      h1: row.h1 ? "yes" : "",
      indexableHomepage: row.indexable_homepage,
      viewport: row.mobile_viewport,
      imagesWithoutAlt: row.images_without_alt,
      faqPresent: row.faq_present,
      blogPresent: row.blog_present,
      pricingPresent: row.pricing_present,
      trustIndicators: row.trust_indicators,
      httpStatus: row.inspect_status,
      error: row.inspect_error,
    }, psi);
    const keys = [
      "date_tested", "lighthouse_source", "lighthouse_version", "lighthouse_fetch_time",
      "lighthouse_error", "lighthouse_performance", "lighthouse_accessibility",
      "lighthouse_best_practices", "lighthouse_seo", "lcp", "fcp", "tbt", "cls",
      "page_size", "request_count", "accessibility_auto_issues", "notes",
    ];
    const next = { ...row };
    for (const k of keys) next[k] = merged[k];
    byId.set(row.place_id, next);
    appendJsonl(join(OUT_DIR, "measurements.jsonl"), next);
  }
  return [...byId.values()];
}

function writeOutputs(rows) {
  const jsonPath = join(OUT_DIR, "dataset.json");
  const csvPath = join(OUT_DIR, "dataset.csv");
  writeJson(jsonPath, rows);
  const columns = Object.keys(rows[0] || { business_name: 1 }).map((k) => [k, k]);
  writeFileSync(csvPath, stringifyCsv(rows, columns));
  syncCopy(jsonPath);
  syncCopy(csvPath);
  const byInd = {};
  for (const r of rows) byInd[r.industry] = (byInd[r.industry] || 0) + 1;
  console.log(`\nWrote ${rows.length} measured rows.`);
  console.log("By industry:", byInd);
  console.log(csvPath);
}

function loadDone(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.place_id) map.set(row.place_id, row);
    } catch {}
  }
  return map;
}

function appendJsonl(path, row) {
  writeFileSync(path, JSON.stringify(row) + "\n", { flag: "a" });
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function syncCopy(path) {
  try {
    mkdirSync(MINTEK_DIR, { recursive: true });
    copyFileSync(path, join(MINTEK_DIR, path.split("/").pop()));
  } catch (e) {
    console.warn("Could not copy to mintek research folder:", e.message);
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
