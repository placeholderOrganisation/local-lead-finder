# Accountant template — static hosting report (#50)

Diagnose-then-fix notes for serving this Next.js app as a **static export**
under many per-lead prefixes (`/{placeId}/…`) from R2 + a Cloudflare Worker.

## Findings (before changes)

| Check | Result |
| --- | --- |
| Framework | Next.js 16 App Router (`app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`). Frontend-only; no `app/api`, no `middleware.ts`, no Server Actions, no `getServerSideProps`, no ISR/`revalidate`. |
| `output: 'export'` | **Missing.** `next.config.mjs` only had `typescript.ignoreBuildErrors` and `images.unoptimized: true`. `next build` would emit a Node server, not `out/`. |
| `next/image` | Not used in pages. `images.unoptimized: true` was already set (safe for export). |
| Server-only features | **None that block export.** Layout imported `@vercel/analytics` (client beacon to Vercel — not a Node runtime, but useless/wrong off Vercel). `next/font/google` is fine: fonts are downloaded at **build** time into `/_next/static/media`. |
| Per-lead data | **Hardcoded.** All three designs baked “ALOE Accounting”, Brampton copy, fake stats, and testimonials into the bundle. No `config.json` fetch. |
| Client navigation | **Would drop `{placeId}`.** `next/link` to `/`, `/about`, `/contact` are origin-absolute. Under `https://mockup-accountant.<sub>.workers.dev/{placeId}/`, those links go to `/about` (no lead, no config). |
| Trailing slash / `index.html` | App Router would emit `out/index.html`, `out/about.html` (or `about/index.html`), `out/contact.html`. The Worker SPA-falls-back **unknown no-ext paths to ROOT `index.html`**, so `/{placeId}/about` would hydrate the **home** HTML at an `/about`-like URL — App Router then 404s. |
| Design switcher | A v0 review artifact (Design 1/2/3). Not appropriate on a prospect mockup. |

### Blocker: App Router + unknown `/{placeId}/` paths

Next App Router static export only hydrates routes listed at build time.
`generateStaticParams` cannot know Place IDs. Serving root `index.html` at
`/{placeId}/` makes App Router see a URL it never generated → client 404.

This is a **routing** constraint of static export, not a server feature. It does
**not** require the design agent. Fix: Pages Router SPA (index + 404 both render
the same client app). Pages Router hydrates `__NEXT_DATA__.page` from the HTML
(`"/"`) while `window.location.pathname` stays `/{placeId}/…`.

No server-only Next feature remained that would force a design-agent rework.

## Changes applied

1. `next.config.mjs`: `output: 'export'`, keep `images.unoptimized`, `trailingSlash: true` (directory `index.html`s).
2. Removed `@vercel/analytics`.
3. Converted to a **single-page** client app (`pages/index.tsx` + `pages/404.tsx`) with path-based views:
   - `/{placeId}/` home
   - `/{placeId}/about/` about
   - `/{placeId}/contact/` contact
4. `placeId` = first pathname segment (skips a leading `preview` so local `/preview/{placeId}/` works). Fetches **`/{placeId}/config.json`** at runtime. Business copy is not baked into the bundle.
5. Internal nav uses `history.pushState` + prefix-aware `<a href>` (not `next/link`).
6. Shipped **Design 1 only** (emerald/professional), bound to the CRM `window.SITE` JSON shape. Designs 2–3 and the switcher were showcase-only and duplicated hardcoded ALOE copy.
7. Generic export metadata + `noindex` (mockups must not be indexed).

## Config contract (runtime JSON)

Same object the CRM already stores as `lead.mockup.config` / previously inlined
as `window.SITE` (now fetched as JSON, not a JS assignment):

```js
{
  business: { name, category, phone, tel, address, mapsUrl, area, rating, reviewCount },
  copy: { heroHeadline, heroSub, about, services: [{ title, desc }], faq: [{ q, a }] },
  reviews: [{ author, rating, text, relativeTime }],
  meta: { preview, generatedAt, placeId }
}
```

## How to verify locally

```bash
npm --prefix template/accountant install
npm --prefix template/accountant run build
# out/index.html + out/_next/**  (no server runtime)

# seed one lead config and serve the export:
mkdir -p template/accountant/out/ChIJ_test
cp template/accountant/public/sample-config.json template/accountant/out/ChIJ_test/config.json
npx --yes serve -s template/accountant/out -p 4173
# -s = SPA fallback (root index.html), same idea as the Worker
# open http://127.0.0.1:4173/ChIJ_test/
```

`out/` is gitignored; deploy (#47) rebuilds it.
