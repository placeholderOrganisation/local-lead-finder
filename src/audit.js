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
    // Same response — read the body for contact crumbs, no extra request.
    const html = await readCapped(res, 1_500_000);
    const { email, socials } = extractContacts(html, finalUrl);
    return {
      ...base(rawUrl, finalUrl),
      reachable: true,
      httpStatus: status,
      secure: finalUrl.startsWith("https://"), // protocol is known; mobile-friendliness is not
      loadMs,
      issues: [`site returns an error (HTTP ${status})`],
      priority: 5,
      email,
      socials,
      needsVerification: true,
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

  const { email, socials } = extractContacts(html, finalUrl);
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
    email,
    socials,
    needsVerification: false,
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
    email: "",
    socials: [],
    needsVerification: true,
  };
}

// --- Contact capture (P3 / #32) — parse the HTML we already fetched ----------
// No extra HTTP. mailto + filtered regex for email; fb/ig/linkedin/x for socials.

const FILE_EXT_TLD = /^(png|jpe?g|gif|webp|svg|ico|bmp|woff2?|ttf|otf|eot|css|js|mjs|map|mp4|webm|mp3|pdf|json)$/i;
const JUNK_LOCAL =
  /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|unsub(scribe)?|bounce|notifications?|mailer|privacy-noreply)$/i;
const VENDOR_DOMAINS = new Set([
  "wix.com",
  "wixpress.com",
  "squarespace.com",
  "shopify.com",
  "sentry.io",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "cloudflare.com",
  "godaddy.com",
  "schema.org",
  "w3.org",
  "example.com",
  "example.org",
  "amazonaws.com",
  "cloudfront.net",
  "jsdelivr.net",
  "unpkg.com",
  "gravatar.com",
  "facebook.com",
  "instagram.com",
]);
const PREFERRED_LOCAL = /^(info|hello|contact|office|admin|inquir(?:y|ies)|enquiry|team|owner)$/i;
const EMAIL_RX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const MAILTO_RX = /mailto:([^\s"'?>]+)/gi;
const HREF_RX = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
const ABS_URL_RX = /https?:\/\/[^\s"'<>]+/gi;

const SOCIAL_RULES = [
  { host: /^(www\.)?(facebook|fb)\.com$/i, skip: /sharer|share\.php|dialog|plugins|\/tr\b/i },
  { host: /^(www\.)?instagram\.com$/i, skip: /\/(p|reel|stories|ar)\//i },
  { host: /^(www\.)?linkedin\.com$/i, skip: /shareArticle|sharing|uas\/|signup/i },
  { host: /^(www\.)?(twitter|x)\.com$/i, skip: /intent|share|home\/?$|\bsearch\b/i },
];

/**
 * Pull a contact email + social profile URLs from homepage HTML.
 * Prefers an address on the site's own domain; drops no-reply/vendor/tracking junk.
 * @param {string} html
 * @param {string} [pageUrl]
 * @returns {{email:string, socials:string[]}}
 */
export function extractContacts(html, pageUrl = "") {
  if (!html) return { email: "", socials: [] };
  const host = hostOf(pageUrl);
  return { email: pickEmail(findEmails(html), host), socials: findSocials(html, pageUrl) };
}

function findEmails(html) {
  const found = new Set();
  const stripped = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  let m;
  MAILTO_RX.lastIndex = 0;
  while ((m = MAILTO_RX.exec(stripped)) !== null) {
    const raw = decodeURIComponentSafe(m[1]).split("?")[0];
    addEmail(found, raw);
  }

  EMAIL_RX.lastIndex = 0;
  while ((m = EMAIL_RX.exec(stripped)) !== null) {
    addEmail(found, m[0]);
  }
  return [...found];
}

function addEmail(set, raw) {
  const email = String(raw || "")
    .replace(/^mailto:/i, "")
    .replace(/&amp;/g, "&")
    .trim()
    .toLowerCase()
    .replace(/[.,;:>]+$/, "");
  if (isPlausibleEmail(email) && !isJunkEmail(email)) set.add(email);
}

function isPlausibleEmail(e) {
  if (!e || e.length > 80 || e.includes("..")) return false;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e)) return false;
  const tld = e.split(".").pop();
  if (FILE_EXT_TLD.test(tld)) return false;
  const [local, domain] = e.split("@");
  if (!local || !domain) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || !domain.includes(".")) return false;
  return true;
}

function isJunkEmail(e) {
  const [local, domain] = e.split("@");
  if (JUNK_LOCAL.test(local)) return true;
  return vendorDomain(domain);
}

function vendorDomain(domain) {
  const parts = domain.split(".");
  const candidates = [domain];
  if (parts.length >= 2) candidates.push(parts.slice(-2).join("."));
  if (parts.length >= 3) candidates.push(parts.slice(-3).join("."));
  return candidates.some((d) => VENDOR_DOMAINS.has(d));
}

function pickEmail(emails, siteHost) {
  if (!emails.length) return "";
  const own = emails.filter((e) => emailMatchesHost(e, siteHost));
  const pool = own.length ? own : emails;
  pool.sort((a, b) => Number(PREFERRED_LOCAL.test(b.split("@")[0])) - Number(PREFERRED_LOCAL.test(a.split("@")[0])));
  return pool[0];
}

function emailMatchesHost(email, siteHost) {
  if (!siteHost) return false;
  const domain = email.split("@")[1];
  if (!domain) return false;
  return domain === siteHost || domain.endsWith("." + siteHost) || siteHost.endsWith("." + domain);
}

function findSocials(html, pageUrl) {
  const found = [];
  const seen = new Set();
  const consider = (raw) => {
    const canon = canonicalSocial(raw, pageUrl);
    if (!canon || seen.has(canon)) return;
    seen.add(canon);
    found.push(canon);
  };

  let m;
  HREF_RX.lastIndex = 0;
  while ((m = HREF_RX.exec(html)) !== null) {
    consider(m[1] || m[2] || m[3] || "");
  }
  ABS_URL_RX.lastIndex = 0;
  while ((m = ABS_URL_RX.exec(html)) !== null) {
    consider(m[0]);
  }
  return found;
}

function canonicalSocial(raw, pageUrl) {
  if (!raw) return "";
  let href = String(raw).trim().replace(/&amp;/g, "&");
  if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) return "";
  let u;
  try {
    u = new URL(href, pageUrl || "https://example.invalid");
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  const host = u.hostname.toLowerCase();
  const rule = SOCIAL_RULES.find((r) => r.host.test(host));
  if (!rule) return "";
  const full = u.hostname + u.pathname;
  if (rule.skip.test(u.href) || rule.skip.test(full)) return "";
  const path = u.pathname.replace(/\/+$/, "") || "";
  if (!path || path === "/") return "";
  return `${u.protocol}//${u.hostname}${path}`;
}

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
