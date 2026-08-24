// Prospect site config (#41). Builds a window.SITE object for the checked-in
// template — facts from the lead + OpenAI copy (hero/about/services/faq).
// Deterministic fallback when no key / on error. No HTML is generated.

import OpenAI from "openai";
import { getOpenAIKey, getOpenAIModel, getOpenAIBaseURL, getOutreachProfile } from "./env.js";
import { saveMockup } from "./store.js";

/**
 * @param {object} lead
 * @returns {Promise<object>} window.SITE per the #40 contract (reviews: [] until #42)
 */
export async function buildSiteConfig(lead) {
  const profile = getOutreachProfile();
  const facts = factsOf(lead, profile);
  const generatedAt = new Date().toISOString();
  const placeId = lead?._id || lead?.placeId || "";
  let copy;
  let model = "mock";

  const key = getOpenAIKey();
  if (key) {
    try {
      const live = await liveCopy(facts, lead, profile, key);
      copy = live.copy;
      model = live.model;
    } catch (err) {
      console.warn(`[mockup] OpenAI failed (${err.message}); using fallback copy`);
      copy = fallbackCopy(facts, lead, profile);
    }
  } else {
    copy = fallbackCopy(facts, lead, profile);
  }

  const site = {
    business: facts,
    copy,
    reviews: [],
    meta: { preview: true, generatedAt, placeId, model },
  };

  if (placeId && placeId !== "x") {
    try {
      await saveMockup(placeId, { config: site, generatedAt, model });
    } catch (err) {
      console.warn(`[mockup] persist skipped (${err.message})`);
    }
  }
  return site;
}

/** Lead facts that fill window.SITE.business. */
export function factsOf(lead, profile = getOutreachProfile()) {
  const name = str(lead?.business || lead?.name) || "Local business";
  const phone = str(lead?.phone);
  const ratingRaw = lead?.rating;
  const countRaw = lead?.reviewCount ?? lead?.reviews;
  const rating = Number(ratingRaw);
  const reviewCount = Number(countRaw);
  return {
    name,
    category: str(lead?.category) || "Local service",
    phone,
    tel: telOf(phone),
    address: str(lead?.address),
    mapsUrl: str(lead?.mapsUrl),
    area: str(profile.localArea) || areaFromAddress(lead?.address),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    reviewCount: Number.isFinite(reviewCount) && reviewCount > 0 ? reviewCount : null,
  };
}

/** Deterministic money-framed copy — used when OPENAI_API_KEY is absent, and by tests. */
export function fallbackCopy(facts, lead = {}, profile = getOutreachProfile()) {
  const name = facts.name;
  const cat = (facts.category || "local service").toLowerCase();
  const area = facts.area || "your neighbourhood";
  const phone = facts.phone;
  const hasSite = Boolean(lead?.website);
  const heroHeadline = hasSite
    ? `${name} — the first impression that actually gets the call`
    : `${name} — look as established as the work you already do`;
  const heroSub = phone
    ? `${cat} in ${area}. Tap to call ${phone} — we'll take it from there.`
    : `${cat} in ${area}. The neighbours who don't already have your number can finally find you.`;
  const about = hasSite
    ? `${name} already has customers — the leak is the people who find you on a phone and bounce before they tap Call. A clearer homepage in ${area} turns those lookers into booked jobs, with your real name, number, and what you actually do — not a generic template.`
    : `${name} only exists today if someone already has the number. Everyone else Googles a ${cat} in ${area} and books whoever looks legitimate. This page is that first impression: your name, your number, and a reason to call you instead of the competitor with a site.`;
  return {
    heroHeadline,
    heroSub,
    about,
    services: [
      { title: "Show up when they search", desc: `People in ${area} looking for a ${cat} land here — not on a competitor's page.` },
      { title: "Make the phone tap obvious", desc: "A big Call button and your real number. No hunting through a tiny menu on a phone." },
      { title: "Look like the established choice", desc: "Your name, what you do, and who you help — so a stranger trusts you before they dial." },
    ],
    faq: [
      { q: "Is this the live website?", a: "No — this is a preview / mockup so you can see the direction before anything goes live." },
      { q: "Do I have to keep this design?", a: "No. This is a starting point. We change copy, colours, and pages to match how you actually work." },
      { q: "How do people reach us?", a: phone ? `Call ${phone}. The button on this page dials the office.` : "Call the office — the number on this page is yours." },
    ],
  };
}

export function fallbackSiteConfig(lead, profile = getOutreachProfile()) {
  const facts = factsOf(lead, profile);
  return {
    business: facts,
    copy: fallbackCopy(facts, lead, profile),
    reviews: [],
    meta: {
      preview: true,
      generatedAt: new Date().toISOString(),
      placeId: lead?._id || lead?.placeId || "",
      model: "mock",
    },
  };
}

async function liveCopy(facts, lead, profile, apiKey) {
  const model = getOpenAIModel();
  const client = new OpenAI({ apiKey, baseURL: getOpenAIBaseURL() });
  const ctx = {
    name: facts.name,
    category: facts.category,
    phone: facts.phone,
    address: facts.address,
    area: facts.area,
    hasWebsite: Boolean(lead?.website),
    rating: facts.rating,
    reviewCount: facts.reviewCount,
  };
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COPY_PROMPT },
      { role: "user", content: JSON.stringify(ctx) },
    ],
  });
  const raw = completion.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return { copy: normalizeCopy(parsed, facts, lead, profile), model };
}

const COPY_PROMPT = `You write website copy for a local-business homepage mockup. Return JSON with keys:
heroHeadline (string), heroSub (string), about (string, 2–4 sentences),
services (array of 3–5 {title, desc}), faq (array of 3–4 {q, a}).

Rules:
- Money and customers, never raw tech. Forbidden: viewport, LCP, HTTP 403, HTTP 500, meta tags, "SEO audit", TLS, "mobile-friendly", "responsive design", "page speed".
- Use the real business name, category, phone, and area from the payload. heroHeadline MUST include the business name.
- Specific, local, and about booked calls / customers — not lorem, not "your trusted partner", not "stress-free".
- If hasWebsite is false, the angle is legitimacy: strangers who don't already have the number.
- If hasWebsite is true, the angle is lost phone-customers who bounce before they tap Call.
- about is a first-person-plural firm story, not a sales email.
- services are what the BUSINESS sells (not "web design"). Infer sensible local-service offerings from the category.
- faq[0] must make clear this page is a preview / mockup, not the live site.
- No placeholders like [Business] or TODO.`;

function normalizeCopy(parsed, facts, lead, profile) {
  const fb = fallbackCopy(facts, lead, profile);
  const services = Array.isArray(parsed.services) ? parsed.services : fb.services;
  const faq = Array.isArray(parsed.faq) ? parsed.faq : fb.faq;
  const copy = {
    heroHeadline: str(parsed.heroHeadline) || fb.heroHeadline,
    heroSub: str(parsed.heroSub || parsed.heroSubhead) || fb.heroSub,
    about: str(parsed.about) || fb.about,
    services: services
      .map((s) => ({ title: str(s?.title), desc: str(s?.desc || s?.body || s?.description) }))
      .filter((s) => s.title)
      .slice(0, 6),
    faq: faq
      .map((x) => ({ q: str(x?.q || x?.question), a: str(x?.a || x?.answer) }))
      .filter((x) => x.q)
      .slice(0, 6),
  };
  if (!copy.services.length) copy.services = fb.services;
  if (!copy.faq.length) copy.faq = fb.faq;
  const name = facts.name;
  if (name && copy.heroHeadline && !copy.heroHeadline.toLowerCase().includes(name.toLowerCase())) {
    copy.heroHeadline = `${name} — ${copy.heroHeadline}`;
  }
  return copy;
}

export function telOf(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  cleaned = cleaned.replace(/(?!^\+)\+/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function areaFromAddress(address) {
  const s = str(address);
  if (!s) return "";
  const m = s.match(/,\s*([^,]+),\s*[A-Z]{2}\b/) || s.match(/,\s*([^,]+),\s*Canada/i);
  return m ? m[1].trim() : "";
}

function str(v) {
  return v == null ? "" : String(v).trim();
}
