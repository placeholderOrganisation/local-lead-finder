// Leaf-node preview copy for the "Scope your site" tool (professionals repo).
//
// A leaf = businessType × mainJob (the two answers that actually change the
// DESIGN). Each leaf becomes one generic, shareable preview at
// mockup-scope.workers.dev/{businessType}-{mainJob}/ , rendered by the shared
// accountant template from a config.json in the SiteConfig shape
// (template/accountant/lib/site-config.ts). Names/areas are fictional examples
// — these are generic "directions", personalized live only by the result-screen
// header, never a finished client site.

// Widget option values — keep in sync with QUESTIONS in
// professionals/vite-mintek/src/components/service/ScopeTool.jsx.
export const BUSINESS_TYPES = ["salon", "trades", "restaurant", "clinic", "professional", "other"];
export const MAIN_JOBS = ["calls", "bookings", "info", "showcase", "sell"];

// Per-business-type archetype: an example identity + the stable content the
// template renders (about, services, faq). Copy is plain and honest — Mintek voice.
const TYPE_ARCHETYPES = {
  salon: {
    name: "Bella's Salon & Spa",
    category: "Salon & wellness",
    area: "Brampton",
    about:
      "A neighbourhood salon where regulars come back for the people as much as the results. This preview shows how your services, team and booking could feel on a phone.",
    services: [
      { title: "Hair & colour", desc: "Cuts, colour and treatments booked in a couple of taps." },
      { title: "Skin & nails", desc: "Facials, manicures and pedicures with clear pricing up front." },
      { title: "Waxing & brows", desc: "Quick, honest appointments that keep regulars coming back." },
    ],
    faq: [
      { q: "Do you take walk-ins?", a: "Walk-ins when we can, but booking ahead guarantees your stylist and time." },
      { q: "How do I book?", a: "Tap Book, pick a service and a time — you get a confirmation right away." },
    ],
  },
  trades: {
    name: "Peel Plumbing & Heating",
    category: "Trades & home services",
    area: "the GTA",
    about:
      "Licensed, insured and straight with you about what a job needs. This preview shows how customers could reach you and see the work you've done.",
    services: [
      { title: "Repairs & callouts", desc: "Fast response for the things that can't wait, with clear quotes." },
      { title: "Installs & upgrades", desc: "Fixtures, water heaters and heating done to code." },
      { title: "Maintenance", desc: "Simple plans that head off the expensive surprises." },
    ],
    faq: [
      { q: "Do you offer free quotes?", a: "Yes — call or send a photo and we'll give you an honest estimate." },
      { q: "Are you licensed and insured?", a: "Fully licensed and insured, and happy to show it." },
    ],
  },
  restaurant: {
    name: "Junction Kitchen",
    category: "Restaurant & food",
    area: "Brampton",
    about:
      "Fresh food, a room worth sitting in, and a menu that reads well on a phone. This preview shows how your menu, hours and directions could come first.",
    services: [
      { title: "The menu", desc: "Your full menu, readable in one thumb-reach — no PDF pinch-and-zoom." },
      { title: "Hours & directions", desc: "Today's hours and one-tap directions, always current." },
      { title: "Catering & events", desc: "Enquiries for larger orders without the phone tag." },
    ],
    faq: [
      { q: "Do you take reservations?", a: "For tables and larger groups — tap to send a request and we'll confirm." },
      { q: "Where are you located?", a: "One tap opens directions in your maps app." },
    ],
  },
  clinic: {
    name: "Bramalea Family Clinic",
    category: "Clinic or practice",
    area: "Brampton",
    about:
      "Calm, professional and easy to reach. This preview shows how patients could find your services, hours and a way to get in touch.",
    services: [
      { title: "Our services", desc: "What you treat, in plain language patients understand." },
      { title: "New patients", desc: "How to register and what to bring, without a phone call." },
      { title: "Hours & contact", desc: "Clear hours and a simple, private way to reach the front desk." },
    ],
    faq: [
      { q: "Are you accepting new patients?", a: "This preview shows how you'd answer that clearly at the top of the page." },
      { q: "How do I book an appointment?", a: "A simple request form or click-to-call, whichever suits your practice." },
    ],
  },
  professional: {
    name: "Sharma & Co.",
    category: "Professional services",
    area: "the GTA",
    about:
      "Expertise people trust with important decisions. This preview shows how your services and credibility could come across in seconds.",
    services: [
      { title: "What we do", desc: "Your core services, framed around the problems clients bring you." },
      { title: "Who we help", desc: "The clients you're the right fit for — and the ones you're not." },
      { title: "Get in touch", desc: "A straightforward enquiry that starts the right conversation." },
    ],
    faq: [
      { q: "How do you charge?", a: "This preview shows where you'd set expectations on fees up front." },
      { q: "How do we start?", a: "A short enquiry, then a call to see if we're a fit." },
    ],
  },
  other: {
    name: "Your Business",
    category: "Local business",
    area: "your area",
    about:
      "A clean, fast first version focused on the one job that earns enquiries. This preview shows the shape — the content becomes yours.",
    services: [
      { title: "What you offer", desc: "Your main services, clear and easy to scan on a phone." },
      { title: "Why you", desc: "The reason nearby customers should choose you." },
      { title: "Get in touch", desc: "A reliable way for customers to reach you." },
    ],
    faq: [
      { q: "What should this page do?", a: "Answer the visitor's question and make the next step obvious." },
      { q: "Can this be simpler?", a: "If a smaller version is enough, that's exactly what we'd build." },
    ],
  },
};

// Per-main-job angle: the hero headline/sub and one job-specific service that
// gets surfaced first. `{noun}` is filled from the business type.
const JOB_ANGLE = {
  calls: {
    headline: "Call {name} — help is one tap away",
    sub: "A fast, mobile-first first version built to turn nearby searches into calls and enquiries.",
    lead: { title: "Click-to-call", desc: "A tap-to-call button that works the moment someone lands on their phone." },
  },
  bookings: {
    headline: "Book {name} in a couple of taps",
    sub: "A mobile-first first version built around a booking or waitlist flow, with none of the friction.",
    lead: { title: "Online booking", desc: "Pick a service and a time and get a confirmation — no phone tag." },
  },
  info: {
    headline: "{name}: menu, hours and directions, front and centre",
    sub: "A mobile-first first version that puts the three things people actually need one thumb-reach away.",
    lead: { title: "Hours & directions", desc: "Today's hours and one-tap directions, always up to date." },
  },
  showcase: {
    headline: "See {name}'s work",
    sub: "A mobile-first first version built to show past work so new customers trust you quickly.",
    lead: { title: "Photo gallery", desc: "A clean, fast gallery of real work — proof before the pitch." },
  },
  sell: {
    headline: "Order from {name} online",
    sub: "A first version that lets customers order and pay online — scoped as software when it needs to be.",
    lead: { title: "Online ordering", desc: "Browse, order and pay online, built to actually get used." },
  },
};

export function leafSlug(businessType, mainJob) {
  return `${businessType}-${mainJob}`;
}

/** Build a SiteConfig-shaped preview config for one leaf node. */
export function buildLeafConfig(businessType, mainJob) {
  const arch = TYPE_ARCHETYPES[businessType] || TYPE_ARCHETYPES.other;
  const angle = JOB_ANGLE[mainJob] || JOB_ANGLE.calls;
  const slug = leafSlug(businessType, mainJob);
  return {
    business: {
      name: arch.name,
      category: arch.category,
      phone: "(905) 555-0199",
      tel: "+19055550199",
      address: `${arch.area}, ON`,
      mapsUrl: "",
      area: arch.area,
      rating: null,
      reviewCount: null,
    },
    copy: {
      heroHeadline: angle.headline.replace("{name}", arch.name),
      heroSub: angle.sub,
      about: arch.about,
      // Surface the job-specific service first, then the type's standard set.
      services: [angle.lead, ...arch.services],
      faq: arch.faq,
    },
    reviews: [],
    meta: { preview: true, generatedAt: null, placeId: slug },
  };
}

/** Every leaf slug (30) — businessType × mainJob. */
export function allLeaves() {
  const out = [];
  for (const bt of BUSINESS_TYPES) {
    for (const mj of MAIN_JOBS) {
      out.push({ businessType: bt, mainJob: mj, slug: leafSlug(bt, mj) });
    }
  }
  return out;
}
