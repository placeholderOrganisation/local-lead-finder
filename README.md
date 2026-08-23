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

## CRM (Phase 1)

Once you've generated CSVs, bring them into a master **MongoDB** collection and
work the leads from a local dashboard. The master collection is deduped by Place
ID, so you can re-run the finder any time — **facts refresh, but your status,
notes, and dates are never overwritten.**

### Setup

1. Create a free MongoDB Atlas cluster ([cloud.mongodb.com](https://cloud.mongodb.com/)),
   add your IP to the access list, and copy the driver connection string.
2. Add it to `.env` (never commit `.env` — it's gitignored):
   ```bash
   MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?appName=Cluster0
   MONGODB_DB=leadfinder        # optional (default: leadfinder)
   PORT=4000                    # optional (dashboard port)
   ```

Still zero runtime dependencies to configure beyond the `mongodb` driver already
in `package.json` (`npm install` once).

### CLI

```bash
# Import one or more category CSVs (upsert; preserves outreach state)
node src/crm-cli.js import leads-accountants-in-brampton-on.csv
npm run crm -- import leads-dentists-in-brampton-on.csv leads-roofers-*.csv

node src/crm-cli.js stats     # totals, per-status counts, due/overdue
node src/crm-cli.js due       # leads whose follow-up is due today or earlier

# Export a filtered view — CSV for spreadsheets, vCard for phone contacts
node src/crm-cli.js export hot-leads.csv --tier HOT
node src/crm-cli.js export new-leads.vcf --vcard --status New
```

Re-importing the same CSV reports `0 inserted / N updated` and leaves every
lead's `status`, `notes`, and dates untouched — that's the core CRM guarantee.

### Dashboard

```bash
npm run dashboard        # serves http://127.0.0.1:4000
```

A single self-contained page (no build step, no external requests, dark-mode
aware): stat tiles, a sortable/filterable lead table, and a drawer to click-to-
call, copy the pitch, and edit status/notes/follow-up dates with **autosave**.
The server binds to loopback only and rejects mutating requests from non-local
origins (CSRF / DNS-rebinding guard).

### Verify

```bash
npm test                 # pure unit tests (lead scoring) — offline
npm run verify:crm       # Phase-1 end-to-end against your Atlas cluster
```

`verify:crm` imports a sample category, edits a lead, re-imports to prove the
edit survives with no duplicates, and merges a second category — cleaning up
after itself. Point it at a real file with `node scripts/verify-crm.mjs <file.csv>`.

## Roadmap

- Background worker: scheduled find → audit → import, quota-aware (Phase 2).
- Outreach prep: money-framed pitch, phone script, email draft, and a mockup of
  the prospect's new site (Phase 3). Human-delivered — no auto-send.
