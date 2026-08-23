// CRM data-access layer over the master `leads` collection.
// Read + mutate operations for the dashboard API (#25) and crm-cli (#24).
// Import/upsert lives in the same module (added by #22).

import { getColl } from "./db.js";

/** Canonical pipeline stages (single source of truth for status ordering). */
export const STAGES = ["New", "Contacted", "Replied", "Meeting", "Won", "Lost"];

// Canonical business/audit facts refreshed on every import. Excludes CRM/outreach
// state (status, notes, dates, assets, …) which importRecords must NEVER overwrite.
const FACT_KEYS = [
  "business", "phone", "website", "category", "address", "mapsUrl", "rating",
  "reviews", "tier", "priority", "issues", "pitch", "https", "mobile", "loadSec",
  "sizeKb", "copyright", "psiMobile", "psiSeo", "lcp", "email", "socials",
  "needsVerification",
];

/**
 * Upsert canonical lead records keyed by Place ID. Refreshes facts while
 * preserving outreach state ($setOnInsert), so re-running the finder never
 * clobbers your notes/status/dates. This is the core CRM guarantee.
 *
 * @param {Array<object>} records canonical records (from csvToRecord / worker).
 * @param {{searchLabel?:string}} [opts]
 * @returns {Promise<{inserted:number,updated:number}>}
 */
export async function importRecords(records, { searchLabel } = {}) {
  const leads = await getColl("leads");
  let inserted = 0;
  let updated = 0;

  for (const rec of records) {
    const placeId = rec?.placeId;
    if (!placeId) continue; // no key, can't dedupe — skip

    const now = new Date();
    const facts = {};
    for (const k of FACT_KEYS) facts[k] = rec[k] ?? null;

    const set = { ...facts, placeId, factsUpdatedAt: now, updatedAt: now };

    // Snapshot the prior issues when incoming facts differ from what's stored.
    const existing = await leads.findOne(
      { _id: placeId },
      { projection: Object.fromEntries(FACT_KEYS.map((k) => [k, 1])) }
    );
    if (existing && factsSignature(existing) !== factsSignature(facts)) {
      set.priorIssues = existing.issues ?? [];
    }

    const update = {
      $set: set,
      $setOnInsert: {
        status: "New",
        notes: "",
        contactedDate: null,
        contactChannel: null,
        followUpDate: null,
        createdAt: now,
        auditCount: 0,
        statusHistory: [],
      },
    };
    if (searchLabel) update.$addToSet = { searches: searchLabel };

    const res = await leads.updateOne({ _id: placeId }, update, { upsert: true });
    if (res.upsertedCount) inserted++;
    else updated++;
  }

  return { inserted, updated };
}

function factsSignature(obj) {
  return JSON.stringify(FACT_KEYS.map((k) => obj?.[k] ?? null));
}

// Human edits may only touch these fields. Everything else in a patch is ignored.
const UPDATE_ALLOW = [
  "status",
  "notes",
  "contactedDate",
  "contactChannel",
  "followUpDate",
  "pitchedAngle",
  "dealValue",
  "lostReason",
];

// Fields that should be stored as real Dates so range queries (due/overdue) work.
const DATE_FIELDS = new Set(["contactedDate", "followUpDate"]);

/**
 * List leads matching a filter, best-first (priority desc, then reviews desc).
 * @param {{status?:string,tier?:string,category?:string,text?:string,due?:boolean,hasAssets?:boolean}} [filter]
 * @returns {Promise<Array<object>>}
 */
export async function listLeads(filter = {}) {
  const leads = await getColl("leads");
  const q = {};

  if (filter.status) q.status = filter.status;
  if (filter.tier) q.tier = String(filter.tier).toUpperCase();
  if (filter.category) q.category = new RegExp(`^${escapeRegex(filter.category)}$`, "i");
  if (filter.text) {
    const rx = new RegExp(escapeRegex(filter.text), "i");
    q.$or = [{ business: rx }, { category: rx }, { address: rx }];
  }
  if (filter.due) {
    const { end } = todayBounds();
    q.followUpDate = { $ne: null, $lte: end };
  }
  if (filter.hasAssets) {
    q.assets = { $exists: true, $ne: null };
  }

  return leads.find(q).sort({ priority: -1, reviews: -1 }).toArray();
}

/**
 * Pipeline summary for the dashboard tiles.
 * @returns {Promise<{total:number,byStatus:Record<string,number>,dueToday:number,overdue:number}>}
 */
export async function stats() {
  const leads = await getColl("leads");
  const { start, end } = todayBounds();

  const [total, byStatusAgg, dueToday, overdue] = await Promise.all([
    leads.countDocuments({}),
    leads.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    leads.countDocuments({ followUpDate: { $ne: null, $gte: start, $lte: end } }),
    leads.countDocuments({ followUpDate: { $ne: null, $lt: start } }),
  ]);

  const byStatus = {};
  for (const s of STAGES) byStatus[s] = 0;
  for (const row of byStatusAgg) {
    if (row._id == null) continue;
    byStatus[row._id] = row.n; // include any legacy/unknown status too
  }

  return { total, byStatus, dueToday, overdue };
}

/**
 * Apply a human edit to one lead. Only allow-listed fields are written.
 * Records status transitions (statusHistory) and stamps won/lost timestamps.
 * @param {string} placeId  the lead `_id`.
 * @param {object} patch    partial edit (unknown keys ignored).
 * @returns {Promise<object|null>} the updated document.
 */
export async function updateLead(placeId, patch = {}) {
  const leads = await getColl("leads");

  const set = { updatedAt: new Date() };
  for (const key of UPDATE_ALLOW) {
    if (!(key in patch)) continue;
    set[key] = DATE_FIELDS.has(key) ? toDateOrNull(patch[key]) : patch[key];
  }

  const update = { $set: set };

  // Status transition: push history + stamp won/lost only when it actually changes.
  if (patch.status) {
    const existing = await leads.findOne({ _id: placeId }, { projection: { status: 1 } });
    if (!existing || existing.status !== patch.status) {
      const at = new Date();
      update.$push = { statusHistory: { status: patch.status, at } };
      if (patch.status === "Won") set.wonAt = at;
      if (patch.status === "Lost") set.lostAt = at;
    }
  }

  const res = await leads.findOneAndUpdate({ _id: placeId }, update, {
    returnDocument: "after",
  });
  // driver v6+ returns the doc directly; guard against the legacy {value} shape.
  return res && res.value !== undefined ? res.value : res;
}

/** Fetch one lead by Place ID. */
export async function getLead(placeId) {
  const leads = await getColl("leads");
  return leads.findOne({ _id: placeId });
}

/**
 * Persist a generated mockup on the lead. Does not touch CRM/outreach state.
 * @param {string} placeId
 * @param {{html:string, generatedAt:string, model?:string}} mockup
 * @returns {Promise<object|null>}
 */
export async function saveMockup(placeId, mockup) {
  if (!placeId || !mockup?.html) return null;
  const leads = await getColl("leads");
  const res = await leads.findOneAndUpdate(
    { _id: placeId },
    {
      $set: {
        mockup: {
          html: mockup.html,
          generatedAt: mockup.generatedAt || new Date().toISOString(),
          publicUrl: null,
          model: mockup.model || null,
        },
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
  return res && res.value !== undefined ? res.value : res;
}

/**
 * Persist on-demand Lighthouse scores (#38). Never written by the worker.
 * @param {string} placeId
 * @param {object} scores
 * @returns {Promise<object|null>}
 */
export async function saveLighthouse(placeId, scores) {
  if (!placeId || !scores) return null;
  const leads = await getColl("leads");
  const res = await leads.findOneAndUpdate(
    { _id: placeId },
    { $set: { lighthouse: { ...scores, at: scores.at || new Date().toISOString() }, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return res && res.value !== undefined ? res.value : res;
}

/**
 * Persist composed outreach assets (#35). Does not send anything.
 * @param {string} placeId
 * @param {object} assets
 * @returns {Promise<object|null>}
 */
export async function saveAssets(placeId, assets) {
  if (!placeId || !assets) return null;
  const leads = await getColl("leads");
  const res = await leads.findOneAndUpdate(
    { _id: placeId },
    { $set: { assets, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return res && res.value !== undefined ? res.value : res;
}

// ── Places usage tracking + monthly cap (#29) ───────────────────────────────
// The worker bills the Places API per request (~5,000 free Pro calls/mo). We
// count ACTUAL pages fetched (1 request per page) into a per-month `usage` doc
// so a run can be refused once the month reaches MONTHLY_PLACES_CAP (#19).

/** Format a Date as its "YYYY-MM" usage key (local time). */
function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Running Places-request total for a month.
 * @param {Date} [date] any date within the month (default now).
 * @returns {Promise<{month:string, placesRequests:number}>}
 */
export async function getMonthUsage(date = new Date()) {
  const usage = await getColl("usage");
  const month = monthKey(date);
  const doc = await usage.findOne({ _id: month });
  return { month, placesRequests: doc?.placesRequests ?? 0 };
}

/**
 * Add `n` Places requests to the current month's counter (upsert).
 * No-op for non-positive counts so a zero-page run never touches the doc.
 * @param {number} n  requests (pages) actually fetched.
 * @param {Date} [date] any date within the month (default now).
 * @returns {Promise<{month:string, placesRequests:number}>} the new total.
 */
export async function addPlacesRequests(n, date = new Date()) {
  const count = Math.trunc(Number(n) || 0);
  if (count <= 0) return getMonthUsage(date);

  const usage = await getColl("usage");
  const month = monthKey(date);
  const now = new Date();
  await usage.updateOne(
    { _id: month },
    { $inc: { placesRequests: count }, $set: { updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return getMonthUsage(date);
}

/**
 * Whether this month's Places usage is still below `cap` (gates at the boundary:
 * once usage === cap it returns false, so the worker stops before exceeding it).
 * @param {number} cap
 * @returns {Promise<boolean>}
 */
export async function underPlacesCap(cap) {
  const { placesRequests } = await getMonthUsage();
  return placesRequests < Number(cap);
}

// ── Campaigns (#28) ─────────────────────────────────────────────────────────
// The rotating list of {city, category} searches the worker (#30) consumes. One
// doc per search, keyed by a slug of "<category> in <city>". Progress aggregates
// (progress/totalLeads/priorityLeads/averageScore/status) are borrowed from
// Prospex (MIT) and maintained by the worker — see docs/prior-art.md.

/** Slug key for a campaign, e.g. ("Brampton, ON","roofers") -> "roofers-in-brampton-on". */
export function campaignSlug(city, category) {
  return `${category} in ${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Upsert a campaign (idempotent by slug). Provided cadence/maxPages always win;
 * omitted ones default only on insert so re-adding never clobbers tuned values.
 * @param {{city:string, category:string, cadenceDays?:number, maxPages?:number}} input
 * @returns {Promise<object>} the stored campaign doc.
 */
export async function addCampaign({ city, category, cadenceDays, maxPages } = {}) {
  if (!city || !category) throw new Error("addCampaign requires city and category.");
  const campaigns = await getColl("campaigns");
  const _id = campaignSlug(city, category);
  const now = new Date();

  const set = { city: String(city).trim(), category: String(category).trim(), updatedAt: now };
  const onInsert = {
    enabled: true,
    lastRunAt: null,
    foundTotal: 0,
    // progress aggregates (Prospex-borrowed; worker-maintained)
    status: "draft", // draft | running | done | error
    progress: 0,
    totalLeads: 0,
    priorityLeads: 0,
    averageScore: 0,
    createdAt: now,
  };

  const cadence = Math.trunc(Number(cadenceDays));
  if (Number.isFinite(cadence) && cadence > 0) set.cadenceDays = cadence;
  else onInsert.cadenceDays = 14;

  const pages = Math.trunc(Number(maxPages));
  if (Number.isFinite(pages) && pages > 0) set.maxPages = pages;
  else onInsert.maxPages = 5;

  await campaigns.updateOne({ _id }, { $set: set, $setOnInsert: onInsert }, { upsert: true });
  return campaigns.findOne({ _id });
}

/** All campaigns, enabled first then stalest-first (nulls sort before dates). */
export async function listCampaigns() {
  const campaigns = await getColl("campaigns");
  return campaigns.find({}).sort({ enabled: -1, lastRunAt: 1, _id: 1 }).toArray();
}

/**
 * Toggle a campaign's enabled flag.
 * @returns {Promise<object|null>} the updated doc, or null if no such id.
 */
export async function setCampaignEnabled(id, enabled) {
  const campaigns = await getColl("campaigns");
  const res = await campaigns.findOneAndUpdate(
    { _id: id },
    { $set: { enabled: !!enabled, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return res && res.value !== undefined ? res.value : res;
}

/** Whether a campaign is due to run now (never-run, or older than its cadence). */
export function isCampaignDue(c, now = new Date()) {
  if (!c) return false;
  if (!c.lastRunAt) return true;
  const last = c.lastRunAt instanceof Date ? c.lastRunAt : new Date(c.lastRunAt);
  if (Number.isNaN(last.getTime())) return true;
  const cadenceMs = (Number(c.cadenceDays) || 14) * 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() >= cadenceMs;
}

/**
 * The oldest due, enabled campaign — the one the worker should run next.
 * @returns {Promise<object|null>} null when none are enabled-and-due.
 */
export async function pickStalestCampaign(now = new Date()) {
  const campaigns = await getColl("campaigns");
  // Stalest first: null lastRunAt (never run) sorts ahead of any date.
  const enabled = await campaigns.find({ enabled: true }).sort({ lastRunAt: 1, _id: 1 }).toArray();
  for (const c of enabled) {
    if (isCampaignDue(c, now)) return c;
  }
  return null;
}

/** Mark a campaign as actively running (progress UX only — not a success signal). */
export async function markCampaignRunning(id) {
  const campaigns = await getColl("campaigns");
  await campaigns.updateOne({ _id: id }, { $set: { status: "running", updatedAt: new Date() } });
}

/** Mark a run as failed. Deliberately does NOT touch lastRunAt/foundTotal. */
export async function markCampaignError(id) {
  const campaigns = await getColl("campaigns");
  await campaigns.updateOne({ _id: id }, { $set: { status: "error", updatedAt: new Date() } });
}

/**
 * Record a SUCCESSFUL worker run: advance lastRunAt, bump foundTotal, and
 * refresh the progress aggregates from the campaign's own leads (those tagged
 * with `searchLabel`). `averageScore` is the mean lead `priority` (1–5) — the
 * quality signal persisted on the canonical record; `priorityLeads` counts the
 * HIGH-priority (>=4) ones. Only the worker (#30) calls this, on success.
 * @param {string} id           campaign _id
 * @param {string} searchLabel  "<category> in <city>" tag carried on each lead
 * @param {{found?:number}} [run]
 * @returns {Promise<object|null>} the updated campaign
 */
export async function recordCampaignRun(id, searchLabel, { found = 0 } = {}) {
  const campaigns = await getColl("campaigns");
  const leads = await getColl("leads");

  const [agg] = await leads
    .aggregate([
      { $match: { searches: searchLabel } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          priorityLeads: { $sum: { $cond: [{ $gte: ["$priority", 4] }, 1, 0] } },
          avgPriority: { $avg: "$priority" },
        },
      },
    ])
    .toArray();

  const totalLeads = agg?.totalLeads ?? 0;
  const priorityLeads = agg?.priorityLeads ?? 0;
  const averageScore = agg?.avgPriority != null ? Math.round(agg.avgPriority * 10) / 10 : 0;

  const now = new Date();
  await campaigns.updateOne(
    { _id: id },
    {
      $set: {
        lastRunAt: now,
        status: "done",
        progress: 100,
        totalLeads,
        priorityLeads,
        averageScore,
        updatedAt: now,
      },
      $inc: { foundTotal: Math.max(0, Math.trunc(Number(found) || 0)) },
    }
  );
  return campaigns.findOne({ _id: id });
}

// ── helpers ─────────────────────────────────────────────────────────────────
function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toDateOrNull(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
