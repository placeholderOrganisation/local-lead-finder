# Two-lane split for parallel agents (Cursor)

Two agents work in parallel. The split is by **layer + file ownership** so the lanes rarely touch
the same file. Each file has exactly ONE owning lane — never edit the other lane's files; depend on
its merged output instead.

## Lane A — Core data pipeline & worker  (`lane:A-core`)
**Owns files:** `src/env.js`, `src/db.js`, `src/store.js`, `src/pipeline.js`, `src/leads.js`,
`src/audit.js`, `src/places.js`, `src/crm-cli.js`, `src/worker.js`
**Mental model:** everything that *produces, scores, and stores* lead data, plus the background
collector. Backend/data only — no HTTP, no UI.

**Order:** #19 → #20 → #21 → #23 → #22 → #24 → #37 → #32 → #29 → #28 → #30 → #31 → #39
(13 tickets)

## Lane B — Server, dashboard & outreach generation  (`lane:B-interface`)
**Owns files:** `src/server.js`, `src/public/index.html`, `src/compose.js`, `src/mockup.js`,
`src/deepaudit.js`
**Mental model:** everything that *serves, presents, and generates outreach* — the HTTP API, the
dashboard SPA, and the AI content/mockup/deep-audit modules.

**Order:** (scaffold vs stubs first) → #25 → #26 → #33 → #34 → #38 → #35 → #27 → #36
(8 tickets)

## The foundation handshake (do this first)
Lane A ships the **contract** before Lane B integrates:
1. **#19** (env/deps) — both lanes need deps + config.
2. **#20** (db) + **#21** (canonical mapper) + **#23** (store: `listLeads`/`stats`/`updateLead`).

Once #19 + #23 are merged, Lane B integrates for real. Until then, Lane B is NOT blocked — it builds
against the **documented shapes in the epic** (canonical record + `leads` doc) using stubs:
- #25 server: boot against a **stubbed store** (the ticket already says so).
- #26 dashboard: render against sample JSON.
- #33 compose / #34 mockup: build with the **mock-fallback** (no DB, no API key needed).

## Cross-lane dependencies (the only sync points)
| Lane B ticket | waits on (Lane A) |
|---|---|
| #25 server | #23 store |
| #33 compose | #19 env, **#32 contact-capture** (email + `needsVerification`) |
| #34 mockup | #19 env, #23 store |
| #38 deep-audit | #23 store |
| #27 Phase-1 e2e | #24 crm-cli (A) + #26 dashboard (B) |

Everything else inside each lane depends only on that lane. Lane A is fully self-contained.

## Execution waves (suggested)
- **Wave 1 (unblock):** A: #19, #20, #21, #23.  B: scaffold #25/#26/#33 vs stubs.
- **Wave 2 (parallel):** A: #22, #24, #37, #32, #29, #28.  B: integrate #25→#26, then #32→#33, #34, #38.
- **Wave 3 (finish):** A: #30, #31, #39.  B: #35, then #27 + #36 verification.

## Rules
- One branch/PR per ticket: `feat/<issue#>-<slug>`, body ends `Closes #<issue#>`.
- Never edit the other lane's owned files. If you need a change there, open/adjust that lane's ticket.
- Conform to the canonical record + `leads` document in the epic (single source of truth).
- Don't start a ticket whose "Depends on" issues aren't merged (see each ticket + the table above).
