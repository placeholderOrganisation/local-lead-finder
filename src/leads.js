// Turn raw Places results into qualified leads + CSV.

/**
 * Score a single place into a lead.
 *
 * Signal we care about most: no websiteUri -> the business likely has no site,
 * which is the easiest, highest-impact sell.
 */
export function qualify(place) {
  const website = place.websiteUri ?? "";
  const reviews = place.userRatingCount ?? 0;
  const rating = place.rating ?? null;
  const operational = place.businessStatus === "OPERATIONAL" || place.businessStatus == null;

  let tier, reason;
  if (!operational) {
    tier = "SKIP";
    reason = `not operational (${place.businessStatus})`;
  } else if (!website) {
    // No site at all. Hotter if they clearly have a real, active business.
    tier = reviews >= 10 ? "HOT" : "WARM";
    reason = website ? "" : `no website${reviews >= 10 ? `, ${reviews} reviews (established)` : ""}`;
  } else if (isSocialOrBuilder(website)) {
    tier = "WARM";
    reason = `only a ${socialLabel(website)} page, no real site`;
  } else {
    // Has a real site — a maybe. Worth auditing (mobile / speed / age) later.
    tier = "AUDIT";
    reason = "has a site — check quality (mobile, speed, freshness)";
  }

  const { bayesRating, score, priority, factors } = scoreLead({ rating, reviews, website, operational });

  return {
    name: place.displayName?.text ?? "",
    tier,
    reason,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? "",
    website,
    rating: rating ?? "",
    reviews,
    category: place.primaryTypeDisplayName?.text ?? "",
    address: place.formattedAddress ?? "",
    mapsUrl: place.googleMapsUri ?? "",
    placeId: place.id ?? "",
    // Bayesian scoring (see scoreLead) — web-selling-correct, inverted website signal.
    bayesRating,
    score,
    priority,
    factors,
  };
}

// ── Lead scoring (Bayesian, web-selling-correct) ────────────────────────────
// Adapted from Prospex's (MIT) lead-intelligence Bayesian rating, with the
// website signal INVERTED: for a web-dev agency, no/weak site is the buying
// signal, so it must RAISE priority (not lower it). See docs/prior-art.md.

export const SCORING = { PRIOR: 4.0, WEIGHT: 25 };

/**
 * Bayesian-adjusted rating: pull low-review ratings toward a 4.0★ prior so a
 * 5★/1-review can't outrank a 4.6★/800-review business.
 *   adj = (W*PRIOR + n*rating) / (W + n)
 * @param {number|null} rating  raw star rating (null when unrated).
 * @param {number} reviews      review count.
 * @returns {number} adjusted rating.
 */
export function bayesianRating(rating, reviews) {
  const { PRIOR, WEIGHT } = SCORING;
  const r = typeof rating === "number" && rating > 0 ? rating : PRIOR;
  const n = reviews == null ? 1 : reviews; // reviewCount ?? 1
  return (WEIGHT * PRIOR + n * r) / (WEIGHT + n);
}

/**
 * Blend the buying signals into a numeric score + 1–5 priority + explainable
 * `factors` (surfaced in the CRM for transparency).
 *
 * @param {{rating:number|null, reviews?:number, website?:string, operational?:boolean}} lead
 * @returns {{bayesRating:number, score:number, priority:number, factors:Array<{label:string,points:number}>}}
 */
export function scoreLead({ rating, reviews = 0, website = "", operational = true }) {
  const adj = bayesianRating(rating, reviews);

  if (!operational) {
    return { bayesRating: adj, score: 0, priority: 0, factors: [{ label: "not operational", points: 0 }] };
  }

  const factors = [];

  // Website signal — INVERTED for web-selling: no site = hottest prospect.
  const site = websiteClass(website);
  const sitePoints = site === "none" ? 40 : site === "weak" ? 25 : 5;
  factors.push({ label: siteLabel(site), points: sitePoints });

  // Adjusted-rating quality — a reputable business worth selling to.
  const ratingPoints = round1(Math.max(0, (adj - 3.0) * 10));
  factors.push({ label: `adjusted rating ${adj.toFixed(2)}★`, points: ratingPoints });

  // Establishment — review volume signals a real, reachable business with budget.
  const estPoints = round1((Math.min(reviews, 200) / 200) * 20);
  factors.push({ label: `${reviews} review${reviews === 1 ? "" : "s"}`, points: estPoints });

  const score = round1(sitePoints + ratingPoints + estPoints);
  return { bayesRating: adj, score, priority: priorityFromScore(score), factors };
}

function websiteClass(website) {
  if (!website) return "none";
  if (isSocialOrBuilder(website)) return "weak";
  return "real";
}

function siteLabel(site) {
  if (site === "none") return "no website (easiest, highest-value sell)";
  if (site === "weak") return "social/builder-only site (needs a real site)";
  return "has a real site (redesign/audit angle)";
}

function priorityFromScore(score) {
  if (score >= 55) return 5;
  if (score >= 45) return 4;
  if (score >= 30) return 3;
  if (score >= 15) return 2;
  return 1;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// A Facebook/Instagram/Linktree/site-builder URL usually means "no real website."
const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linktr.ee",
  "linktree.com",
  "linkin.bio",
  "business.site", // Google's own free page builder
  "sites.google.com",
  "wixsite.com",
  "godaddysites.com",
];

function isSocialOrBuilder(url) {
  return SOCIAL_HOSTS.some((h) => hostOf(url).endsWith(h));
}

function socialLabel(url) {
  const host = hostOf(url);
  if (host.includes("facebook")) return "Facebook";
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("linktr") || host.includes("linkin.bio")) return "link-in-bio";
  return "free-builder";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// Sort best-first by the blended Bayesian score; reviews break ties.
// No-website (HOT) leads float to the top; non-operational (SKIP) sink to 0.
export function sortLeads(leads) {
  return [...leads].sort((a, b) => {
    const s = (b.score ?? -1) - (a.score ?? -1);
    if (s !== 0) return s;
    return (b.reviews ?? 0) - (a.reviews ?? 0); // more reviews = more real
  });
}

const COLUMNS = [
  ["tier", "Tier"],
  ["reason", "Why"],
  ["name", "Business"],
  ["phone", "Phone"],
  ["website", "Website"],
  ["rating", "Rating"],
  ["reviews", "Reviews"],
  ["category", "Category"],
  ["address", "Address"],
  ["mapsUrl", "Google Maps"],
  ["placeId", "Place ID"],
];

export function toCsv(leads) {
  const header = COLUMNS.map(([, label]) => label).join(",");
  const rows = leads.map((l) => COLUMNS.map(([key]) => csvCell(l[key])).join(","));
  return [header, ...rows].join("\n") + "\n";
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function summarize(leads) {
  const counts = { HOT: 0, WARM: 0, AUDIT: 0, SKIP: 0 };
  for (const l of leads) counts[l.tier] = (counts[l.tier] ?? 0) + 1;
  return counts;
}
