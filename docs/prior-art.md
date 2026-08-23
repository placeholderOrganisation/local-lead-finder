# Prior art & build-vs-buy decisions

A landscape review (2026-08) before committing engineering. Conclusion: **build lean on our own
spine, borrow commodity pieces.** No existing open-source tool covers our two differentiators —
**audit-grounded outreach** and a **mockup/demo generator for a scraped prospect** — so the
connective domain logic is genuinely ours to build. Everything commodity we reuse or adapt.

## Reference projects

- **Prospex** — `asiifdev/business-leads-ai-automation` (MIT). The closest full product: Google Maps
  scraping → Bayesian lead scoring → multi-channel AI content (email/WhatsApp/IG/LinkedIn/cold-call)
  → CRM pipeline (New→Contacted→Replied→Won/Lost) → analytics/export → REST API. NestJS + Next.js +
  Postgres + Redis/BullMQ + Docker.
  - **Why we don't fork it:** no site audit, no mockup generator, discovery is Playwright *scraping*
    (we chose the official Places API), scoring is backwards for web-selling (+10 for *having* a
    website), Indonesia-localized, and a heavy multi-tenant SaaS stack vs our lean local-first goal.
  - **What we borrow (MIT):** the Bayesian rating formula (adapted, website signal inverted),
    the multi-channel content structure + mock-fallback pattern, campaign progress aggregates,
    LeadActivity/FollowUp data-model ideas, and vCard export.

- **unlighthouse** — `harlan-zw/unlighthouse` (MIT, 4.7k★). Real Google Lighthouse at scale.
  **Adopted as a component** for on-demand, pitch-grade deep audits of high-priority leads (the
  authoritative "34/100 mobile" score). Our fast DIY audit stays for bulk triage.

- **AI page generators** — e.g. `zinedkaloc/aipage.dev` (MIT). Reference for the mockup generator
  technique (prompt → self-contained HTML page); we generate per-scraped-business, wired to the lead.

## Other options considered (not adopted as base)
- Discovery scrapers: `gosom/google-maps-scraper` (MIT, extracts emails), `omkarcloud/google-maps-
  scraper` (freemium API). Alternatives if Places API cost/ToS-storage ever bites — but scraping
  carries its own ToS/blocking risk.
- Email enrichment: `Josue87/EmailFinder`, website-email-extractors — richer than our mailto/regex
  baseline; optional later.
- Audit signal libraries: `StanGirard/seo-audits-toolkit`, `StJudeWasHere/seonaut` — more pitch ammo.
- Email-only outreach + CRM: `Webeasetech/denshees` — narrower than Prospex; not a fit.

## What stays uniquely ours (the moat)
Site audit → **audit-grounded, money-translated** pitch; the **mockup generator**; **Places API**
discovery; **no-unverified-claims** guard; lean local-first footprint.

## Attribution
Borrowed code/ideas from the MIT projects above are credited here per their licenses; substantial
copied code must retain the original MIT notice.
