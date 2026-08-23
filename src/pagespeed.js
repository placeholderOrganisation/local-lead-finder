// Google PageSpeed Insights (Lighthouse) client.
// Docs: https://developers.google.com/speed/docs/insights/v5/get-started
//
// Returns 0–100 category scores plus a couple of headline metrics. This is the
// most persuasive number for a cold pitch: "your site scores 34/100 on Google's
// own mobile speed test."
//
// NOTE: the "PageSpeed Insights API" must be enabled in the same Google Cloud
// project as the Places key. It runs a real Lighthouse audit server-side, so it
// is SLOW (~10–30s per URL) — keep concurrency low.

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 60000;

/**
 * Run PageSpeed Insights for one URL.
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} opts.apiKey
 * @param {"mobile"|"desktop"} [opts.strategy]
 * @returns {Promise<object>} { ok, performance, seo, accessibility, bestPractices, lcpSec, ... }
 */
export async function runPageSpeed({ url, apiKey, strategy = "mobile" }) {
  const params = new URLSearchParams({ url, strategy });
  if (apiKey) params.set("key", apiKey);
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", c);
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal });
    if (!res.ok) {
      const detail = await safeError(res);
      return { ok: false, error: `PSI ${res.status}${detail}` };
    }
    const data = await res.json();
    return parse(data, strategy);
  } catch (err) {
    const msg = /abort/i.test(String(err)) ? "timed out" : String(err?.message || err);
    return { ok: false, error: msg.slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

function parse(data, strategy) {
  const lh = data.lighthouseResult ?? {};
  const cats = lh.categories ?? {};
  const audits = lh.audits ?? {};
  return {
    ok: true,
    strategy,
    performance: pct(cats.performance),
    seo: pct(cats.seo),
    accessibility: pct(cats.accessibility),
    bestPractices: pct(cats["best-practices"]),
    lcpSec: numericSec(audits["largest-contentful-paint"]),
    tbtMs: audits["total-blocking-time"]?.numericValue ?? null,
  };
}

function pct(cat) {
  const s = cat?.score;
  return typeof s === "number" ? Math.round(s * 100) : null;
}

function numericSec(audit) {
  const v = audit?.numericValue;
  return typeof v === "number" ? Number((v / 1000).toFixed(1)) : null;
}

async function safeError(res) {
  try {
    const data = await res.json();
    const msg = data?.error?.message;
    return msg ? ` — ${msg}` : "";
  } catch {
    return "";
  }
}
