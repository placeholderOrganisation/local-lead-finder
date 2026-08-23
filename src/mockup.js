// Prospect homepage mockup (#34). On-demand, self-contained HTML (no external
// requests). OpenAI when a key is present; a deterministic template otherwise.

import OpenAI from "openai";
import { getOpenAIKey, getOpenAIModel, getOpenAIBaseURL, getOutreachProfile } from "./env.js";
import { saveMockup } from "./store.js";

/**
 * @param {object} lead
 * @returns {Promise<{html:string, generatedAt:string, model:string}>}
 */
export async function generateMockup(lead) {
  const profile = getOutreachProfile();
  const key = getOpenAIKey();
  const generatedAt = new Date().toISOString();
  let html;
  let model = "mock";

  if (key) {
    try {
      const live = await liveMockup(lead, profile, key);
      html = live.html;
      model = live.model;
    } catch (err) {
      console.warn(`[mockup] OpenAI failed (${err.message}); using template fallback`);
      html = templateMockup(lead, profile);
    }
  } else {
    html = templateMockup(lead, profile);
  }

  html = ensureSelfContained(html, lead, profile);
  const out = { html, generatedAt, model };

  const placeId = lead?._id || lead?.placeId;
  if (placeId && placeId !== "x") {
    try {
      await saveMockup(placeId, out);
    } catch (err) {
      console.warn(`[mockup] persist skipped (${err.message})`);
    }
  }
  return out;
}

async function liveMockup(lead, profile, apiKey) {
  const model = getOpenAIModel();
  const client = new OpenAI({ apiKey, baseURL: getOpenAIBaseURL() });
  const ctx = ctxOf(lead, profile);
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(ctx) },
    ],
  });
  let html = completion.choices?.[0]?.message?.content || "";
  html = unwrapFence(html);
  return { html, model };
}

const SYSTEM_PROMPT = `You generate a single self-contained HTML homepage for a local business.
Return ONLY HTML, starting with <!DOCTYPE html>. No markdown, no code fences, no commentary.

Hard rules:
- Inline ALL CSS in a <style> tag. No <link>, no @import, no external stylesheets.
- No external requests of any kind: no Google Fonts, no CDNs, no <script src>, no <img src="http…">.
  Use system fonts and CSS gradients / inline SVG for visuals.
- Use the real business name, category, phone, and local area from the payload.
- Modern, mobile-first, clear CTAs (Call + a quote/contact action using tel: or a #contact form that does not POST anywhere).
- Reasonable size: one page, hero + services + about + contact/footer.`;

function ctxOf(lead, profile) {
  return {
    business: lead?.business || lead?.name || "Local Business",
    category: lead?.category || "Local service",
    phone: lead?.phone || "",
    address: lead?.address || "",
    localArea: profile.localArea || "",
    website: lead?.website || "",
  };
}

function unwrapFence(html) {
  const s = String(html || "").trim();
  const m = s.match(/^```(?:html)?\s*([\s\S]*?)```$/i);
  return (m ? m[1] : s).trim();
}

const EXTERNAL_RX =
  /<(?:link|script|iframe|img)\b[^>]*(?:href|src)\s*=\s*["']https?:/i;
const URL_HTTP_RX = /url\(\s*['"]?https?:/i;
const IMPORT_RX = /@import\b/i;

export function hasExternalRequests(html) {
  const s = String(html || "");
  if (EXTERNAL_RX.test(s)) return true;
  if (URL_HTTP_RX.test(s)) return true;
  if (IMPORT_RX.test(s)) return true;
  if (/fonts\.googleapis|cdn\.jsdelivr|unpkg\.com|fonts\.gstatic/i.test(s)) return true;
  return false;
}

function ensureSelfContained(html, lead, profile) {
  let out = unwrapFence(html);
  out = out.replace(/<(?:link|script|iframe|img)\b[^>]*(?:href|src)\s*=\s*["']https?:[^>]*>/gi, "")
    .replace(/url\(\s*['"]?https?:[^)]+\)/gi, "none")
    .replace(/@import[^;]+;/gi, "");
  if (!out || !/<(?:!doctype|html|body)/i.test(out) || hasExternalRequests(out)) {
    return templateMockup(lead, profile);
  }
  return out;
}

export function templateMockup(lead, profile = getOutreachProfile()) {
  const ctx = ctxOf(lead, profile);
  const name = esc(ctx.business);
  const cat = esc(ctx.category);
  const area = esc(ctx.localArea || "your neighbourhood");
  const phone = esc(ctx.phone);
  const tel = ctx.phone ? `tel:${ctx.phone.replace(/[^\d+]/g, "")}` : "#contact";
  const addr = esc(ctx.address);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — ${cat} in ${area}</title>
<style>
  :root { --ink:#122033; --muted:#5b6b7c; --bg:#f6f3ee; --card:#fff; --accent:#0f6e56; --accent2:#c9783a; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color:var(--ink); background:var(--bg); line-height:1.5; }
  header { display:flex; justify-content:space-between; align-items:center; padding:1rem 6vw; background:#fff; border-bottom:1px solid #e6e0d6; }
  .brand { font-weight:800; letter-spacing:-.02em; }
  nav a { margin-left:1rem; color:var(--ink); text-decoration:none; font-size:.95rem; }
  .hero { padding:12vh 6vw 8vh; background: radial-gradient(1200px 400px at 10% -10%, #d9efe7, transparent), linear-gradient(180deg,#fff,var(--bg)); }
  .hero small { color:var(--accent); font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
  h1 { font-size:clamp(2rem,5vw,3.4rem); line-height:1.1; margin:.4rem 0 1rem; letter-spacing:-.03em; }
  .cta { display:inline-block; background:var(--accent); color:#fff; text-decoration:none; padding:.85rem 1.2rem; border-radius:999px; font-weight:700; margin-right:.6rem; }
  .cta.alt { background:transparent; color:var(--ink); border:1px solid #cfc6b8; }
  section { padding:4rem 6vw; }
  .grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .card { background:var(--card); border-radius:16px; padding:1.3rem; box-shadow:0 8px 24px #0000000d; }
  footer { padding:2rem 6vw 3rem; color:var(--muted); font-size:.9rem; }
</style>
</head>
<body>
<header>
  <div class="brand">${name}</div>
  <nav><a href="#services">Services</a><a href="#contact">Contact</a></nav>
</header>
<section class="hero">
  <small>${cat} · ${area}</small>
  <h1>${name} — trusted ${cat.toLowerCase()} care, close to home.</h1>
  <p>A cleaner first impression for people searching on their phone. Call today${phone ? ` at ${phone}` : ""} and get a same-week appointment.</p>
  <p><a class="cta" href="${tel}">Call now</a><a class="cta alt" href="#contact">Request a quote</a></p>
</section>
<section id="services">
  <h2>How we help</h2>
  <div class="grid">
    <div class="card"><h3>Clear next step</h3><p>Tap to call, tap to book. No hunting for a number on a tiny screen.</p></div>
    <div class="card"><h3>Local &amp; real</h3><p>Named, local, and easy to trust — for people in ${area} who don’t already have your number.</p></div>
    <div class="card"><h3>Built around ${cat.toLowerCase()}</h3><p>Copy and layout that match what you actually sell, not a generic template.</p></div>
  </div>
</section>
<section id="contact">
  <h2>Visit or call</h2>
  <div class="card">
    ${addr ? `<p>${addr}</p>` : ""}
    ${phone ? `<p><a href="${tel}">${phone}</a></p>` : `<p>Call us to book.</p>`}
    <p>Serving ${area}.</p>
  </div>
</section>
<footer>© ${new Date().getFullYear()} ${name}. Homepage mockup — preview only, not yet hosted.</footer>
</body>
</html>`;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
