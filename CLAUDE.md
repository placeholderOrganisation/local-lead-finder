# CLAUDE.md — local-lead-finder

## Scope-tool design previews (Cloudflare Worker + R2)

This repo hosts the **"Scope your site"** design previews shown by the Mintek site
(`professionals` repo). One shared template + per-leaf `config.json`, served from the
`mockup-scope` bucket/worker; the same previews double as shareable outreach assets.

**Before editing the template, the `mockup-scope` worker/bucket, or the seed/deploy
scripts, read [`docs/scope-previews.md`](docs/scope-previews.md).** It covers how the base
design maps to every preview and the exact commands to update it.

Fast reference — updating the base design:
- The 3 base designs are `template/accountant/components/designs/{emerald,dark,soft}.tsx`.
  Editing them changes **all** previews at once.
- Live previews update on `npm run deploy:scope`. The widget's **thumbnails are static
  screenshots** and only refresh on `npm run seed:scope`. Do **both**.
- The template also feeds the outreach previews (`npm run deploy:site -- accountant`,
  `mockup-accountant` bucket) — a separate deploy to the same design source.
