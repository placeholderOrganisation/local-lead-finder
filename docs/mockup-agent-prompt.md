# Mockup agent prompt

Copy everything below the horizontal rule to another agent. That agent should build the site, not this CRM.

---

You are building a send-to-client website mockup for a local-service business (dentist, accountant, plumber, salon, trades, etc.). I will not edit HTML or CSS. I will only edit ONE file — `config.js` — with that client’s details, then send the folder.

Build a beautiful, modern, production-quality marketing site. Not a Bootstrap demo, not a generic startup landing page, not lorem ipsum. It must look like a real 2026 agency-built local business site that a owner would believe is *their* site.

JavaScript is required. A “HTML and CSS only” constraint does **not** apply. You need JS to bind `config.js`, switch three designs, and run mobile nav. Do not lock the visual system to “accounting firm navy/gold” — that is **Design 1’s personality**, and the example config happens to be a Brampton accountant. The same HTML must also look right as a plumber or salon when colors and copy change.

============================================================
GOAL
============================================================
A self-contained static site. No build step, no server required. Opening `index.html` from disk (`file://`) must fully work, including the About page.

```
mockup/
  config.js      ← the ONLY file anyone personalizes
  index.html     ← homepage structure; do not require edits per client
  about.html     ← dedicated About page; same rule
  styles.css     ← all visual design; three variants
  app.js         ← binds config → DOM, design switcher, mobile nav
  README.md
```

There is **no blog, no /resources, no post pages.** Do not add them. About is the extra personalization surface; blogs with invented articles look like a template and fail this brief.

After I fill in `config.js`, the site is ready to send. If a config field is empty, **hide that UI** — never show “undefined”, “Your Business”, leftover placeholders, or empty gray boxes.

============================================================
NON-GOALS
============================================================
- No React, Vue, Vite, npm, Tailwind, Bootstrap, CSS-in-JS, or build step
- No Google Fonts, no icon CDNs, no stock-photo URLs, no Unsplash/picsum
- No Maps/Reviews iframes, no Maps JavaScript API
- No backend, no form POST (contact form is visual only, or mailto/tel)
- Do **not** call the Google Places API, Maps JS, or any Google endpoint from the page. Reviews are already baked into `config.js` by my CRM. No API key in the repo or the page.
- Do not create per-industry HTML files. One template, many configs.
- Do not create a blog
- Do not use `/about` as a server path. Use `about.html` so `file://` works.

============================================================
PERSONALIZATION MODEL
============================================================
`config.js` is the single source of truth:

```js
window.SITE = { ... }
```

HTML uses stable hooks (`id`, `data-bind`, `data-list`, `data-page="home|about"`). `app.js` reads `window.SITE` on load and paints **both** pages. I must never need to touch `index.html`, `about.html`, `styles.css`, or `app.js` for a new client.

Include a **filled example** in `config.js` for a plausible Brampton, Ontario CPA / accounting firm so I can see every key. Comment each field. Invent a real-sounding firm name, phone, address, owner, and services. Include example baked Google reviews (as my CRM would write them). Fill optional sections (credentials, audiences, process, pricing, notice, stats) in the example so those layouts are styled — but the code must still hide them when another client leaves them empty.

Brand colors from config must be written onto `:root` as CSS variables and must restyle buttons, links, focus rings, and active states in **all three designs**.

Required config shape (keep one object; add keys only if a section needs them):

```js
window.SITE = {
  // Meta
  business: "",
  tagline: "",
  category: "",
  yearEstablished: "",          // hide “since” if empty
  previewLabel: "Site preview",
  placeId: "",                  // Google Place ID. CRM uses this to bake reviews. The page does not fetch with it.

  // Locale
  lang: "en",
  area: "",                     // e.g. "Brampton, ON"
  serviceAreas: [],             // extra cities; hide strip if empty
  address: "",
  mapsUrl: "",                  // click-out to Google Maps; do not iframe
  hours: [                      // hide hours block if []
    { day: "Mon–Fri", time: "9:00–17:00" }
  ],

  // Contact
  phone: "",
  email: "",
  ctaPrimary: { label: "Call now", href: "tel:" },
  ctaSecondary: { label: "Request a consult", href: "index.html#contact" },

  // Brand (CSS variables — must restyle all 3 designs)
  colors: {
    accent: "#1f4e3d",
    accentInk: "#ffffff",
    ink: "#122033",
    muted: "#5b6b7c",
    bg: "#f6f3ee",
    card: "#ffffff"
  },
  logoText: "",                 // wordmark; no external image
  logoSvg: "",                  // optional inline SVG markup; else use logoText

  // Nav labels. hrefs: about.html for About; index.html#… for homepage sections.
  // On index.html you may shorten section hrefs to #services etc. in the HTML,
  // but config should use paths that work from both pages.
  nav: [
    { label: "About", href: "about.html" },
    { label: "Services", href: "index.html#services" },
    { label: "Reviews", href: "index.html#reviews" },
    { label: "Contact", href: "index.html#contact" }
  ],

  hero: {
    kicker: "",
    headline: "",
    subhead: "",
    imageCaption: ""            // CSS/SVG visual, not a photo URL
  },

  // Trust / proof (hide each piece if empty)
  stats: [                      // large numerals; hide section if []
    { value: "18", label: "years in practice" }
  ],
  credentials: [],              // short marks e.g. "CPA", "QuickBooks ProAdvisor" — CSS badges, not images
  notice: {                     // hide if heading and body empty
    heading: "",
    body: ""
  },

  about: {
    heading: "About us",
    kicker: "",
    teaser: "",                 // 1–2 sentences on the homepage; links to about.html
    body: "",                   // full story on about.html
    bullets: [],
    values: [                   // hide values block if []
      { title: "", body: "" }
    ],
    owner: {                    // hide bio if name empty. Initials avatar, never a photo URL
      name: "",
      title: "",
      credential: "",
      initials: ""
    }
  },

  services: {
    heading: "Services",
    kicker: "",
    intro: "",
    items: [                    // 3–6
      { title: "", body: "", icon: "chart" }  // icon key from built-in inline-SVG set
    ]
  },

  audiences: {                  // “Who we help”. Hide whole section if items []
    heading: "Who we help",
    intro: "",
    items: [
      { title: "", body: "", bullets: [], icon: "spark" }
    ]
  },

  process: {                    // Hide if steps []
    heading: "How we work",
    intro: "",
    steps: [
      { title: "", body: "" }
    ]
  },

  pricing: {                    // Optional. Hide if tiers []. Never “Buy now”.
    heading: "Engagements",
    intro: "",
    tiers: [
      { name: "", price: "", period: "/ year", featured: false, cta: "Book a consult", features: [] }
    ]
  },

  reviews: {
    heading: "What clients say",
    sourceLabel: "Google reviews",
    rating: 4.9,                // baked from Place Details
    count: 87,
    mapsUrl: "",                // Place Details googleMapsUri
    items: [                    // baked; API returns max 5. Hide grid if []
      {
        author: "",
        authorUrl: "",          // required by Google ToS when present
        photoUrl: "",           // Google lh3 photo; only allowed remote images
        rating: 5,
        date: "2 months ago",
        text: ""
      }
    ]
  },

  faq: {                        // hide section if items []
    heading: "Questions",
    items: [{ q: "", a: "" }]
  },

  contact: {
    heading: "Contact us",
    body: "",
    formEnabled: true           // visual only; submit → mailto: if email set
  },

  footer: {
    blurb: "",
    legal: "Preview only — not the live website."
  },

  defaultDesign: 1,             // 1 | 2 | 3
  showDesignSwitcher: true
}
```

Rules for config:
- I should be able to duplicate `config.js`, change ~20 fields (including `placeId`), and send it.
- Empty arrays/strings hide the corresponding block.
- Phone numbers in `href`s must be sanitized (`tel:` digits and leading `+` only).
- Never require a marketing image URL. Visuals = CSS gradients, patterns, geometric shapes, initials avatars, and inline SVG.
- `placeId` is metadata for my CRM. Do not fetch it from the browser.

============================================================
PAGES
============================================================
Two pages, shared chrome (switcher, header, footer, mobile call bar). Same `styles.css` and `app.js`. Logo always links to `index.html`. Active nav state: About is current on `about.html`; otherwise match the homepage section if obvious, else Home.

### index.html (homepage), in order
1. Design switcher chrome — only if `showDesignSwitcher`
2. Skip-to-content
3. Header — logo/wordmark, nav, primary CTA; sticky; working mobile menu
4. Hero — kicker, one H1, subhead, two CTAs. Split layout: copy + CTAs on one side; a **trust panel** on the other (year established, review score + count, one stat if present). Distinctive CSS/SVG visual — not a photo, not a centered grey box.
5. Notice / callout — if `notice` is set (e.g. a deadline reminder)
6. Trust bar — rating + review count, area served, year established, credential badges. Skip empty pieces; hide the bar if nothing remains.
7. About teaser — short `about.teaser` (+ optional bullets), owner initials if present, link **“Read our story” → about.html**. Do not dump the full about body here.
8. Services — eyebrow/kicker, H2, intro, card grid from `services.items` (icon, title, 2-line description). “Learn more” may go to `#contact`. Do not invent per-service pages.
9. Who we help — if `audiences.items` exist
10. Process — numbered steps. Connected by a CSS line on desktop; stacked on mobile. If `process.steps` exist
11. Pricing — if `pricing.tiers` exist. 2–3 cards, featured tier gets an accent border. Price as “from $X / period” plus consult CTA. No fake Buy Now.
12. Reviews — aggregate stars + quote cards from baked `reviews` (see Reviews section)
13. FAQ — native `<details>` / `<summary>` only; no JS accordion
14. Contact / CTA band — headline, body, optional form (text, email, tel, select of service titles, textarea, submit). Visible labels, required markers, CSS-only error/success styles (no JS validation). Aside: address, phone, email, hours, each with a small SVG icon. Map is a **link** (`mapsUrl`), never an iframe.
15. Footer — 3 columns (firm blurb, services list, contact). Small print, credentials row if set, © year + business name, legal line. No “Resources” / blog column.

### about.html (About page), in order
Same skip link, switcher, header, footer, mobile call bar.

1. Page hero — kicker, **one H1** (`about.heading`), short lead-in. Not a duplicate of the homepage H1.
2. Story — two-column on desktop: full `about.body` + bullets | stats as large numerals with short labels
3. Owner — initials avatar (CSS, from `about.owner.initials`), name, title, one-line credential
4. Values — if `about.values` exist
5. Credentials + service areas
6. CTA band — reuse primary/secondary CTAs; do not require a second form if the homepage form exists, but include phone/email/address and a link to `index.html#contact`

If `about.body` and `about.teaser` are both empty, still render chrome; hide empty story blocks.

============================================================
THREE DESIGNS (same content, different look)
============================================================
Fixed top bar, clearly **PREVIEW CHROME**, not part of the client’s brand:

```
[ Site preview ]     Design 1   2   3
```

Clicking 1 / 2 / 3 sets `<html data-design="1|2|3">` and restyles **immediately**. Same DOM, no reload. Persist in `localStorage` so the choice survives `index.html` ↔ `about.html`. `aria-pressed` on the active button. Default from `config.defaultDesign`.

The three looks must be unmistakably different — not three palettes of the same layout:

**Design 1 — Editorial / professional**
Light paper, warm off-white ground, serif headlines (`Georgia` / `ui-serif`), generous whitespace, classic top nav. Calm, precise, trustworthy. Cards: light border + **soft** shadow, 8–12px radius. This is the “financial services / clinic / law” look. Config accent may be navy/gold, forest, etc. — do not hardcode navy; use the tokens. Avoid heavy drop shadows and loud mesh gradients **in this design**.

**Design 2 — Dark / high-contrast**
Near-black, huge sans type, hairline borders, electric use of `accent`, full-viewport hero. Feels like a premium studio site. Different radius, type scale, and hero composition than Design 1.

**Design 3 — Bold / split**
Asymmetric color-blocked hero, stronger geometry, overlapping cards, warmer energy. Feels more “new brand / trades / hospitality.” Must not read as a recolor of Design 1.

Shared type scale via `clamp()`. Shared 8px spacing scale. System fonts only (`ui-sans-serif`, `ui-serif`, Georgia, system-ui, -apple-system). **No Google Fonts.**

Group `styles.css` as: tokens → switcher → components → layout → pages → `[data-design="1"|"2"|"3"]` overrides → print.

============================================================
VISUAL SYSTEM (QUALITY BAR)
============================================================
This will be shown to a business owner as “here is your new site.” If it looks like a template, it fails.

Must have:
- Distinctive hero (mesh/radial/grid texture, inline SVG mark, or split color panel — **not** a centered grey box)
- Real hierarchy: one loud H1 per page, calm body, tight tracking on headlines, body line-height ~1.6
- Max content width ~1120–1200px; generous section padding; not stretched edge-to-edge text
- Cards with depth **or** borders — pick per design, don’t mix randomly
- Button set: primary, secondary, ghost, text-link. Hover / `:focus-visible` / disabled. Full-width on small screens where it makes sense. Pill vs sharp radius must match the active design.
- Star ratings as inline SVG, not “*****” text only
- Hover / press states on nav, cards, buttons, summary rows
- Cohesive 8pt spacing; no one-off magic numbers
- Mobile-first: **320px and 375px must not overflow**; hamburger must open/close; tap targets ≥44px
- Desktop ~1200px content width
- WCAG AA contrast for text and buttons on all three designs (test dark Design 2 especially)
- Skip-to-content; semantic `header` / `main` / `nav` / `footer`; `lang` from config
- `:focus-visible` on every interactive control
- `prefers-reduced-motion`: cut large transforms/animations
- Print: hide switcher, nav, forms, mobile call bar; keep type readable
- Clean reusable class names (BEM or similar), not one giant page-specific stylesheet
- Sticky mobile call bar (`tel:`) when phone is set
- Initials avatars and CSS geometric placeholders — no stock photos

Forbidden:
- Lorem ipsum
- Comic / default Times as body
- Rainbow gradients, glassmorphism soup, 12-column clutter
- Equal-padding stacked grey sections with no rhythm
- External images except review `photoUrl` from Google (`lh3.googleusercontent.com`)
- Unsplash, picsum, Google Fonts, Font Awesome, Tailwind CDN
- “Powered by” spam
- Invented blog posts
- Fake “Buy now” / checkout
- Empty states that look unfinished

============================================================
REVIEWS (BAKED GOOGLE BUSINESS PROFILE)
============================================================
The page must NOT contain an API key and must NOT fetch `places.googleapis.com` or `maps.googleapis.com` on load.

My CRM will, at generate time, call Place Details (New) with `config.placeId` and write rating, userRatingCount, googleMapsUri, and up to 5 reviews into `config.reviews`. You **render** that data. Do not invent a parallel testimonial system that duplicates reviews. The Google block **is** the testimonial section. You may visually feature the first quote as a larger pull-quote; still the same `reviews.items`.

UI:
- Big aggregate: “4.9” + SVG stars + “(87 Google reviews)”
- Quote cards (up to 5): author name (link to `authorUrl` if set), optional avatar from `photoUrl` **or** initials if photo missing, stars, relative date, text
- “See all on Google” if `reviews.mapsUrl` or `mapsUrl` is set (`target="_blank" rel="noopener"`)
- Visible Google attribution on the reviews section (required by ToS), e.g. “Reviews from Google”

If `items` is empty but rating/count exist, still show the aggregate (hero trust panel + trust bar) and hide the quote grid.
If nothing is set, hide the reviews section (trust bar may still show area / year / credentials).

============================================================
TECHNICAL CONSTRAINTS
============================================================
- Relative files only. No `http(s)` in `href` / `src` / `url()` / `@import` except: `tel:`, `mailto:`, user-clicked `mapsUrl` / `authorUrl`, and review `photoUrl` (Google).
- Inline SVG icons. Built-in set keyed from config: `phone`, `pin`, `clock`, `chart`, `shield`, `spark`, `quote`, `star`, `check`, `user`. Unknown icon → a generic mark, not a broken image.
- `app.js` vanilla ES5-ish so `file://` works in older Safari; **no ES modules** if they break `file://`. Load with `<script src="config.js">` then `<script src="app.js">`.
- XSS: `textContent` for all config strings (not `innerHTML`), except `logoSvg`, which you must sanitize (allow `svg`, `path`, `g`, `circle`, `rect`, `line` with presentation attrs; strip `script`, `foreignObject`, event handlers).
- Contact form does not POST. If email is set, `mailto:` with subject/body from fields; else prevent default and do nothing.
- Mobile menu: a real `<button>` with `aria-expanded` / `aria-controls`. Escape closes it. Do not rely on a checkbox hack; you already have JS.
- FAQ: native `<details>` / `<summary>` only.
- Do not put CSS in `style=""` on components. Setting CSS variables on `:root` from JS is required and allowed.

============================================================
ACCEPTANCE CHECKLIST (you must verify)
============================================================
[ ] Changing only `config.js` (business, colors, headline, 3 services, baked reviews, phone, placeId, about story) fully rebrands **both** pages
[ ] Empty `faq.items` / `hours` / `yearEstablished` / `reviews.items` / `pricing.tiers` / `audiences.items` / `process.steps` / `notice` hide those blocks
[ ] Design 1 / 2 / 3 switch instantly, look like three different sites, keep the same copy, persist across About ↔ Home
[ ] Switcher is obviously preview chrome, not client branding
[ ] `about.html` works from `file://` via `about.html` (not `/about`)
[ ] Homepage About is a teaser with a link to the full About page — not a duplicate wall of text
[ ] No blog files or nav items
[ ] Mobile 320px and 375px: no horizontal scroll, menu works, Call button works
[ ] No Places/Maps API requests in DevTools on load (Maps/tel/mailto/author/photo clicks are OK)
[ ] No API key anywhere in the files
[ ] No “Lorem”, “Company Name”, or leftover dummy names if config is filled
[ ] Keyboard: tab through nav + CTAs, visible focus, Escape closes the menu
[ ] HTML is valid enough: one `h1` per page, labeled form controls, decorative SVGs `aria-hidden`
[ ] Reviews section shows Google attribution; author names link out when `authorUrl` is set
[ ] Contrast holds on Design 2 (dark)
[ ] Print stylesheet hides chrome/forms

Deliver the files listed above, the example Brampton accountant config filled in (with `placeId` + baked reviews + a real About story + owner), and a short README:

“Edit `config.js` only. Open `index.html`. About is `about.html`. Send the folder. Reviews are filled by the CRM from `placeId` — this page does not call Google.”
