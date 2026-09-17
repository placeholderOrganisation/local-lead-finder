# v0 prompt — config-driven business templates

Use this to generate the **6 base type-templates** (salon, trades, restaurant, clinic,
professional, other). Generate ONE type per v0 session: paste the **master prompt**, then the
matching **per-type block** from the bottom. Output is React + TS + Tailwind + shadcn that
renders entirely from one `config` object — so it drops into `template/accountant` (wired to
`useSite()`) and is reusable by local-lead-finder's per-lead configs.

Workflow: generate in v0 → hand the code back to Claude to adapt into a type-template that
reads `config.json` → `npm run deploy:scope` + `npm run seed:scope`.

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
> **Design bar (important):** modern, warm, and visually rich — real hierarchy, generous
> whitespace, a tasteful accent color, rounded cards, soft shadows, good type scale. It must
> look like a premium custom site, **not** a generic admin dashboard and **not** sparse. Use
> tasteful placeholder imagery (gradient panels or `/placeholder.svg?height=..&width=..`) with
> a documented convention so nothing ever looks broken or empty.
>
> **Rules:**
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
