// Place Details (New) — on-demand review quotes for mockup generate (#42).
// Enterprise-tier SKU. NEVER call from the worker / Text Search hot path.

import { getApiKey } from "./env.js";

const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const FIELD_MASK = "id,rating,userRatingCount,reviews";

/**
 * Fetch rating/count + up to 5 verbatim Google reviews for a place.
 * Fail-soft: returns empty reviews on missing key, bad id, quota, or network error.
 *
 * @param {string} placeId
 * @returns {Promise<{rating:number|null, reviewCount:number|null, reviews:Array<{author:string, rating:number, text:string, relativeTime:string}>}>}
 */
export async function fetchReviews(placeId) {
  const empty = { rating: null, reviewCount: null, reviews: [] };
  const id = String(placeId || "").replace(/^places\//, "").trim();
  if (!id || id === "x") return empty;

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[placedetails] GOOGLE_PLACES_API_KEY missing; reviews stay empty");
    return empty;
  }

  try {
    const res = await fetch(DETAILS_URL + encodeURIComponent(id), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
    });
    if (!res.ok) {
      const detail = await safeError(res);
      console.warn(`[placedetails] Place Details ${res.status}${detail}; reviews stay empty`);
      return empty;
    }
    const data = await res.json();
    return reviewsFromPlace(data);
  } catch (err) {
    console.warn(`[placedetails] ${err.message}; reviews stay empty`);
    return empty;
  }
}

/**
 * Map a Place Details (New) payload to the #40 reviews contract.
 * Review text is taken verbatim (originalText, else text) — never edited.
 * @param {object} data
 */
export function reviewsFromPlace(data) {
  const ratingRaw = Number(data?.rating);
  const countRaw = Number(data?.userRatingCount ?? data?.reviewCount);
  const raw = Array.isArray(data?.reviews) ? data.reviews : [];
  const reviews = [];
  for (const r of raw) {
    if (reviews.length >= 5) break;
    const text = verbatimText(r);
    if (!text) continue;
    const rating = Number(r.rating);
    reviews.push({
      author: str(r.authorAttribution?.displayName || r.authorName) || "Google user",
      rating: Number.isFinite(rating) ? rating : 0,
      text,
      relativeTime: str(r.relativePublishTimeDescription || r.relativeTime),
    });
  }
  return {
    rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : null,
    reviewCount: Number.isFinite(countRaw) && countRaw > 0 ? countRaw : null,
    reviews,
  };
}

function verbatimText(r) {
  // Prefer originalText (untranslated) so we never ship a modified snippet.
  if (typeof r?.originalText?.text === "string" && r.originalText.text.trim()) {
    return r.originalText.text;
  }
  if (typeof r?.text?.text === "string" && r.text.text.trim()) {
    return r.text.text;
  }
  if (typeof r?.text === "string" && r.text.trim()) return r.text;
  return "";
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

async function safeError(res) {
  try {
    const data = await res.json();
    const msg = data?.error?.message || data?.message;
    return msg ? `: ${msg}` : "";
  } catch {
    return "";
  }
}
