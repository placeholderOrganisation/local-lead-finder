# v0 prompt — config-driven business templates

Use this to generate the **6 base type-templates** (salon, trades, restaurant, clinic,
professional, other). Generate ONE type per v0 session: paste the **master prompt**, then the
matching **per-type block** from the bottom. Output is React + TS + Tailwind + shadcn that
renders entirely from one `config` object — so it drops into `template/accountant` (wired to
`useSite()`) and is reusable by local-lead-finder's per-lead configs.

Workflow: generate in v0 → hand the code back to Claude to adapt into a type-template that
reads `config.json` → `npm run deploy:scope` + `npm run seed:scope`.

---

## Distinctiveness & the wow factor — READ THIS FIRST

Most of these fail the same way: they end up **structurally identical** and just recolored. A
different palette, font, or icon set on the **same skeleton** (sticky top-bar → text-left /
image-right hero → "eyebrow label + heading + 3-col card grid" repeated per section →
split contact-with-map → footer) reads as *one website wearing costumes*. That is a **failure**,
even if each one is individually pretty.

Two non-negotiables for every template:

### 1. A different structural archetype (never a recolor)

Before designing, **look at the templates that already exist in this businessType** and make
yours differ on **at least four** of these axes — not just colour/type:

- **Navigation** — sticky top bar · fixed left **sidebar** with numbered nav · floating
  centered **pill** nav · centered **editorial masthead** (brand centered, nav below) ·
  minimal wordmark-only.
- **Hero** — split text/image · **full-bleed image** with overlay · **type-only** centered (no
  image) · **bento/collage** grid · **split-screen** (message vs. inline form/card) ·
  **oversized kinetic type** bleeding off the edge · **magazine cover**.
- **Services** — 3-col cards · printed **price-list** with dotted leaders · **numbered
  editorial** list · **horizontal snap-scroll** row · **icon-tile** grid · alternating
  full-width feature rows.
- **Section rhythm / composition** — vary the order, the backgrounds (dark bands vs. light),
  asymmetry, sticky rails, full-bleed bands. Do **not** repeat one "eyebrow + centered heading
  + grid" formula down the whole page.
- **Art direction / mood** — commit to a real type system (elegant serif · bold condensed
  display · warm editorial · restrained mono) and a point of view, à la Linear, Arc, Oura,
  or a good print magazine.

Also vary the **connective tissue** — header, section intros, the contact block, and the
footer must **not** be copy-paste identical between templates in the same type.

### 2. One signature "wow" moment (required)

Every template needs **one bespoke, memorable element** that makes it feel custom-built rather
than generated. It should be genuinely of-the-business, not decoration. Examples that have
worked:

- Barbershop → **printed price-list menu** with dotted leaders, on a fixed-sidebar layout
- Nail bar → **bento-collage hero** + a running **marquee** of services
- Med-spa → **type-only editorial hero** + full-width image bands + numbered treatment list
- Electrician → **split-screen hero** with an inline quote form on a solid colour panel
- Landscaper → **full-bleed image hero** + a **before/after** section
- Plumber → **24/7 emergency banner** + a utility "stats" panel (response time, $0 surcharge)
- Fitness → **oversized kinetic type**, a **marquee**, and a weekly **timetable with today lit**
- Cleaning → a **draggable before/after reveal slider** as the hero centerpiece
- Photography → **magazine-cover hero** + a **sticky caption rail** beside a scrolling gallery
- Premium/analytics → **animated count-up** hero stats, 3D **glare cards**, a traveling
  **BorderBeam** on the featured card

Prefer one strong idea executed well over many small flourishes. Keep it accessible and honor
`prefers-reduced-motion`.

**Self-check before shipping:** *If I recolored this to match another template in the same
type, would they look like the same site?* If yes, the structure isn't different enough — go
back to the archetype menu above.

---

## MASTER PROMPT (paste first)

> Build a polished, modern **marketing website template** for a **{{BUSINESS_TYPE}}**, as
> React + TypeScript components styled with Tailwind CSS and shadcn/ui.
>
> This is a **template**, not a one-off site: **every** piece of visible text and business
> identity comes from a single typed `config` object. There must be **no hardcoded** business
> names, copy, phone numbers, or addresses anywhere in the markup — I swap the config to reuse
> this template for hundreds of real businesses.
>
> **Data contract** — the whole tree is driven by one `config: SiteConfig`:
>
> ```ts
> type SiteService = { title: string; desc: string; price?: string }
> type SiteFaq = { q: string; a: string }
> type SiteReview = { author: string; rating: number; text: string; relativeTime: string }
> type SiteConfig = {
>   business: {
>     name: string
>     category: string          // e.g. "Hair salon"
>     phone: string             // display, e.g. "(905) 555-0142"
>     tel: string               // href, e.g. "tel:+19055550142"
>     address: string
>     mapsUrl: string           // Google Maps link for the "Directions" button
>     area: string              // e.g. "Brampton, ON"
>     rating: number | null     // e.g. 4.9
>     reviewCount: number | null
>     hours?: { day: string; value: string }[]   // optional; e.g. { day:"Mon–Fri", value:"9–6" }
>   }
>   copy: {
>     heroHeadline: string
>     heroSub: string
>     about: string             // 1–2 paragraphs
>     services: SiteService[]
>     faq: SiteFaq[]
>   }
>   reviews: SiteReview[]
>   gallery?: { caption: string }[]              // optional; render as image cards w/ placeholders
>   booking?: { enabled: boolean; label?: string; url?: string }  // optional; see per-type notes
>   primaryCta?: { label: string; href: string } // optional; defaults to phone/booking
> }
> ```
>
> **Structure** (single page, anchor-scrolled; no router):
> 1. Sticky header — brand = first initial of `business.name` in a rounded badge + the name;
>    a click-to-call using `business.tel`; a primary CTA button.
> 2. Hero — `copy.heroHeadline` + `copy.heroSub` + primary CTA + a supporting visual.
> 3. Trust bar — `business.rating` (stars) · `reviewCount` · `area` · any credibility chips.
> 4. Services — cards from `copy.services` (show `price` when present).
> 5. **{{LEAD_SECTION}}** — the standout section for this business type (see per-type block).
> 6. About — `copy.about`, with a secondary visual.
> 7. Reviews — from `reviews[]` (stars + author + relativeTime). Hide if empty.
> 8. FAQ — accordion from `copy.faq`. Hide if empty.
> 9. Contact — address, a "Get directions" button using `business.mapsUrl`, `business.hours`.
> 10. Footer — name, area, phone, small print.
>
> **Design bar (important):** modern and visually rich — real hierarchy, generous whitespace,
> a confident point of view, a genuine type system, good type scale. It must look like a
> premium **custom** site (think Linear, Arc, Oura, or a good print magazine), **not** a
> generic admin dashboard, **not** sparse, and **not** a recolored version of the other
> templates. **Commit to one structural archetype and one signature "wow" moment** (see
> "Distinctiveness & the wow factor" above) — vary the navigation, hero, service layout, and
> section rhythm so this design is clearly its own site. Use tasteful placeholder imagery
> (gradient/flat panels or `/placeholder.svg?height=..&width=..`) with a documented convention
> so nothing ever looks broken or empty.
>
> **Rules:**
> - **Be structurally distinct.** Pick a navigation pattern, hero archetype, and service layout
>   this businessType doesn't already use, and give the design one signature "wow" moment. A
>   recolor of an existing template is a failure — see "Distinctiveness & the wow factor".
> - Render from `config` ONLY. If an array is empty or a string is blank, **hide that section**
>   gracefully — never show empty placeholders or "undefined".
> - Mobile-first and accessible: semantic landmarks, visible focus states, aria labels on icon
>   buttons, and respect `prefers-reduced-motion`.
> - Fully self-contained: **no external data fetching, no API calls, no auth, no router**.
> - Export a single default component `SiteTemplate({ config }: { config: SiteConfig })`.
> - Include a **sample `config` fully populated** with realistic {{BUSINESS_TYPE}} content (6+
>   services, 3 FAQ, 3 reviews, hours, and — where the per-type block says so — `booking` and
>   `gallery`) so the v0 preview renders a complete, beautiful page.
>
> **Booking:** where `booking.enabled` is true, render a prominent booking section with a clean
> appointment-picker UI (service + day + time, visual only) whose primary action is a **CTA
> button/link** (label from `config.booking.label`, default "Book an appointment") that opens
> `config.booking.url` in a new tab (`target="_blank" rel="noopener noreferrer"`) — this links
> out to our booking app. **No iframe, no embed, no fetch.**

---

## PER-TYPE BLOCKS (paste one, after the master prompt)

Replace `{{BUSINESS_TYPE}}` and `{{LEAD_SECTION}}` accordingly. Palettes are starting points —
the goal is that the six templates feel like different businesses, not one recolored template.

**1. Salon & wellness** — `{{BUSINESS_TYPE}}` = "hair salon / spa / wellness studio".
Lead section = **Booking** (`booking.enabled: true`): appointment picker + service menu with
prices + a work gallery. Palette: warm blush/mauve or sage, elegant serif headings.

**2. Trades & home services** — plumber / electrician / HVAC / landscaping.
Lead section = **Get a quote + click-to-call**: big phone CTA, "areas we serve" list, a short
quote-request form (visual only), licensed/insured trust badges, before/after gallery.
Palette: strong navy/orange, bold sans, sturdy and trustworthy.

**3. Restaurant or food** — restaurant / cafe / takeout.
Lead section = **Menu** (sectioned with prices) + hours + map + a "Reserve / Order online" CTA;
appetizing dish gallery. Palette: deep charcoal + warm amber, appetite-friendly, photo-forward.

**4. Clinic or practice** — dental / physio / medical / veterinary.
Lead section = **Request an appointment** (`booking.enabled: true`) + credentials/insurance +
calm reassurance. Palette: clean teal/blue, lots of white, calm and clinical-but-human.

**5. Professional services** — law / accounting / consulting / agency.
Lead section = **Book a consultation** + case results / past work + credibility logos.
Palette: refined navy/slate with a sharp accent, confident and corporate-clean.

**6. Something else (generic local business)** — flexible neutral template.
Lead section = **Contact + enquiry CTA**, balanced services/gallery/reviews. Palette: neutral,
modern, easily recolored (a single accent variable).
