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

## Background worker (Phase 2)

The worker collects leads on autopilot: each tick it runs the **stalest enabled
campaign** — find (Google Places) → audit (fast DIY checks, no PageSpeed) →
import canonical records straight into MongoDB (deduped by Place ID, outreach
state preserved). It is **one-shot by design**: it does one campaign and exits,
so the *schedule* lives outside the code (cron/launchd) and the same binary drops
onto a hosted cron later with zero changes.

### Campaigns

Campaigns are the rotating `{city, category}` search space. Manage them from the
CRM CLI (they're stored in Mongo, no code edits needed):

```bash
node src/crm-cli.js campaign add --city "Brampton, ON" --category roofers
node src/crm-cli.js campaign add --city "Brampton, ON" --category plumbers --cadence 14 --max-pages 5
node src/crm-cli.js campaign list                 # enabled state, last run, progress
node src/crm-cli.js campaign disable roofers-in-brampton-on
node src/crm-cli.js campaign enable  roofers-in-brampton-on
```

`--cadence <days>` (default 14) is how long before a campaign is due again;
`--max-pages <n>` (default 5, 20 results/page) caps how much it fetches per run.

### Run one tick

```bash
npm run worker        # or: node src/worker.js
```

Each run picks the oldest due campaign, imports new/updated leads, increments the
month's Places usage by the **actual** requests spent, and updates the campaign's
`lastRunAt` + progress aggregates (`progress`, `totalLeads`, `priorityLeads`,
`averageScore`). If nothing is due, or the monthly cap is hit, it logs why and
exits without calling Places.

### Monthly cap & cadence

Places Text Search bills **per request** (~5,000 free Pro calls/month, 20 results
each). `MONTHLY_PLACES_CAP` in `.env` (default `4500`) is a hard guard: once the
month's usage reaches it, the worker refuses to start a run. A **few ticks a day**
(e.g. every 4–6 hours) rotating across a handful of campaigns keeps you well
inside the free tier — at `--max-pages 5` that's ≤5 requests per tick.

### Scheduling (cron)

Ready-to-edit examples live in [`deploy/`](deploy/). The wrapper
[`deploy/run-worker.sh`](deploy/run-worker.sh) resolves the repo path, puts
`node` on `PATH` (cron/launchd start with a bare environment), and runs one tick;
the worker itself loads `.env`, so **no secrets go in the crontab**.

```bash
chmod +x deploy/run-worker.sh
crontab -e
# add (replace the path with your repo's `pwd`):
0 */4 * * * /ABS/PATH/local-lead-finder/deploy/run-worker.sh >> /ABS/PATH/local-lead-finder/worker.log 2>&1
```

See [`deploy/crontab.example`](deploy/crontab.example) for more cadences.

### Scheduling (macOS launchd)

Use [`deploy/com.local-lead-finder.worker.plist`](deploy/com.local-lead-finder.worker.plist)
(runs every 4 hours via `StartInterval`):

```bash
# edit the ABSOLUTE paths inside the plist first, then:
cp deploy/com.local-lead-finder.worker.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.local-lead-finder.worker.plist
# to stop:
launchctl unload ~/Library/LaunchAgents/com.local-lead-finder.worker.plist
```

### Deploying to Render later

The worker is env-only and one-shot, so no rewrite is needed: create a **Render
Cron Job** (or background worker) that runs `node src/worker.js` on your cadence,
and set the same env vars in Render's dashboard (`MONGODB_URI`,
`GOOGLE_PLACES_API_KEY`, `MONGODB_DB`, `MONTHLY_PLACES_CAP`).

> **⚠️ Do not publicly deploy the dashboard yet.** The HTTP server binds to
> loopback and rejects non-local origins, but it has **no authentication** — it's
> safe on `localhost` only. Add auth before exposing it (or the worker's Render
> deploy) to the internet.

## Outreach prep (Phase 3)

Drafts stay drafts: the app **never sends** email, texts, or DMs. You prepare
assets in the dashboard, copy them, and deliver through your own channel
(phone, email, Instagram, in person).

### Config

Add these to `.env` (never commit `.env`):

```bash
OPENAI_API_KEY=sk-...          # required for live copy + mockups
OPENAI_MODEL=gpt-4o-mini       # default if unset
SENDER_NAME=Your Name          # signed on email / scripts
LOCAL_AREA="Brampton, ON"      # the area you serve
PORTFOLIO_URL=https://...      # past work, injected into drafts
CALENDAR_URL=                  # optional booking link
```

`npm install` once so `openai` (and optional `unlighthouse`) are available.
Without `OPENAI_API_KEY`, compose/mockup fall back to deterministic templates
so the dashboard still loads.

### Prepare-outreach flow

```bash
npm run dashboard        # http://127.0.0.1:4000
```

1. Open a lead in the drawer.
2. **Prepare outreach** — generates a money-framed `moneyPitch`, an email
   (subject + body), and a phone script. Copy buttons put them on the clipboard.
   Angles differ by segment: no-website leads get a legitimacy / “call first”
   pitch; has-site leads get a lost-customers pitch. A 403/500/unreachable site
   is flagged `needsVerification`: the drawer shows a **verify first** banner
   and the copy **must not** claim the site is down.
3. **Generate mockup** — a self-contained HTML homepage (inline CSS, no
   external requests) served at `/mockup/:placeId`. Preview opens in a new tab.
4. Pick a **contact channel** (phone / email / DM / in person) and mark
   **Contacted**. Nothing is sent for you.

On-demand **Deep audit** (real Lighthouse via unlighthouse) is a separate
button on one lead at a time. It is **never** part of the worker or bulk
import — those stay on the fast DIY fetch audit.

### Mockup hosting caveat

The generated HTML is stored on the lead (`lead.mockup.html`) and previewed
locally. `lead.mockup.publicUrl` stays **`null` until you host it yourself**
(drop the HTML on Netlify/Cloudflare Pages/your own domain) and paste that
URL back if you want to include a live link in outreach. The app does not
publish mockups.

### Verify

```bash
npm test                      # unit tests (scoring, compose mock, mockup isolation)
npm run verify:outreach       # live OpenAI + Mongo: no-website / has-site / 403
```

`verify:outreach` refuses to pass without `OPENAI_API_KEY` and a populated
leads collection.

## Roadmap

- ~~Background worker: scheduled find → audit → import, quota-aware (Phase 2).~~ ✓
- ~~Outreach prep: money-framed pitch, phone script, email draft, and a mockup of
  the prospect's new site (Phase 3). Human-delivered — no auto-send.~~ ✓
