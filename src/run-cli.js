#!/usr/bin/env node
// Local Lead Finder — full pipeline (find -> audit) into ONE CSV per category.
//
// Usage:
//   node src/run-cli.js --city "Brampton, ON" --category accountants
//   node src/run-cli.js --city "Austin, TX" --category roofers --pagespeed
//   node src/run-cli.js --query "hvac in Round Rock, TX" --tiers AUDIT,WARM,HOT

import { writeFileSync } from "node:fs";
import { searchBusinesses } from "./places.js";
import { qualify, sortLeads, summarize as summarizeLeads } from "./leads.js";
import { stringifyCsv } from "./csv.js";
import { auditTargets, summarizeAudits, printSummary } from "./auditor.js";
import { buildUnifiedRows, UNIFIED_COLUMNS } from "./pipeline.js";
import { getApiKey } from "./env.js";

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  let apiKey;
  try {
    apiKey = getApiKey({ required: true });
  } catch (e) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }

  const query = args.query || (args.category && args.city ? `${args.category} in ${args.city}` : null);
  if (!query) {
    console.error('\nTell me what to search: --city "..." --category "..."  (or --query "...").\n');
    process.exit(1);
  }

  run({ args, apiKey, query }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

async function run({ args, apiKey, query }) {
  const slug = slugify(query);

  // --- Stage 1: find ---
  console.log(`\n[1/2] Finding businesses: ${query}`);
  const { places } = await searchBusinesses({
    apiKey,
    query,
    maxPages: args.maxPages ?? 5,
    log: (m) => console.log(m),
  });
  if (places.length === 0) {
    console.log("\nNo results. Try a broader category or a bigger city.");
    return;
  }

  const leads = sortLeads(places.map(qualify));
  const counts = summarizeLeads(leads);
  console.log(`\nFound ${places.length} businesses:`);
  console.log(`  HOT ${counts.HOT}  WARM ${counts.WARM}  AUDIT ${counts.AUDIT}  SKIP ${counts.SKIP}`);
  reportHot(leads);

  // --- Stage 2: audit ---
  const tiers = (args.tiers ?? "AUDIT,WARM").split(",").map((s) => s.trim().toUpperCase());
  const targets = leads.filter((l) => l.website && tiers.includes(l.tier));

  console.log(`\n[2/2] Auditing ${targets.length} site(s) (tiers: ${tiers.join(", ")})` +
    (args.pagespeed ? " + PageSpeed (slower)" : "") + "\n");

  const auditMap = await auditTargets(targets, {
    concurrency: args.concurrency ?? 6,
    pagespeed: !!args.pagespeed,
    apiKey,
    onProgress: (m) => console.log(m),
  });

  // --- Merge into one CSV ---
  const rows = buildUnifiedRows(leads, auditMap);
  const outPath = args.out ?? `leads-${slug}.csv`;
  writeFileSync(outPath, stringifyCsv(rows, UNIFIED_COLUMNS));

  if (targets.length) printSummary(summarizeAudits(auditMap), args.pagespeed, rows);
  console.log(`\nDone. ${rows.length} leads (find + audit) -> ${outPath}`);
}

function reportHot(leads) {
  const hot = leads.filter((l) => l.tier === "HOT");
  if (!hot.length) return;
  console.log(`\n  ${hot.length} HOT lead(s) with NO website — call these first:`);
  for (const l of hot.slice(0, 5)) {
    console.log(`   • ${l.name} (${l.phone || "no phone"})${l.reviews ? ` — ${l.reviews} reviews` : ""}`);
  }
}

function slugify(query) {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "-h":
      case "--help": args.help = true; break;
      case "--city": args.city = argv[++i]; break;
      case "--category": args.category = argv[++i]; break;
      case "--query": args.query = argv[++i]; break;
      case "--tiers": args.tiers = argv[++i]; break;
      case "--pagespeed": args.pagespeed = true; break;
      case "--concurrency": args.concurrency = Number(argv[++i]); break;
      case "--max-pages": args.maxPages = Number(argv[++i]); break;
      case "--out": args.out = argv[++i]; break;
      default:
        console.error(`Unknown option: ${argv[i]}`);
        args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Local Lead Finder — full pipeline (find + audit) into ONE CSV per category.

Usage:
  node src/run-cli.js --city "Brampton, ON" --category accountants
  node src/run-cli.js --city "Austin, TX" --category roofers --pagespeed
  node src/run-cli.js --query "hvac in Round Rock, TX" --tiers AUDIT,WARM,HOT

Options:
  --city <city>         City / area
  --category <cat>      Business type
  --query <text>        Full free-text search (overrides city/category)
  --tiers <list>        Tiers to audit (default: AUDIT,WARM)
  --pagespeed           Add Google mobile speed score (slower)
  --concurrency <n>     Parallel site fetches (default 6)
  --max-pages <n>       Result pages, 20 each (default 5)
  --out <file.csv>      Output path (default: leads-<query>.csv)
  -h, --help            Show this help
`);
}

main();
