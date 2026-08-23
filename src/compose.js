// Money-framed, segment-aware outreach assets (#33).
// Draft-only — nothing is sent. OpenAI when a key is present; deterministic
// mock otherwise so the dashboard/dev path works without burning tokens.

import OpenAI from "openai";
import { getOpenAIKey, getOpenAIModel, getOpenAIBaseURL, getOutreachProfile } from "./env.js";

/**
 * @param {object} lead  canonical lead (or a partial used in tests)
 * @returns {Promise<{
 *   moneyPitch: string,
 *   emailDraft: {subject: string, body: string},
 *   phoneScript: string,
 *   pitchedAngle: string,
 *   model: string,
 *   generatedAt: string,
 *   whatsapp?: string,
 *   instagram?: string,
 *   linkedin?: string,
 * }>}
 */
export async function prepareOutreach(lead) {
  const profile = getOutreachProfile();
  const key = getOpenAIKey();
  if (!key) return mockOutreach(lead, profile);

  try {
    return await liveOutreach(lead, profile, key);
  } catch (err) {
    console.warn(`[compose] OpenAI failed (${err.message}); using mock fallback`);
    return mockOutreach(lead, profile);
  }
}

/** Deterministic assets — used when OPENAI_API_KEY is absent, and by tests. */
export function mockOutreach(lead, profile = getOutreachProfile()) {
  const ctx = contextOf(lead, profile);
  const generatedAt = new Date().toISOString();
  const model = "mock";

  if (ctx.needsVerification) return withStubs({ ...verifyFirst(ctx), model, generatedAt }, ctx);
  if (ctx.hasWebsite) return withStubs({ ...hasSite(ctx), model, generatedAt }, ctx);
  return withStubs({ ...noSite(ctx), model, generatedAt }, ctx);
}

async function liveOutreach(lead, profile, apiKey) {
  const ctx = contextOf(lead, profile);
  const model = getOpenAIModel();
  const client = new OpenAI({ apiKey, baseURL: getOpenAIBaseURL() });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(ctx) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || "";
  let parsed = JSON.parse(raw);
  const generatedAt = new Date().toISOString();
  let out = normalizeLive(parsed, ctx, model, generatedAt, { fallbackMock: false });
  if (ctx.needsVerification && claimsDown(out)) {
    const retry = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(ctx) },
        { role: "assistant", content: raw },
        { role: "user", content: "Rewrite. pitchedAngle must be verify-first. Make ZERO claims about the current site working, not working, being slow, or being inaccessible. Look-together-first only." },
      ],
    });
    parsed = JSON.parse(retry.choices?.[0]?.message?.content || "{}");
    out = normalizeLive(parsed, ctx, model, generatedAt, { fallbackMock: true });
  }
  return out;
}

const SYSTEM_PROMPT = `You write outbound sales copy for a local web designer. Return a JSON object with keys:
moneyPitch (string), emailDraft ({subject, body}), phoneScript (string), pitchedAngle (string),
whatsapp (string), instagram (string), linkedin (string).

Rules:
- Speak customers and revenue, NEVER raw tech. Forbidden: viewport, LCP, HTTP 403, HTTP 500, meta tags, "SEO audit", TLS, "mobile-friendly", "mobile-optimized", "not secure". Translate to money: "customers on phones can't tap to call you", "people searching Google land on a competitor", "browsers warn people before they type a credit card".
- Segment by website:
  - no website: overcome "I don't need one" (referrals are fragile, competitors own Google, look legitimate). Emphasize the PHONE SCRIPT — these leads have a phone, not an inbox. pitchedAngle = "no-website-legitimacy".
  - has website: lost-customers / competitor-comparison. pitchedAngle = "lost-customers".
- If needsVerification is true: do NOT say the site is down, broken, offline, returning errors, "having issues", or that customers "can't access" it. You have not verified anything. Softer verify-first copy (look at it together first, no diagnosis). pitchedAngle = "verify-first".
- Inject proof + local + name from the sender profile. NEVER emit placeholders like [Your Name], [Your Company], or [your area]. If senderName is missing/empty/"me", sign as "a local web designer" (and mention localArea if present). If localArea is missing, omit it — do not invent a city. Include portfolioUrl if present. If calendarUrl is present, offer it as an optional CTA. If a mockupUrl is present, the email CTA points at it.
- If a verified mobile score (lighthouse.performance) is present, that is the strongest claim — cite it in moneyPitch as a customer-loss number, not a lab metric.
- Keep copy short, specific, and use the business's real name. Do not claim you already sent anything.`;

function userPrompt(ctx) {
  return JSON.stringify({
    business: ctx.business,
    website: ctx.hasWebsite ? ctx.website : "",
    hasWebsite: ctx.hasWebsite,
    issues: ctx.needsVerification ? [] : ctx.issues,
    tier: ctx.tier,
    needsVerification: ctx.needsVerification,
    lighthouse: ctx.lighthouse,
    mockupUrl: ctx.mockupUrl,
    sender: {
      name: ctx.senderName,
      localArea: ctx.localArea,
      portfolioUrl: ctx.portfolioUrl,
      calendarUrl: ctx.calendarUrl,
    },
  });
}

function normalizeLive(parsed, ctx, model, generatedAt, { fallbackMock = true } = {}) {
  const emailDraft = parsed.emailDraft && typeof parsed.emailDraft === "object"
    ? parsed.emailDraft
    : parsed.email;
  const out = {
    moneyPitch: str(parsed.moneyPitch || parsed.moneyPitch),
    emailDraft: {
      subject: str(emailDraft?.subject),
      body: str(emailDraft?.body),
    },
    phoneScript: str(parsed.phoneScript || parsed.phoneScript),
    pitchedAngle: str(parsed.pitchedAngle || parsed.pitchedAngle) || ctx.angle,
    model,
    generatedAt,
    whatsapp: str(parsed.whatsapp) || undefined,
    instagram: str(parsed.instagram) || undefined,
    linkedin: str(parsed.linkedin) || undefined,
  };
  if (ctx.needsVerification && claimsDown(out) && fallbackMock) {
    // Model leaked a down-claim — replace with the safe mock, never ship it.
    return mockOutreach(ctx._lead || { business: ctx.business, website: ctx.website, needsVerification: true, issues: ctx.issues }, {
      senderName: ctx.senderName,
      localArea: ctx.localArea,
      portfolioUrl: ctx.portfolioUrl,
      calendarUrl: ctx.calendarUrl,
    });
  }
  return scrubPlaceholders(out);
}

function claimsDown(out) {
  const blob = `${out.moneyPitch}\n${out.emailDraft?.body}\n${out.phoneScript}`.toLowerCase();
  return /\b(site|website|page)\b.{0,24}\b(down|broken|offline|unreachable|dead|inaccessible)\b/.test(blob)
    || /\b(down|broken|offline)\b.{0,24}\b(site|website)\b/.test(blob)
    || /http\s*(403|500)/.test(blob)
    || /\breturns? an error\b/.test(blob)
    || /can'?t access|unable to access|trouble accessing|not loading|isn'?t loading/.test(blob);
}

function scrubPlaceholders(out) {
  const who = "a local web designer";
  const clean = (s) => String(s || "")
    .replace(/\[(?:Your Name|Your Company|your area|Your Area)\]/gi, (m) => /name/i.test(m) ? who : "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
  return {
    ...out,
    moneyPitch: clean(out.moneyPitch),
    phoneScript: clean(out.phoneScript),
    emailDraft: {
      subject: clean(out.emailDraft?.subject),
      body: clean(out.emailDraft?.body),
    },
    whatsapp: out.whatsapp ? clean(out.whatsapp) : undefined,
    instagram: out.instagram ? clean(out.instagram) : undefined,
    linkedin: out.linkedin ? clean(out.linkedin) : undefined,
  };
}

function contextOf(lead, profile) {
  const business = str(lead?.business || lead?.name) || "your business";
  const website = str(lead?.website);
  const issues = Array.isArray(lead?.issues) ? lead.issues : splitIssues(lead?.issues);
  const lighthouse = lead?.lighthouse || null;
  const mockupUrl = lead?.mockup?.publicUrl || lead?.mockup?.publicUrl || "";
  const hasWebsite = !!website;
  const needsVerification = !!lead?.needsVerification;
  let angle = "no-website-legitimacy";
  if (needsVerification) angle = "verify-first";
  else if (hasWebsite) angle = "lost-customers";
  return {
    _lead: lead,
    business,
    website,
    hasWebsite,
    issues,
    tier: str(lead?.tier || lead?.tier),
    needsVerification,
    lighthouse,
    mockupUrl,
    senderName: profile.senderName || "",
    localArea: profile.localArea || "",
    portfolioUrl: profile.portfolioUrl,
    calendarUrl: profile.calendarUrl,
    angle,
  };
}

function noSite(ctx) {
  const { business, senderName, localArea, portfolioUrl, calendarUrl } = ctx;
  const who = senderName || "a local web designer";
  const area = localArea || "local";
  const moneyPitch =
    `${business} is invisible to anyone who doesn't already know them — Google sends those customers to a competitor who looks more established. A simple site in ${area} captures the work referrals miss.`;
  const proof = portfolioUrl ? `\n\nA couple of local sites I've shipped: ${portfolioUrl}` : "";
  const cal = calendarUrl ? `\n\nIf it's easier, grab a time here: ${calendarUrl}` : "";
  return {
    moneyPitch,
    emailDraft: {
      subject: `${business} — a 2-minute thought from a ${area} neighbour`,
      body:
        `Hi — I'm ${who}. I help ${area} businesses pick up the customers who never get a referral.\n\n` +
        `Right now ${business} only exists if someone already has your number. People searching on their phone land on whoever looks legit — and that's usually a competitor.\n\n` +
        `I put together a homepage mock so you can see what "looking legit" would feel like for ${business}. No obligation.` +
        proof + cal + `\n\n${who}`,
    },
    phoneScript:
      `Hi, is this ${business}? ${who} — I build websites for ${area} shops. I know a lot of owners feel they don't need one because work comes from referrals. The gap is the people who *don't* already know you: they Google, they don't find you, they book the competitor who looks established. I mocked a simple homepage with your name on it — can I text you the link?`,
    pitchedAngle: "no-website-legitimacy",
  };
}

function hasSite(ctx) {
  const { business, senderName, localArea, portfolioUrl, calendarUrl, lighthouse, mockupUrl } = ctx;
  const who = senderName || "a local web designer";
  const area = localArea || "local";
  const score = Number(lighthouse?.performance);
  const scoreLine = Number.isFinite(score)
    ? ` Your site scores ${Math.round(score)}/100 on phones — that's people tapping away before they ever call.`
    : ` Customers on their phones are bouncing before they ever tap Call — that's booked jobs walking next door.`;
  const moneyPitch = `${business} is losing work to whoever's site feels easier on a phone.${scoreLine}`;
  const cta = mockupUrl
    ? `I already mocked a cleaner homepage for ${business}: ${mockupUrl}`
    : `I mocked a cleaner homepage for ${business} so you can see the difference in 30 seconds.`;
  const proof = portfolioUrl ? `\n\nRecent ${area} work: ${portfolioUrl}` : "";
  const cal = calendarUrl ? `\n\nOr pick a time: ${calendarUrl}` : "";
  return {
    moneyPitch,
    emailDraft: {
      subject: `${business} — customers on phones are slipping away`,
      body:
        `Hi — ${who} here, I build sites for ${area} businesses.\n\n` +
        `${moneyPitch}\n\n${cta}` + proof + cal + `\n\n${who}`,
    },
    phoneScript:
      `Hi, ${business}? ${who} in ${area}. I looked at how you show up on a phone — people are bouncing before they call. I put a simple mock homepage together with your name on it so you can compare. Worth a 2-minute look?`,
    pitchedAngle: "lost-customers",
  };
}

function verifyFirst(ctx) {
  const { business, senderName, localArea, portfolioUrl, calendarUrl } = ctx;
  const who = senderName || "a local web designer";
  const area = localArea || "local";
  const moneyPitch =
    `I haven't verified ${business}'s site myself yet, so I'm not going to claim anything about it. The conversation is how you show up next to ${area} competitors — and whether a clearer first impression would win more of the customers who find you on their phone.`;
  const proof = portfolioUrl ? `\n\nExamples of local work: ${portfolioUrl}` : "";
  const cal = calendarUrl ? `\n\nHappy to walk through it live: ${calendarUrl}` : "";
  return {
    moneyPitch,
    emailDraft: {
      subject: `${business} — a quick look before we talk`,
      body:
        `Hi — I'm ${who}${localArea ? ` in ${localArea}` : ""}. I help local businesses turn phone-searchers into booked jobs.\n\n` +
        `I don't want to guess about your current site — I'd rather look at it with you first. I did sketch a homepage in your name so you have something concrete to react to, no claims attached.` +
        proof + cal + `\n\n${who}`,
    },
    phoneScript:
      `Hi, is this ${business}? ${who} — I help ${area} businesses pick up customers from Google. I'm not calling with a diagnosis; I haven't walked your site with you yet. I did mock a simple homepage with your name on it so you can see a direction. Open to a 2-minute look before anyone makes claims?`,
    pitchedAngle: "verify-first",
  };
}

function withStubs(assets, ctx) {
  const who = ctx.senderName || "a local web designer";
  const area = ctx.localArea || "local";
  const { business } = ctx;
  return {
    ...assets,
    whatsapp: `Hi ${business}, ${who} here — I mocked a simple homepage with your name on it. Mind if I send the link?`,
    instagram: `Loved what ${business} is doing locally — I sketched a homepage in your name if you ever want a cleaner first impression.`,
    linkedin: `Hi — I work with ${area} businesses on how they show up when someone Googles them. I put together a short homepage mock for ${business} if useful.`,
  };
}

function splitIssues(v) {
  if (v == null || v === "") return [];
  return String(v).split(/;\s*/).filter(Boolean);
}

function str(v) {
  return v == null ? "" : String(v);
}
