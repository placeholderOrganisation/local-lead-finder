// Thin client for the Google Places API (New) Text Search endpoint.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Fields we ask for. `websiteUri` + `nationalPhoneNumber` make this a Pro-tier
// request (5,000 free calls/month). Every field here is billed at that one tier,
// so adding cheap-looking extras is free as long as none jump to Enterprise.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "nextPageToken",
].join(",");

/**
 * Run a text search and page through all results.
 *
 * @param {object}  opts
 * @param {string}  opts.apiKey    Google Places API key.
 * @param {string}  opts.query     e.g. "roofers in Austin, TX".
 * @param {number} [opts.maxPages] Safety cap on paged requests (default 5 -> up to 100 results).
 * @param {(msg:string)=>void} [opts.log] Optional progress logger.
 * @returns {Promise<Array<object>>} Raw place objects from the API.
 */
export async function searchBusinesses({ apiKey, query, maxPages = 5, log = () => {} }) {
  if (!apiKey) throw new Error("Missing API key.");
  if (!query) throw new Error("Missing search query.");

  const places = [];
  let pageToken;
  let page = 0;

  do {
    page += 1;
    const body = { textQuery: query, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await safeError(res);
      throw new Error(`Places API ${res.status} ${res.statusText}${detail}`);
    }

    const data = await res.json();
    const batch = data.places ?? [];
    places.push(...batch);
    log(`  page ${page}: +${batch.length} (total ${places.length})`);

    pageToken = data.nextPageToken;
    // A freshly issued nextPageToken needs a moment before it is valid.
    if (pageToken && page < maxPages) await sleep(2000);
  } while (pageToken && page < maxPages);

  return places;
}

async function safeError(res) {
  try {
    const data = await res.json();
    const msg = data?.error?.message;
    return msg ? ` — ${msg}` : "";
  } catch {
    return "";
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
