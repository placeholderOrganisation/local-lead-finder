/* ============================================================
   config.js — THE ONLY FILE YOU EDIT PER CLIENT
   ------------------------------------------------------------
   The CRM preview route injects a window.SITE object matching the
   #40 contract (business{}, copy{}, reviews[], meta{}). This checked-in
   file is the richer file:// example; app.js accepts both shapes.
   Empty strings / empty arrays automatically HIDE their block —
   never show "undefined" or an empty gray box.

   The example below is a plausible Brampton, ON accounting firm
   so you can see every field styled. Duplicate this file, change
   ~20 fields (business, colors, headline, 3 services, phone,
   placeId, about story, baked reviews) and you have a new client.
   ============================================================ */
window.SITE = {
  /* ---------- Meta ---------- */
  business: "Halewood & Rao CPA",
  tagline: "Brampton accountants for owner-operated businesses",
  category: "Chartered Professional Accountants",
  yearEstablished: "2006",              // hide "since" if empty
  previewLabel: "Site preview",
  placeId: "ChIJ_ExamplePlaceId_Brampton", // CRM uses this to bake reviews; the page never fetches it

  /* ---------- Locale ---------- */
  lang: "en",
  area: "Brampton, ON",
  serviceAreas: ["Mississauga", "Caledon", "Vaughan", "Georgetown"], // hide strip if empty
  address: "22 Queen St E, Suite 410, Brampton, ON L6V 1A3",
  mapsUrl: "https://maps.google.com/?q=22+Queen+St+E+Brampton+ON",   // click-out only; not an iframe
  hours: [                               // hide hours block if []
    { day: "Mon–Thu", time: "9:00 – 17:30" },
    { day: "Fri", time: "9:00 – 16:00" },
    { day: "Sat – Sun", time: "Closed" }
  ],

  /* ---------- Contact ---------- */
  phone: "+1 905 555 0142",
  email: "hello@halewoodrao.ca",
  ctaPrimary: { label: "Call the office", href: "tel:" },       // href tel: is auto-filled from phone
  ctaSecondary: { label: "Request a consult", href: "index.html#contact" },

  /* ---------- Brand (written to :root as CSS variables; restyles ALL 3 designs) ---------- */
  colors: {
    accent: "#1f4e3d",     // forest green
    accentInk: "#ffffff",  // text/icon color that sits ON the accent
    ink: "#122033",        // primary text
    muted: "#5b6b7c",      // secondary text
    bg: "#f6f3ee",         // page ground (Design 1)
    card: "#ffffff"        // card surface (Design 1)
  },
  logoText: "Halewood & Rao",  // wordmark used when logoSvg is empty
  logoSvg: "",                 // optional inline SVG markup (sanitized); else logoText is used

  /* ---------- Nav (About -> about.html; sections -> index.html#id) ---------- */
  nav: [
    { label: "About", href: "about.html" },
    { label: "Services", href: "index.html#services" },
    { label: "Reviews", href: "index.html#reviews" },
    { label: "Contact", href: "index.html#contact" }
  ],

  /* ---------- Hero ---------- */
  hero: {
    kicker: "Trusted since 2006",
    headline: "Accounting that keeps your business a step ahead",
    subhead: "Year-round tax planning, clean books, and straight answers for Brampton's owner-operated businesses — from one dedicated CPA team.",
    imageCaption: "Local practice · CRA-ready · owner-focused"
  },

  /* ---------- Trust / proof (each piece hides if empty) ---------- */
  stats: [                               // large numerals; hide section if []
    { value: "18", label: "years in practice" },
    { value: "600+", label: "returns filed a year" },
    { value: "1:1", label: "you keep the same CPA" }
  ],
  credentials: ["CPA, CGA", "QuickBooks ProAdvisor", "Xero Certified", "CRA e-File"], // CSS badges, not images
  notice: {                              // hide if heading and body empty
    heading: "2025 corporate filing season is open",
    body: "Book before March 15 to lock in a review slot and avoid the April rush. New clients welcome."
  },

  /* ---------- About ---------- */
  about: {
    heading: "About the firm",
    kicker: "Who we are",
    teaser: "A small Brampton practice built on one idea: you should always be able to reach the person who does your books.",
    body: "Halewood & Rao is a Brampton CPA firm that has looked after owner-operated businesses across Peel Region since 2006. We started the practice after years at larger firms where the client who signed the engagement rarely met the accountant doing the work. We do it the other way around. When you call, you reach the CPA who knows your file — not a call queue and not a rotating junior. We handle year-end and corporate tax, keep your bookkeeping clean and current, and sit down with you before deadlines instead of after them, so tax planning is a conversation and not a surprise. Most of our clients came from a referral, and most have been with us for years.",
    bullets: [
      "One dedicated CPA on your file, start to finish",
      "Proactive planning before deadlines, not scrambling after",
      "Plain-language explanations — no jargon walls",
      "Cloud bookkeeping so your numbers are always current"
    ],
    values: [                            // hide values block if []
      { title: "Clarity", body: "We explain the number and the reason behind it, in language you can act on." },
      { title: "Proactivity", body: "We flag opportunities and deadlines early, so decisions are never rushed." },
      { title: "Continuity", body: "You keep the same accountant year over year — someone who knows your history." }
    ],
    owner: {                             // hide bio if name empty; initials avatar, never a photo
      name: "Priya Rao",
      title: "Principal, CPA, CGA",
      credential: "20+ years in owner-managed tax & advisory",
      initials: "PR"
    }
  },

  /* ---------- Services (3–6) ---------- */
  services: {
    heading: "Services",
    kicker: "What we do",
    intro: "Everything an owner-operated business needs to stay compliant, tax-efficient, and clear on the numbers.",
    items: [
      { title: "Corporate & personal tax", body: "T2 and T1 preparation with year-round planning to keep what you've earned.", icon: "chart" },
      { title: "Bookkeeping & payroll", body: "Clean, current cloud books and reliable payroll so nothing falls behind.", icon: "check" },
      { title: "Year-end & financials", body: "Compilation engagements and financial statements your bank will accept.", icon: "shield" },
      { title: "CRA support", body: "We handle reviews, audits, and CRA correspondence on your behalf.", icon: "spark" },
      { title: "Business advisory", body: "Cash flow, incorporation, and structure advice as your business grows.", icon: "user" },
      { title: "HST & remittances", body: "Filings and remittances tracked and submitted on time, every period.", icon: "clock" }
    ]
  },

  /* ---------- Who we help (hide whole section if items []) ---------- */
  audiences: {
    heading: "Who we help",
    intro: "We specialize in the businesses that make up Brampton's main street and trades.",
    items: [
      { title: "Incorporated trades", body: "Electricians, plumbers, and contractors who need clean books and smart tax structure.", bullets: ["T2 & payroll", "HST tracking", "Vehicle & tool deductions"], icon: "spark" },
      { title: "Professional practices", body: "Doctors, dentists, and consultants managing corporate and personal tax together.", bullets: ["Income splitting", "Corporate planning", "Retirement structure"], icon: "shield" },
      { title: "Retail & hospitality", body: "Shops and restaurants that need reliable bookkeeping and honest cash-flow advice.", bullets: ["Daily sales books", "Payroll", "HST remittance"], icon: "chart" }
    ]
  },

  /* ---------- Process (hide if steps []) ---------- */
  process: {
    heading: "How we work",
    intro: "A simple, predictable engagement from first call to filing.",
    steps: [
      { title: "Free consult", body: "A 30-minute call to understand your business and what you need." },
      { title: "Clear proposal", body: "A fixed-scope engagement letter — no surprise hourly bills." },
      { title: "We do the work", body: "Books, tax, and planning handled by your dedicated CPA." },
      { title: "Ongoing review", body: "Check-ins before deadlines so you're always ahead of CRA." }
    ]
  },

  /* ---------- Pricing (optional; hide if tiers []; never "Buy now") ---------- */
  pricing: {
    heading: "Engagements",
    intro: "Fixed annual pricing so you always know the cost. Final scope is set in your consult.",
    tiers: [
      { name: "Sole proprietor", price: "from $900", period: "/ year", featured: false, cta: "Book a consult", features: ["Personal T1 with business income", "HST filing", "Year-round email support"] },
      { name: "Incorporated business", price: "from $2,400", period: "/ year", featured: true, cta: "Book a consult", features: ["Corporate T2 & financials", "Owner personal T1", "Payroll & HST", "Quarterly planning call"] },
      { name: "Bookkeeping add-on", price: "from $250", period: "/ month", featured: false, cta: "Book a consult", features: ["Monthly cloud bookkeeping", "Bank reconciliation", "Management reports"] }
    ]
  },

  /* ---------- Reviews (BAKED by the CRM from placeId — the page never calls Google) ---------- */
  reviews: {
    heading: "What clients say",
    sourceLabel: "Reviews from Google",
    rating: 4.9,                          // from Place Details
    count: 87,
    mapsUrl: "https://maps.google.com/?cid=EXAMPLE",  // Place Details googleMapsUri
    items: [                              // API returns up to 5; hide grid if []
      { author: "Daniel M.", authorUrl: "https://maps.google.com/?cid=EXAMPLE#daniel", photoUrl: "", rating: 5, date: "2 months ago", text: "Priya has done our corporate taxes for six years. Always ahead of deadlines and always reachable. Switched from a big firm and never looked back." },
      { author: "Sandra K.", authorUrl: "https://maps.google.com/?cid=EXAMPLE#sandra", photoUrl: "", rating: 5, date: "3 months ago", text: "They cleaned up two years of messy books and got our HST sorted with CRA. Calm, clear, and genuinely helpful. Highly recommend for small business." },
      { author: " Amit P.", authorUrl: "", photoUrl: "", rating: 5, date: "5 months ago", text: "Straightforward pricing and no jargon. I actually understand my numbers now. Best decision I made for my contracting business." },
      { author: "Lena T.", authorUrl: "", photoUrl: "", rating: 4, date: "8 months ago", text: "Responsive and thorough. Helped us restructure when we incorporated and saved us real money at tax time." },
      { author: "Marco R.", authorUrl: "", photoUrl: "", rating: 5, date: "1 year ago", text: "Been with the firm since we opened the restaurant. They keep the books clean and the advice is honest even when it's not what I want to hear." }
    ]
  },

  /* ---------- FAQ (hide section if items []) ---------- */
  faq: {
    heading: "Questions",
    items: [
      { q: "Do you take on new clients mid-year?", a: "Yes. We onboard year-round and can pick up bookkeeping or planning at any point — you don't have to wait for tax season." },
      { q: "Will I always deal with the same accountant?", a: "Yes. You're assigned one CPA who owns your file and stays with it year over year." },
      { q: "How do you charge?", a: "Fixed annual pricing set in your consult, so there are no surprise hourly bills. Scope is agreed up front in a plain engagement letter." },
      { q: "Can you handle CRA reviews or audits?", a: "We do. We respond to CRA correspondence and manage reviews and audits on your behalf as part of your engagement." }
    ]
  },

  /* ---------- Contact ---------- */
  contact: {
    heading: "Let's talk about your business",
    body: "Send a note or call the office. We'll set up a free 30-minute consult and take it from there.",
    formEnabled: true                     // visual only; submit -> mailto: if email is set
  },

  /* ---------- Footer ---------- */
  footer: {
    blurb: "A Brampton CPA firm for owner-operated businesses. Tax, bookkeeping, and advisory with one accountant who knows your file.",
    legal: "Preview only — not the live website."
  },

  /* ---------- Preview options ---------- */
  defaultDesign: 1,                       // 1 | 2 | 3
  showDesignSwitcher: true
};
