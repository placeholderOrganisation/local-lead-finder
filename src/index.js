#!/usr/bin/env node
// Local Lead Finder — CLI
//
// Usage:
//   node src/index.js --city "Austin, TX" --category "roofers"
//   node src/index.js --query "roofers in Austin, TX" --out austin-roofers.csv
//   node src/index.js --city "Austin, TX" --category "dentists" --hot-only
//
// Reads GOOGLE_PLACES_API_KEY from the environment or a .env file.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchBusinesses } from "./places.js";
import { qualify, sortLeads, toCsv, summarize } from "./leads.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  loadEnv(join(ROOT, ".env"));
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    fail(
      "No API key found.\n" +
        "  1. cp .env.example .env\n" +
        "  2. paste your key into .env as GOOGLE_PLACES_API_KEY=...\n" +
        "Then re-run."
    );
  }

  const query = buildQuery(args);
  if (!query) {
    fail('Tell me what to search. Use --query "..." or --city "..." --category "...".\nRun with --help for examples.');
  }

  run({ apiKey, query, args }).catch((err) => fail(err.message));
}

async function run({ apiKey, query, args }) {
  console.log(`\nSearching: ${query}`);
  const places = await searchBusinesses({
    apiKey,
    query,
    maxPages: args.maxPages ?? 5,
    log: (m) => console.log(m),
  });

  if (places.length === 0) {
    console.log("\nNo results. Try a broader category or a bigger city.");
    return;
  }

  let leads = sortLeads(places.map(qualify));
  if (args.hotOnly) leads = leads.filter((l) => l.tier === "HOT");

  const counts = summarize(sortLeads(places.map(qualify)));
  const outPath = args.out ?? defaultFileName(query);
  writeFileSync(outPath, toCsv(leads));

  console.log(`\nFound ${places.length} businesses:`);
  console.log(`  HOT   ${counts.HOT}  (no website — best leads)`);
  console.log(`  WARM  ${counts.WARM}  (social/builder only, or newer no-site)`);
  console.log(`  AUDIT ${counts.AUDIT}  (has a site — worth a quality check)`);
  console.log(`  SKIP  ${counts.SKIP}  (closed / not operational)`);
  console.log(`\nSaved ${leads.length} row(s) -> ${outPath}`);
  if (!args.hotOnly && counts.HOT > 0) {
    console.log(`Tip: re-run with --hot-only to export just the ${counts.HOT} no-website leads.`);
  }
}

function buildQuery(args) {
  if (args.query) return args.query;
  if (args.category && args.city) return `${args.category} in ${args.city}`;
  return null;
}

function defaultFileName(query) {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `leads-${slug}.csv`;
}

// --- tiny arg parser (no deps) ---
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "--hot-only":
        args.hotOnly = true;
        break;
      case "--query":
        args.query = argv[++i];
        break;
      case "--city":
        args.city = argv[++i];
        break;
      case "--category":
        args.category = argv[++i];
        break;
      case "--out":
        args.out = argv[++i];
        break;
      case "--max-pages":
        args.maxPages = Number(argv[++i]);
        break;
      default:
        console.error(`Unknown option: ${a}`);
        args.help = true;
    }
  }
  return args;
}

// Minimal .env loader — avoids a dotenv dependency.
function loadEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (key.startsWith("#")) continue;
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

function printHelp() {
  console.log(`
Local Lead Finder — find local businesses to sell websites to.

Usage:
  node src/index.js --city "Austin, TX" --category "roofers"
  node src/index.js --query "roofers in Austin, TX"
  node src/index.js --city "Austin, TX" --category "dentists" --hot-only

Options:
  --city <city>        City / area, e.g. "Austin, TX"
  --category <cat>     Business type, e.g. "roofers", "dentists", "salons"
  --query <text>       Full free-text search (overrides --city/--category)
  --out <file.csv>     Output path (default: leads-<query>.csv)
  --hot-only           Export only HOT leads (businesses with no website)
  --max-pages <n>      Max result pages, 20 each (default 5 = up to 100)
  -h, --help           Show this help

Setup:
  cp .env.example .env    # then paste your Google Places API key into .env
`);
}

function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

main();
