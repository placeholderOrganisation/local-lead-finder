# Handoff: unify outreach mockups onto the new template library

Paste this to an AI agent (or read it yourself) to start the "make outreach previews use the
new templates" work in a fresh session. It builds directly on the scope-tool work already
shipped.

## Goal / outcome

Today the **outreach** mockups (`mockup-accountant` bucket, one per real lead) render the
**old** Next template (`template/accountant`, 3 colour themes). The **scope tool** now renders
the **new** template library (`v0-modern-design-mockups`: 6 business types × N distinct
templates). Make outreach render through the **same new library**, so a lead's real data shows
in a design matched to its industry — and there's **one** template codebase to maintain.

## Why this is small (the key insight)

Both systems already share the same serving shape: a lead/leaf lives at `{bucket}/{slug}/`,
and the deployed SPA fetches `{slug}/config.json`. So unifying is mostly:
1. **Deploy the new app** to the `mockup-accountant` bucket (it already deploys to
   `mockup-scope`).
2. **Tag each lead's `config.json`** with its `businessType` so the app knows which template to
   render.
3. **Teach the new app a "lead mode"**: read the slug from the path, fetch its `config.json`,
   render the matching template with that real data (instead of the template's baked sample).

**Outreach preview URLs do not change** (`https://mockup-accountant.<sub>/{slug}/`), and
`publishMockup` keeps writing `{slug}/config.json` exactly as it does now.

## Current state (grounded in the code)

- **Outreach content**: `src/mockup.js` `buildSiteConfig(lead)` → a `SiteConfig`
  (`business` / `copy` / `reviews` / `meta`), persisted and published to `mockup-accountant`
  by `publishMockup` (`src/r2.js`). Lead carries a free-text `lead.category` (e.g. "Hair
  salon", "Plumber"). No `businessType`, and no `hours`/`gallery`/`booking` yet.
- **New app**: `/Users/sakshamahluwalia/Projects/v0-modern-design-mockups`. Renders a template
  full-bleed at `/?t=<businessType>/<id>` from that template's baked `sampleConfig`. Registry
  in `src/lib/registry.ts` (`getTemplate`, `templatesFor`, `pickN`). Deployed to `mockup-scope`
  via `local-lead-finder/scripts/deploy-mockups.mjs` (+ `shoot-mockups.mjs` for thumbnails).
- **Serving**: shared worker `workers/site/src/worker.js` (envs `accountant`, `scope`), SPA
  fallback serves `index.html` for extensionless paths.
- **Reference for lead-mode**: the OLD app already does exactly the fetch-by-slug pattern —
  `template/accountant/lib/site-context.tsx` (reads slug from path, `fetch("/{slug}/config.json")`,
  `normalizeSite`). Port that idea into the new app.

## The work (three changes)

### 1. Category → businessType map  (`src/business-type.js`, new)
A small pure function `businessTypeFor(category: string): BusinessType` mapping the free-text
`lead.category` to one of the 6 (`salon · trades · restaurant · clinic · professional ·
other`) via keyword rules (salon/spa/barber→salon; plumber/electrician/hvac/roof/landscap→
trades; restaurant/cafe/food/pizza/bar→restaurant; dental/clinic/physio/chiro/vet/medical→
clinic; law/account/consult/realtor/insurance→professional; else→other). Unit-test it
(`node --test`, matches the repo's existing test style).

In `src/mockup.js` `buildSiteConfig`, set `meta.businessType = businessTypeFor(facts.category)`
(and optionally `meta.templateId` if you later want to pin a specific design). Nothing else
about the config needs to change — the new templates hide empty sections, so missing
`hours`/`gallery`/`booking` are fine.

### 2. New app: "lead mode"  (`v0-modern-design-mockups`)
Add a hosted mode to `src/App.tsx` (or a small provider) that mirrors
`template/accountant/lib/site-context.tsx`:
- If the URL path has a lead slug (e.g. `/{slug}/`), `fetch("/{slug}/config.json")`, normalize
  to `SiteConfig`, read `meta.businessType`, choose a template
  (`meta.templateId` if present, else a **stable pick** per slug, e.g.
  `pickN(businessType, hashOf(slug), 1)[0]`), and render `<Template config={fetchedConfig} />`.
- Keep the existing `?t=<businessType>/<id>` sample mode for the picker/scope screenshots.
- Add a `normalizeSite`-style guard (copy from the old `site-config.ts`) so a partial/legacy
  config never crashes a template.

### 3. Deploy + wire
- Parametrize `scripts/deploy-mockups.mjs` to accept a target bucket, and deploy the app to
  **both** `mockup-scope` and `mockup-accountant` (reuse the same walk-dist + `putObject`).
- Redeploy the `accountant` worker once so it has the CORS header and current code
  (`cd workers/site && npx wrangler deploy -e accountant`).
- `publishMockup` is unchanged; regenerate a couple of leads (`buildSiteConfig`) so their
  `config.json` carries `meta.businessType`.
- **Retire** `template/accountant` and the old theme scheme once parity is confirmed.

## Decisions to make in that session
- **One design per lead (recommended)** vs offering 3 — outreach usually wants a single strong
  preview, so a stable per-slug pick is simplest.
- **Enrich `buildSiteConfig`** to populate `hours`/`gallery`/`booking` (nicer previews) now, or
  defer (templates already hide them). Recommend defer.
- **Buckets**: keep `mockup-accountant` and `mockup-scope` separate (recommended — different
  audiences), both running the same app, or consolidate to one.

## Verification
1. `businessTypeFor` unit tests pass; spot-check a few real `lead.category` values.
2. Deploy app to a test slug in `mockup-accountant`; `curl -I {base}/{slug}/` → 200 index.html,
   `{base}/{slug}/config.json` → 200 with `meta.businessType`.
3. Open `{base}/{slug}/` → the matched template renders with the lead's real name/copy (not the
   sample business), empty sections hidden.
4. Confirm the **scope tool still works** (its `mockup-scope` deploy + manifest + thumbnails
   are unaffected).

## Non-goals / guardrails
Don't change the scope-tool widget or its `mockup-scope` manifest/thumbnail flow. Keep
`publishMockup`'s write path and the outreach preview URL shape identical. Don't delete
`template/accountant` until the new app is confirmed at parity on `mockup-accountant`.
