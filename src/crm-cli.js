#!/usr/bin/env node
// Local Lead Finder — CRM CLI. Bring leads-*.csv files into the master DB and
// run quick status checks. Matches the hand-rolled arg-parser idiom used by the
// other src/*-cli.js entry points.
//
// Usage:
//   node src/crm-cli.js import <file.csv> [<file2.csv> ...]
//   node src/crm-cli.js stats
//   node src/crm-cli.js due

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv, stringifyCsv } from "./csv.js";
import { csvToRecord } from "./pipeline.js";
import { importRecords, stats, listLeads } from "./store.js";
import { toVCards } from "./vcard.js";
import { close } from "./db.js";

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") return printHelp(!cmd);

  const commands = { import: cmdImport, stats: cmdStats, due: cmdDue, export: cmdExport };
  const handler = commands[cmd];
  if (!handler) {
    console.error(`Unknown command: ${cmd}`);
    return printHelp(true);
  }

  handler(rest)
    .catch((e) => {
      console.error(`\n${e.message}\n`);
      process.exitCode = 1;
    })
    .finally(() => close());
}

async function cmdImport(files) {
  if (files.length === 0) {
    console.error("\nMissing <file.csv>. Usage: crm-cli import <file.csv> [...]\n");
    process.exitCode = 1;
    return;
  }

  let totalIn = 0;
  let totalUp = 0;
  for (const file of files) {
    const rows = parseCsv(readFileSync(file, "utf8"));
    const records = rows.map(csvToRecord).filter((r) => r.placeId);
    const searchLabel = labelFromFile(file);
    const { inserted, updated } = await importRecords(records, { searchLabel });
    totalIn += inserted;
    totalUp += updated;
    console.log(`${basename(file)}: ${inserted} inserted, ${updated} updated  (label: ${searchLabel})`);
  }
  if (files.length > 1) console.log(`\nTotal: ${totalIn} inserted, ${totalUp} updated`);
}

async function cmdStats() {
  const s = await stats();
  console.log(`\nCRM stats`);
  console.log(`  Total leads: ${s.total}`);
  console.log(`  By status:`);
  for (const [status, n] of Object.entries(s.byStatus)) {
    console.log(`    ${status.padEnd(10)} ${n}`);
  }
  console.log(`  Due today: ${s.dueToday}   Overdue: ${s.overdue}`);
}

async function cmdDue() {
  const due = await listLeads({ due: true });
  if (due.length === 0) {
    console.log("\nNothing due. Inbox zero.");
    return;
  }
  console.log(`\nDue follow-ups (${due.length}):`);
  for (const l of due) {
    console.log(`  • ${l.business || "(no name)"} — ${l.phone || "no phone"} — ${fmtDate(l.followUpDate)}`);
  }
}

// Columns for the CRM CSV export (business + audit facts + outreach state).
const EXPORT_COLUMNS = [
  ["Priority", "Priority"], ["Tier", "Tier"], ["Business", "Business"], ["Phone", "Phone"],
  ["Email", "Email"], ["Website", "Website"], ["Category", "Category"], ["Address", "Address"],
  ["Rating", "Rating"], ["Reviews", "Reviews"], ["Status", "Status"], ["Notes", "Notes"],
  ["FollowUp", "Follow-up"], ["Contacted", "Contacted"], ["Issues", "Issues"], ["Pitch", "Pitch"],
  ["MapsUrl", "Google Maps"], ["PlaceId", "Place ID"],
];

async function cmdExport(argv) {
  const filter = {};
  let outFile;
  let vcard = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vcard") vcard = true;
    else if (a === "--status") filter.status = argv[++i];
    else if (a === "--tier") filter.tier = argv[++i];
    else if (a === "--category") filter.category = argv[++i];
    else if (a === "--text") filter.text = argv[++i];
    else if (!a.startsWith("--") && !outFile) outFile = a;
    else console.error(`Ignoring unknown export option: ${a}`);
  }

  if (!outFile) {
    console.error("\nMissing <file>. Usage: crm-cli export <file.csv|file.vcf> [--vcard] [--status ..] [--tier ..]\n");
    process.exitCode = 1;
    return;
  }

  const asVcard = vcard || /\.vcf$/i.test(outFile);
  const leads = await listLeads(filter);

  if (asVcard) {
    writeFileSync(outFile, toVCards(leads));
  } else {
    writeFileSync(outFile, stringifyCsv(leads.map(exportRow), EXPORT_COLUMNS));
  }
  console.log(`Exported ${leads.length} lead(s) -> ${outFile} (${asVcard ? "vCard" : "CSV"})`);
}

function exportRow(l) {
  return {
    Priority: l.priority ?? "",
    Tier: l.tier ?? "",
    Business: l.business ?? "",
    Phone: l.phone ?? "",
    Email: l.email ?? "",
    Website: l.website ?? "",
    Category: l.category ?? "",
    Address: l.address ?? "",
    Rating: l.rating ?? "",
    Reviews: l.reviews ?? "",
    Status: l.status ?? "",
    Notes: l.notes ?? "",
    FollowUp: dateCell(l.followUpDate),
    Contacted: dateCell(l.contactedDate),
    Issues: Array.isArray(l.issues) ? l.issues.join("; ") : l.issues ?? "",
    Pitch: l.pitch ?? "",
    MapsUrl: l.mapsUrl ?? "",
    PlaceId: l._id ?? l.placeId ?? "",
  };
}

function dateCell(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

// "leads-accountants-in-brampton-on.csv" -> "accountants-in-brampton-on"
function labelFromFile(file) {
  return basename(file)
    .replace(/\.csv$/i, "")
    .replace(/^leads-/, "");
}

function fmtDate(d) {
  if (!d) return "no date";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? String(d) : date.toISOString().slice(0, 10);
}

function printHelp(missingCmd) {
  if (missingCmd) console.log("\nTell me what to do: import | stats | due | export");
  console.log(`
CRM CLI — import leads into the master DB and check status.

Usage:
  node src/crm-cli.js import <file.csv> [<file2.csv> ...]   Upsert leads (preserves outreach state)
  node src/crm-cli.js stats                                 Totals + per-status + due/overdue
  node src/crm-cli.js due                                   List leads whose follow-up is due
  node src/crm-cli.js export <file.csv> [filters]           Export filtered leads to CSV
  node src/crm-cli.js export <file.vcf> --vcard [filters]   Export filtered leads to vCard

Filters (export): --status <s>  --tier <t>  --category <c>  --text <q>

Notes:
  • import derives a search label from the filename (leads-<slug>.csv -> <slug>).
  • Re-importing the same CSV updates facts but never overwrites status/notes/dates.
  • export infers vCard from a .vcf extension or --vcard (great for phone outreach).
`);
}

main();
