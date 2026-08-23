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
