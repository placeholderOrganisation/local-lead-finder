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
  };
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

// Rank order for sorting the CSV so the best leads sit at the top.
const TIER_RANK = { HOT: 0, WARM: 1, AUDIT: 2, SKIP: 3 };

export function sortLeads(leads) {
  return [...leads].sort((a, b) => {
    const t = (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
    if (t !== 0) return t;
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
