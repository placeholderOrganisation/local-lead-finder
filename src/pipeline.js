// Merge find (Part 1) + audit (Part 2) into ONE unified row per business.
// One CSV per category, every lead in it, best leads on top.

import { pitchFor } from "./audit.js";

export const UNIFIED_COLUMNS = [
  ["Priority", "Priority"],
  ["Tier", "Tier"],
  ["Business", "Business"],
  ["Phone", "Phone"],
  ["Issues", "Issues"],
  ["Pitch", "Pitch"],
  ["Website", "Website"],
  ["HTTPS", "HTTPS"],
  ["Mobile", "Mobile"],
  ["LoadSec", "Load (s)"],
  ["SizeKb", "Size (KB)"],
  ["Copyright", "© Year"],
  ["PsiMobile", "PSI Mobile"],
  ["PsiSeo", "PSI SEO"],
  ["Lcp", "LCP (s)"],
  ["Rating", "Rating"],
  ["Reviews", "Reviews"],
  ["Category", "Category"],
  ["Address", "Address"],
  ["MapsUrl", "Google Maps"],
  ["PlaceId", "Place ID"],
];

/**
 * Canonical lead record (the single source of truth — see epic #1).
 * Both the CSV-import path (`csvToRecord`) and the in-process worker path
 * (`recordFrom`) funnel through `keyedRowToRecord` so they emit the SAME shape.
 *
 * @param {Record<string,any>} r  parsed unified-CSV row (header-keyed)
 * @returns {object} canonical record
 */
export function csvToRecord(r) {
  // Translate CSV *labels* -> internal keys. UNIFIED_COLUMNS is the ONLY place
  // the header-name mapping lives; accept a key-keyed row as a fallback.
  const keyed = {};
  for (const [key, label] of UNIFIED_COLUMNS) keyed[key] = r[label] ?? r[key];
  // Contact fields (added in P3 / #32) — read defensively, default empty.
  keyed.Email = r.Email ?? "";
  keyed.Socials = r.Socials ?? "";
  keyed.NeedsVerification = r.NeedsVerification ?? "";
  return keyedRowToRecord(keyed);
}

/**
 * Build the canonical record from an in-memory lead + its audit entry, reusing
 * the existing merge/scoring in `toUnifiedRow` (no CSV round-trip, no duplicated
 * scoring). This is the helper the background worker (#30) calls.
 *
 * @param {object} lead   canonical lead object (from qualify())
 * @param {{audit:object,psi:object}|null} entry  audit result for lead.website
 * @returns {object} canonical record
 */
export function recordFrom(lead, entry) {
  const row = toUnifiedRow(lead, entry);
  row.Email = lead.email ?? "";
  row.Socials = lead.socials ?? "";
  row.NeedsVerification = lead.needsVerification ?? "";
  return keyedRowToRecord(row);
}

/** Map an internal key-keyed row (CSV-derived or `toUnifiedRow` output) -> canonical record. */
function keyedRowToRecord(r) {
  return {
    placeId: str(r.PlaceId),
    business: str(r.Business),
    phone: str(r.Phone),
    website: str(r.Website),
    category: str(r.Category),
    address: str(r.Address),
    mapsUrl: str(r.MapsUrl),
    rating: numOrBlank(r.Rating),
    reviews: Number(r.Reviews) || 0,
    tier: str(r.Tier).toUpperCase(),
    priority: r.Priority == null || r.Priority === "" ? null : Number(r.Priority),
    issues: splitList(r.Issues),
    pitch: str(r.Pitch),
    // audit facts — tri-state / numeric, null when the check never ran
    https: triState(r.HTTPS),
    mobile: triState(r.Mobile),
    loadSec: numOrNull(r.LoadSec),
    sizeKb: numOrNull(r.SizeKb),
    copyright: numOrNull(r.Copyright),
    psiMobile: psiVal(r.PsiMobile),
    psiSeo: numOrNull(r.PsiSeo),
    lcp: numOrNull(r.Lcp),
    // contact fields (P3 / #32) — present in the shape, empty until captured
    email: str(r.Email),
    socials: splitList(r.Socials),
    needsVerification: boolish(r.NeedsVerification),
  };
}

/** Backward-compatible narrow mapper (find-CSV -> lead facts). Delegates naming to csvToRecord. */
export function csvToLead(r) {
  const rec = csvToRecord(r);
  return {
    name: rec.business,
    tier: rec.tier,
    reason: r.Why ?? "",
    phone: rec.phone,
    website: rec.website,
    rating: rec.rating,
    reviews: rec.reviews,
    category: rec.category,
    address: rec.address,
    mapsUrl: rec.mapsUrl,
    placeId: rec.placeId,
  };
}

// ── coercion helpers (shared by every record producer) ──────────────────────
function str(v) {
  return v == null ? "" : String(v);
}
function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function numOrBlank(v) {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isNaN(n) ? str(v) : n;
}
function triState(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = str(v).trim().toLowerCase();
  if (s === "yes") return true;
  if (s === "no") return false;
  return null;
}
function psiVal(v) {
  if (v == null || v === "") return null;
  if (v === "err") return "err";
  const n = Number(v);
  return Number.isNaN(n) ? str(v) : n;
}
function splitList(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  const s = str(v).trim();
  return s ? s.split(/;\s*/).filter(Boolean) : [];
}
function boolish(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = str(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

/**
 * Build unified rows for ALL leads, folding in audit results where present.
 * @param {Array<object>} leads     Canonical lead objects (from qualify() or csvToLead()).
 * @param {Map<string,{audit:object,psi:object}>} auditMap  website -> audit result.
 * @returns {Array<object>} unified rows, sorted best-first.
 */
export function buildUnifiedRows(leads, auditMap) {
  const rows = leads.map((lead) => toUnifiedRow(lead, lead.website ? auditMap.get(lead.website) : null));
  return rows.sort((a, b) => b._sort - a._sort);
}

function toUnifiedRow(lead, entry) {
  const row = {
    Tier: lead.tier,
    Business: lead.name,
    Phone: lead.phone,
    Website: lead.website,
    Rating: lead.rating,
    Reviews: lead.reviews,
    Category: lead.category,
    Address: lead.address,
    MapsUrl: lead.mapsUrl,
    PlaceId: lead.placeId,
    // audit fields default blank
    Issues: "",
    Pitch: "",
    HTTPS: "",
    Mobile: "",
    LoadSec: "",
    SizeKb: "",
    Copyright: "",
    PsiMobile: "",
    PsiSeo: "",
    Lcp: "",
  };

  if (entry) {
    const { audit: a, psi } = entry;
    row.Priority = a.priority ?? 1;
    row.Issues = (a.issues || []).join("; ");
    row.Pitch = pitchFor(lead.name, a);
    // Tri-state: "yes" / "NO" / "" when the check never ran (unreachable / errored).
    row.HTTPS = yesNoUnknown(a.secure);
    row.Mobile = yesNoUnknown(a.mobileFriendly);
    row.LoadSec = a.loadMs != null ? (a.loadMs / 1000).toFixed(1) : "";
    row.SizeKb = a.sizeKb ?? "";
    row.Copyright = a.copyrightYear ?? "";
    row.PsiMobile = psi ? (psi.ok ? psi.performance ?? "" : "err") : "";
    row.PsiSeo = psi?.ok ? psi.seo ?? "" : "";
    row.Lcp = psi?.ok && psi.lcpSec != null ? psi.lcpSec : "";
  } else if (lead.tier === "SKIP") {
    row.Priority = 1;
    row.Issues = "closed / not operational";
  } else if (!lead.website) {
    // No website at all — the easiest, highest-value sell.
    row.Priority = 5;
    row.Issues = "no website";
    row.Pitch = hotPitch(lead.name);
  } else {
    // Has a site but wasn't in the audited tiers.
    row.Priority = 2;
  }

  row._sort = sortScore(lead, entry, row.Priority);
  return row;
}

// Higher = better lead. No-website leads float above everything; SKIP sinks.
// Reviews break ties but are capped so they never bleed across priority bands.
function sortScore(lead, entry, priority) {
  const reviews = Math.min(Number(lead.reviews) || 0, 99);
  if (lead.tier === "SKIP") return -1000 + reviews;
  if (!lead.website && !entry) return 100000 + reviews; // no-website: top
  return priority * 1000 + reviews;
}

function yesNoUnknown(v) {
  return v === true ? "yes" : v === false ? "NO" : "";
}

function hotPitch(name) {
  return `${name} has no website — people searching Google can't find or trust them. Getting them online is the easy, high-impact win.`;
}
