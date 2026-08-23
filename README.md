# Local Lead Finder

Find local businesses to sell websites to. Given a city and a business category,
it queries the **Google Places API (New)** and produces a ranked CSV of leads —
with the businesses that have **no website** floated to the top, since those are
the easiest, highest-impact sells.

## How leads are scored

| Tier | Meaning | Why it matters |
|------|---------|----------------|
| **HOT** | No website, and an established business (10+ reviews) | Biggest need, clearly real & has money |
| **WARM** | No website but newer, *or* only a Facebook / Instagram / link-in-bio / free-builder page | Real need, slightly less proven |
| **AUDIT** | Has a real website | Maybe — worth a quality check (mobile, speed, age) before pitching |
| **SKIP** | Closed / not operational | Ignore |

The single signal doing the heavy lifting: the Places API returns a `websiteUri`
field, and its **absence** is your hottest lead.

## Setup

1. Get a Google Places API key:
   - [console.cloud.google.com](https://console.cloud.google.com/) → create/pick a project
   - **APIs & Services → Enable APIs** → enable **Places API (New)**
   - **Credentials → Create credentials → API key**
   - (Recommended) restrict the key to *Places API (New)*
2. Add the key locally:
   ```bash
   cp .env.example .env
   # paste your key into .env as GOOGLE_PLACES_API_KEY=...
   ```

No `npm install` needed — it uses only Node's built-ins (Node 18+).

## Usage

```bash
# City + category
node src/index.js --city "Austin, TX" --category "roofers"

# Only export the no-website (HOT) leads
node src/index.js --city "Austin, TX" --category "dentists" --hot-only

# Full free-text query + custom output file
node src/index.js --query "hvac companies in Round Rock, TX" --out hvac.csv
```

Output is a CSV (default `leads-<query>.csv`) sorted best-lead-first, ready to
open in a spreadsheet and work through.

### Options

| Flag | Description |
|------|-------------|
| `--city <city>` | City / area, e.g. `"Austin, TX"` |
| `--category <cat>` | Business type, e.g. `"roofers"` |
| `--query <text>` | Full free-text search (overrides city/category) |
| `--out <file.csv>` | Output path |
| `--hot-only` | Export only HOT leads |
| `--max-pages <n>` | Result pages (20 each), default 5 (~100 results) |
| `-h, --help` | Help |

## Cost

Requests pull `websiteUri` + phone, which are **Pro-tier** fields:
**5,000 free calls/month**, then ~$25–35 per 1,000. One business ≈ one result;
a search of ~100 businesses costs a handful of calls. You can qualify thousands
of leads a month for free.

## Part 2 — Site auditor & pitch generator

Takes a leads CSV from Part 1, visits each business's website, and flags
concrete, sellable weaknesses — then writes a per-lead pitch line and a priority
score. Fetch-based, no browser or extra API needed.

```bash
node src/audit-cli.js --in leads-accountants-in-brampton.csv
```

Checks per site: reachable / HTTP errors, HTTPS + secure redirect, mobile
viewport, load time, page weight, `<title>` / meta description / `<h1>`, and a
stale copyright year. Output is a single `<in>-audited.csv` containing **every**
lead (no-website HOT leads pinned to the top, audit columns filled in for those
with a site), sorted by priority, with `Issues` and ready-to-use `Pitch` columns.

> **One file per category.** Both the auditor and the `run` command below emit a
> single unified CSV with all leads in it — never a separate leads/audit pair.

| Flag | Description |
|------|-------------|
| `--in <file.csv>` | Leads CSV from Part 1 (required) |
| `--out <file.csv>` | Output path |
| `--tiers <list>` | Which tiers to audit (default `AUDIT,WARM`) |
| `--concurrency <n>` | Parallel fetches (default 6) |

**Caveat:** HTTP 500/404/unreachable results can be bot-blocking (Cloudflare/WAF)
rejecting the crawler rather than a truly broken site — spot-check those in a
browser before pitching. HTTPS / mobile / stale / missing-SEO findings are solid.

### PageSpeed / Lighthouse score (`--pagespeed`)

Add `--pagespeed` to fetch Google's own mobile speed score (0–100) per site —
the most persuasive line in a cold email ("your site scores 34/100 on Google's
mobile speed test"). A low score auto-bumps the lead's priority and leads its
pitch. Slower (real Lighthouse runs server-side), so it's opt-in and throttled.

```bash
node src/audit-cli.js --in leads.csv --pagespeed
```

One-time setup: enable the **PageSpeed Insights API** in the same Google Cloud
project, and if your key is API-restricted, add PageSpeed Insights to its allowed
APIs. Without that you'll see `PSI 403 blocked` (the fetch-based checks still run).

## One-shot pipeline (`run`)

Do find + audit in a single command:

```bash
node src/run-cli.js --city "Brampton, ON" --category accountants
node src/run-cli.js --city "Austin, TX" --category roofers --pagespeed
```

Writes a single `leads-<slug>.csv` with every lead (find + audit merged), prints
the HOT no-website leads to call first, and the audit summary. Accepts the same
`--tiers`, `--pagespeed`, `--concurrency`, and `--max-pages` flags.

## Roadmap

- Auto-generate a mockup/demo homepage for a top lead (the closer).
- Dedupe across searches; multi-category / multi-city batch runs.
