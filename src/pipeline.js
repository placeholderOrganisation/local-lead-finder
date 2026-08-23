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

/** Adapt a parsed CSV row (capitalized headers) to the canonical lead object. */
export function csvToLead(r) {
  return {
    name: r.Business ?? "",
    tier: (r.Tier ?? "").toUpperCase(),
    reason: r.Why ?? "",
    phone: r.Phone ?? "",
    website: r.Website ?? "",
    rating: r.Rating ?? "",
    reviews: Number(r.Reviews) || 0,
    category: r.Category ?? "",
    address: r.Address ?? "",
    mapsUrl: r["Google Maps"] ?? r.MapsUrl ?? "",
    placeId: r["Place ID"] ?? r.PlaceId ?? "",
  };
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
