#!/usr/bin/env node
// Phase-1 (CRM core) end-to-end verification against a real Atlas cluster (#27).
// Proves: import counts, dashboard-style edits persist across "reload", re-import
// preserves outreach state with no duplicate _id, and a second category merges
// without duplicating a shared business.
//
// Usage:  node scripts/verify-crm.mjs [file.csv]   (default: sample.csv)
// Idempotent: it only touches the CSV's own place IDs and cleans up after itself.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv } from "../src/csv.js";
import { csvToRecord } from "../src/pipeline.js";
import { importRecords, listLeads, stats, updateLead } from "../src/store.js";
import { getColl, close } from "../src/db.js";

const file = process.argv[2] || "sample.csv";
const label = basename(file).replace(/\.csv$/i, "").replace(/^leads-/, "");
const label2 = `${label}-cat2`;
const NEW_ID = "SAMPLE_MERGE_NEW";

let passed = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
  console.log("  ok - " + msg);
};

async function main() {
  const leads = await getColl("leads");
  const rows = parseCsv(readFileSync(file, "utf8"));
  const records = rows.map(csvToRecord).filter((r) => r.placeId);
  const ids = [...new Set(records.map((r) => r.placeId))];
  ok(records.length > 0, `parsed ${records.length} records from ${file}`);

  // clean baseline (scoped to this CSV's ids + the synthetic merge lead)
  await leads.deleteMany({ _id: { $in: [...ids, NEW_ID] } });

  console.log("\n[1] import a category");
  const r1 = await importRecords(records, { searchLabel: label });
  ok(r1.inserted === ids.length && r1.updated === 0, `first import: ${r1.inserted} inserted, ${r1.updated} updated`);

  console.log("\n[2] stats reflect the import");
  const s = await stats();
  ok(s.total >= ids.length, `stats.total (${s.total}) >= imported (${ids.length})`);

  console.log("\n[3] edit a lead (as the dashboard drawer would)");
  const target = ids[0];
  const followUp = "2026-09-15";
  await updateLead(target, { status: "Contacted", notes: "e2e: left voicemail", followUpDate: followUp });

  console.log("\n[4] reload (re-query) — edit persists");
  const reread = (await listLeads({})).find((l) => l._id === target);
  ok(reread.status === "Contacted", "status persisted across reload");
  ok(reread.notes === "e2e: left voicemail", "notes persisted across reload");
  ok((reread.followUpDate || "").toString().slice(0, 10) === followUp || new Date(reread.followUpDate).toISOString().slice(0, 10) === followUp,
    "follow-up date persisted across reload");
  ok(Array.isArray(reread.statusHistory) && reread.statusHistory.some((h) => h.status === "Contacted"), "statusHistory recorded the change");

  console.log("\n[5] re-import the SAME CSV — 0 inserted / N updated, edits untouched");
  const r2 = await importRecords(records, { searchLabel: label });
  ok(r2.inserted === 0 && r2.updated === ids.length, `re-import: ${r2.inserted} inserted, ${r2.updated} updated`);
  const afterReimport = await leads.findOne({ _id: target });
  ok(afterReimport.status === "Contacted" && afterReimport.notes === "e2e: left voicemail", "edited status + notes UNCHANGED after re-import");

  console.log("\n[6] no duplicate _id");
  const stored = await leads.countDocuments({ _id: { $in: ids } });
  ok(stored === ids.length, `stored docs (${stored}) == unique place IDs (${ids.length})`);

  console.log("\n[7] second category merges — shared business not duplicated");
  const shared = { ...records[0], category: "Tax preparation" }; // same placeId, different campaign
  const brandNew = { ...records[0], placeId: NEW_ID, business: "Second-Category Only Co" };
  const before = await leads.countDocuments({});
  const rm = await importRecords([shared, brandNew], { searchLabel: label2 });
  ok(rm.inserted === 1 && rm.updated === 1, `merge import: ${rm.inserted} inserted (new), ${rm.updated} updated (shared)`);
  const after = await leads.countDocuments({});
  ok(after === before + 1, "collection grew by exactly one (shared business not duplicated)");
  const sharedDoc = await leads.findOne({ _id: target });
  ok(sharedDoc.searches.includes(label) && sharedDoc.searches.includes(label2), "shared business carries BOTH search labels");
  ok(sharedDoc.status === "Contacted" && sharedDoc.notes === "e2e: left voicemail", "shared business kept its outreach state through the merge");

  console.log("\n[cleanup] removing this run's leads");
  await leads.deleteMany({ _id: { $in: [...ids, NEW_ID] } });

  console.log(`\nALL ${passed} PHASE-1 E2E CHECKS PASSED (${file})`);
}

main()
  .catch((e) => {
    console.error("\n" + e.message + "\n");
    process.exitCode = 1;
  })
  .finally(() => close());
