#!/usr/bin/env node
// Local Lead Finder — site auditor (Part 2), standalone.
//
// Reads a leads CSV from Part 1 and writes ONE enriched CSV containing every
// lead, with audit columns + pitch filled in for those with a website.
//
// Usage:
//   node src/audit-cli.js --in leads-accountants-in-brampton.csv
//   node src/audit-cli.js --in leads.csv --pagespeed
//   node src/audit-cli.js --in leads.csv --tiers AUDIT,WARM --concurrency 8

import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv, stringifyCsv } from "./csv.js";
import { auditTargets, summarizeAudits, printSummary } from "./auditor.js";
import { csvToLead, buildUnifiedRows, UNIFIED_COLUMNS } from "./pipeline.js";
import { getApiKey } from "./env.js";

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.in) return printHelp(!args.in && !args.help);

  const parsed = parseCsv(readFileSync(args.in, "utf8"));
  if (parsed.length === 0) {
    console.error(`No rows found in ${args.in}.`);
    process.exit(1);
  }

  const leads = parsed.map(csvToLead);
  const tiers = (args.tiers ?? "AUDIT,WARM").split(",").map((s) => s.trim().toUpperCase());
  const targets = leads.filter((l) => l.website && tiers.includes(l.tier));

  let apiKey;
  if (args.pagespeed) {
    try {
      apiKey = getApiKey({ required: true });
    } catch (e) {
      console.error(`\n--pagespeed needs an API key.\n${e.message}\n`);
      process.exit(1);
    }
  }

  console.log(`\nLoaded ${leads.length} leads from ${args.in}`);
  console.log(
    `Auditing ${targets.length} with a website (tiers: ${tiers.join(", ")})` +
      (args.pagespeed ? " + PageSpeed (slower)" : "") +
      "\n"
  );
  if (targets.length === 0) {
    console.log("Nothing to audit. Try --tiers HOT,WARM,AUDIT or check the input file.");
    return;
  }

  run({ args, leads, targets, apiKey }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

async function run({ args, leads, targets, apiKey }) {
  const auditMap = await auditTargets(targets, {
    concurrency: args.concurrency ?? 6,
    pagespeed: !!args.pagespeed,
    apiKey,
    onProgress: (m) => console.log(m),
  });

  const rows = buildUnifiedRows(leads, auditMap);
  const outPath = args.out ?? args.in.replace(/\.csv$/i, "") + "-audited.csv";
  writeFileSync(outPath, stringifyCsv(rows, UNIFIED_COLUMNS));

  printSummary(summarizeAudits(auditMap), args.pagespeed, rows);
  console.log(`\nSaved ${rows.length} lead(s) (all leads + audit) -> ${outPath}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "-h":
      case "--help": args.help = true; break;
      case "--in": args.in = argv[++i]; break;
      case "--out": args.out = argv[++i]; break;
      case "--tiers": args.tiers = argv[++i]; break;
      case "--pagespeed": args.pagespeed = true; break;
      case "--concurrency": args.concurrency = Number(argv[++i]); break;
      default:
        console.error(`Unknown option: ${argv[i]}`);
        args.help = true;
    }
  }
  return args;
}

function printHelp(missingIn) {
  if (missingIn) console.log("\nMissing --in <leads.csv>.");
  console.log(`
Site auditor — find sellable weaknesses in leads' websites.

Usage:
  node src/audit-cli.js --in leads-accountants-in-brampton.csv
  node src/audit-cli.js --in leads.csv --pagespeed
  node src/audit-cli.js --in leads.csv --tiers AUDIT,WARM,HOT --concurrency 8

Options:
  --in <file.csv>       Leads CSV from Part 1 (required)
  --out <file.csv>      Output path (default: <in>-audited.csv)
  --tiers <list>        Which tiers to audit (default: AUDIT,WARM)
  --pagespeed           Add Google PageSpeed/Lighthouse mobile score (slower;
                        needs the PageSpeed Insights API enabled on your key)
  --concurrency <n>     Parallel site fetches (default: 6)
  -h, --help            Show this help
`);
}

main();
