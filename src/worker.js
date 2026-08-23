#!/usr/bin/env node
// Local Lead Finder — background worker (#30).
//
// One idempotent, quota-aware collection batch per invocation:
//   find -> audit (DIY only, no PageSpeed) -> import canonical records to Mongo.
// No CSV round-trip, no local-path assumptions (Render-ready). One-shot by
// design — cron/launchd (#31) repeats it; there is no built-in loop here.
//
// Flow:
//   1. underPlacesCap(MONTHLY_PLACES_CAP)      — if not, log + exit (no Places call)
//   2. pickStalestCampaign()                   — if none due, log + exit
//   3. searchBusinesses + qualify; meter real requests via addPlacesRequests()
//   4. auditTargets (DIY only)
//   5. recordFrom(lead, auditEntry) in-memory  — canonical records, NO CSV
//   6. importRecords(records, { searchLabel })
//   7. recordCampaignRun() on SUCCESS          — lastRunAt, foundTotal, aggregates

import { searchBusinesses } from "./places.js";
import { qualify, sortLeads, summarize as summarizeLeads } from "./leads.js";
import { auditTargets } from "./auditor.js";
import { recordFrom } from "./pipeline.js";
import {
  underPlacesCap,
  addPlacesRequests,
  getMonthUsage,
  pickStalestCampaign,
  markCampaignRunning,
  markCampaignError,
  recordCampaignRun,
  importRecords,
} from "./store.js";
import { getApiKey, getMonthlyPlacesCap } from "./env.js";
import { close } from "./db.js";

async function main() {
  const cap = getMonthlyPlacesCap();

  // 1) Quota gate — never even look at a campaign if we're at/over the cap.
  if (!(await underPlacesCap(cap))) {
    const { month, placesRequests } = await getMonthUsage();
    console.log(
      `[worker] Monthly Places cap reached (${placesRequests}/${cap} in ${month}). Exiting without calling Places.`
    );
    return;
  }

  // 2) Pick the stalest enabled, due campaign.
  const campaign = await pickStalestCampaign();
  if (!campaign) {
    console.log("[worker] No enabled campaign is due. Nothing to do.");
    return;
  }

  const query = `${campaign.category} in ${campaign.city}`;
  const searchLabel = query; // canonical leads carry "<category> in <city>" (epic #1)
  console.log(`[worker] Running campaign ${campaign._id} — "${query}" (maxPages ${campaign.maxPages ?? 5})`);

  let apiKey;
  try {
    apiKey = getApiKey({ required: true });
  } catch (e) {
    console.error(`[worker] ${e.message}`);
    process.exitCode = 1;
    return;
  }

  await markCampaignRunning(campaign._id);

  try {
    // 3) Find + meter ACTUAL Places spend (1 request per page fetched).
    const { places, requests } = await searchBusinesses({
      apiKey,
      query,
      maxPages: campaign.maxPages ?? 5,
      log: (m) => console.log(m),
    });
    await addPlacesRequests(requests);
    const usage = await getMonthUsage();
    console.log(
      `[worker] Found ${places.length} businesses in ${requests} request(s). Usage now ${usage.placesRequests}/${cap}.`
    );

    if (places.length === 0) {
      // Empty but successful — advance lastRunAt so rotation moves on next tick.
      const c = await recordCampaignRun(campaign._id, searchLabel, { found: 0 });
      console.log(`[worker] No results. lastRunAt set; done. (${c._id})`);
      return;
    }

    const leads = sortLeads(places.map(qualify));
    const counts = summarizeLeads(leads);
    console.log(`[worker]   HOT ${counts.HOT}  WARM ${counts.WARM}  AUDIT ${counts.AUDIT}  SKIP ${counts.SKIP}`);

    // 4) Audit every operational lead that has a site — DIY only (NO PageSpeed).
    const targets = leads.filter((l) => l.website && l.tier !== "SKIP");
    console.log(`[worker] Auditing ${targets.length} site(s) (DIY, no PageSpeed)`);
    const auditMap = await auditTargets(targets, {
      concurrency: 6,
      pagespeed: false, // MUST stay false — worker never spends PageSpeed quota
      onProgress: (m) => console.log(m),
    });

    // 5) Build canonical records in-memory (reuse recordFrom / #21) — NO CSV.
    const records = leads
      .map((lead) => recordFrom(lead, lead.website ? auditMap.get(lead.website) : null))
      .filter((r) => r.placeId);

    // 6) Upsert straight to Mongo (facts refresh, outreach state preserved).
    const { inserted, updated } = await importRecords(records, { searchLabel });

    // 7) Success — advance the campaign + refresh progress aggregates.
    const c = await recordCampaignRun(campaign._id, searchLabel, { found: places.length });

    console.log(
      `[worker] Done: campaign=${c._id} found=${places.length} inserted=${inserted} updated=${updated} ` +
        `requests=${requests} usage=${usage.placesRequests}/${cap} | ` +
        `progress=${c.progress}% leads=${c.totalLeads} priority=${c.priorityLeads} avgScore=${c.averageScore}`
    );
  } catch (e) {
    await markCampaignError(campaign._id).catch(() => {});
    console.error(`[worker] Run failed for ${campaign._id}: ${e.message}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(`[worker] ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => close());
