// Audit a business website for concrete, sellable weaknesses.
//
// Everything here is fetch-based (no browser, no extra API): reachability,
// HTTPS, mobile-viewport, page weight, load time, basic SEO tags, and staleness.
// Each finding maps to a plain-English issue you can pitch on.

const USER_AGENT =
  "Mozilla/5.0 (compatible; LocalLeadFinder/0.1; +site-audit)";
const TIMEOUT_MS = 12000;
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Audit a single site.
 * @param {string} rawUrl
 * @returns {Promise<object>} audit result with `issues` (array) and metrics.
 */
export async function auditSite(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return unreachable(rawUrl, "no valid URL");

  const started = Date.now();
  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    // Retry once over http if the https attempt itself blew up.
    if (url.startsWith("https://")) {
      try {
        res = await fetchWithTimeout("http://" + url.slice("https://".length));
      } catch {
        return unreachable(rawUrl, describeErr(err));
      }
    } else {
      return unreachable(rawUrl, describeErr(err));
    }
  }

  const loadMs = Date.now() - started;
  const finalUrl = res.url || url;
  const status = res.status;

  if (status >= 400) {
    return {
      ...base(rawUrl, finalUrl),
      reachable: true,
      httpStatus: status,
      secure: finalUrl.startsWith("https://"), // protocol is known; mobile-friendliness is not
      loadMs,
      issues: [`site returns an error (HTTP ${status})`],
      priority: 5,
    };
  }

  const html = await readCapped(res, 1_500_000); // cap ~1.5MB of HTML
  const bytes = Buffer.byteLength(html);

  const checks = inspectHtml(html);
  const secure = finalUrl.startsWith("https://");

  const issues = [];
  if (!secure) issues.push("no HTTPS — browsers flag it as 'Not secure'");
  if (!checks.hasViewport) issues.push("not mobile-friendly (no viewport tag)");
  if (loadMs > 5000) issues.push(`slow to load (~${(loadMs / 1000).toFixed(1)}s)`);
  if (bytes > 3_000_000) issues.push(`heavy page (${(bytes / 1e6).toFixed(1)}MB of HTML)`);
  if (!checks.hasTitle) issues.push("missing page title (hurts Google ranking)");
  if (!checks.hasMetaDescription) issues.push("no meta description (weak search snippet)");
  if (!checks.hasH1) issues.push("no main heading (H1) — poor SEO structure");
  if (checks.staleYear && CURRENT_YEAR - checks.staleYear >= 3) {
    issues.push(`looks outdated (© ${checks.staleYear} in footer)`);
  }

  return {
    ...base(rawUrl, finalUrl),
    reachable: true,
    httpStatus: status,
    secure,
    loadMs,
    sizeKb: Math.round(bytes / 1024),
    mobileFriendly: checks.hasViewport,
    title: checks.title,
    copyrightYear: checks.staleYear ?? "",
    issues,
    priority: priorityFrom(issues, { secure, mobileFriendly: checks.hasViewport }),
  };
}

// --- HTML inspection (regex-based; good enough for these signals) ---

function inspectHtml(html) {
  const head = html.slice(0, 200_000); // tags we care about live near the top
  const hasViewport = /<meta[^>]+name=["']?viewport["']?[^>]*>/i.test(head);
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";
  const hasTitle = title.length > 0;
  const hasMetaDescription = /<meta[^>]+name=["']?description["']?[^>]*>/i.test(head);
  const hasH1 = /<h1[\s>]/i.test(html);
  const staleYear = findCopyrightYear(html);
  return { hasViewport, hasTitle, title, hasMetaDescription, hasH1, staleYear };
}

// Look for a copyright year like "© 2019" / "Copyright 2018".
function findCopyrightYear(html) {
  const tail = html.slice(-40_000); // footers live at the bottom
  const rx = /(?:©|&copy;|copyright)\s*(?:&\w+;|\s|\d{4}\s*[-–]\s*)*?((?:19|20)\d{2})/gi;
  let year = null;
  let m;
  while ((m = rx.exec(tail)) !== null) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= CURRENT_YEAR && (year === null || y > year)) year = y;
  }
  return year;
}

function priorityFrom(issues, { secure, mobileFriendly }) {
  // 1 (low) .. 5 (drop everything and call them). Weighted by pitch power.
  let p = 1 + issues.length;
  if (!secure) p += 1;
  if (!mobileFriendly) p += 1;
  return Math.min(5, p);
}

/**
 * A ready-to-use pitch line for a lead, given its audit.
 * @returns {string}
 */
export function pitchFor(name, audit) {
  if (!audit.reachable) {
    return `${name}'s website appears to be down or unreachable — potential customers can't find them online.`;
  }
  if (audit.issues.length === 0) {
    return `${name}'s site looks solid — a lower-priority lead, but worth a design/refresh angle.`;
  }
  const top = audit.issues.slice(0, 2).join(", and ");
  return `${name}'s website has issues: ${top}. I can fix that fast.`;
}

// --- helpers ---

function normalizeUrl(raw) {
  if (!raw) return "";
  let u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).toString();
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
  } finally {
    clearTimeout(t);
  }
}

async function readCapped(res, cap) {
  const reader = res.body?.getReader?.();
  if (!reader) return await res.text();
  const chunks = [];
  let total = 0;
  while (total < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try {
    reader.cancel();
  } catch {}
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}

function describeErr(err) {
  const msg = String(err?.cause?.code || err?.message || err);
  if (/abort/i.test(msg)) return "timed out";
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return "domain not found";
  if (/CERT|SSL|TLS/i.test(msg)) return "SSL/certificate error";
  if (/ECONNREFUSED/i.test(msg)) return "connection refused";
  return msg.slice(0, 60);
}

function base(inputUrl, finalUrl) {
  return { inputUrl, finalUrl };
}

function unreachable(inputUrl, why) {
  return {
    ...base(inputUrl, ""),
    reachable: false,
    issues: [`unreachable (${why})`],
    priority: 4,
  };
}
