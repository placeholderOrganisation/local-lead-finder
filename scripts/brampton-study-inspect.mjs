// Public-HTML inspection for the 2026 Brampton website study.
// Fetch-only. Does not submit forms, create accounts, or bypass access controls.

const USER_AGENT =
  "Mozilla/5.0 (compatible; BramptonWebsiteStudy/2026; research; Mintek Software)";
const TIMEOUT_MS = 15000;

export async function inspectPublicSite(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, error: "no valid URL" };

  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    return { ok: false, error: describeErr(err), inputUrl: url };
  }

  const finalUrl = res.url || url;
  const html = await readCapped(res, 1_500_000);
  const origin = originOf(finalUrl);
  const robots = origin ? await probe(origin + "/robots.txt") : { status: null, body: "" };
  const sitemapGuesses = sitemapCandidates(robots.body, origin);
  let sitemap = { status: null, url: null };
  for (const candidate of sitemapGuesses) {
    const probed = await probe(candidate);
    if (probed.status && probed.status < 400 && /<urlset|<sitemapindex|xml/i.test(probed.body.slice(0, 2000))) {
      sitemap = { status: probed.status, url: candidate };
      break;
    }
    if (!sitemap.status) sitemap = { status: probed.status, url: candidate };
  }

  const page = inspectHtml(html, finalUrl);
  return {
    ok: res.status < 400,
    httpStatus: res.status,
    inputUrl: url,
    finalUrl,
    https: finalUrl.startsWith("https://"),
    htmlBytes: Buffer.byteLength(html),
    robotsTxt: robots.status != null && robots.status < 400 && /user-agent:/i.test(robots.body),
    robotsTxtStatus: robots.status,
    xmlSitemap: Boolean(sitemap.status && sitemap.status < 400 && sitemap.url),
    xmlSitemapUrl: sitemap.url,
    xmlSitemapStatus: sitemap.status,
    ...page,
  };
}

export function inspectHtml(html, pageUrl = "") {
  const head = html.slice(0, 250_000);
  const lower = html.toLowerCase();
  const text = stripTags(html);

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";
  const metaDesc = attrOf(head, "meta", "name", "description", "content");
  const canonical = hrefOf(head, "link", "rel", "canonical");
  const robotsMeta = attrOf(head, "meta", "name", "robots", "content");
  const viewport = /<meta[^>]+name=["']?viewport["']?/i.test(head);
  const generator = attrOf(head, "meta", "name", "generator", "content");

  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  const schemaTypes = [];
  let localBusinessSchema = false;
  let schemaAddress = false;
  let schemaTelephone = false;
  let schemaOpeningHours = false;
  let schemaSameAs = false;
  let schemaAreaServed = false;
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block);
      walkJsonLd(data, (node) => {
        const types = [].concat(node["@type"] || []).map(String);
        for (const t of types) if (t && !schemaTypes.includes(t)) schemaTypes.push(t);
        if (types.some((t) => /localbusiness|organization|dentist|physician|attorney|restaurant|store|professional/i.test(t))) {
          localBusinessSchema = true;
        }
        if (node.address) schemaAddress = true;
        if (node.telephone) schemaTelephone = true;
        if (node.openingHours || node.openingHoursSpecification) schemaOpeningHours = true;
        if (node.sameAs) schemaSameAs = true;
        if (node.areaServed) schemaAreaServed = true;
      });
    } catch {
      /* malformed JSON-LD — recorded as present but unparsed */
    }
  }

  const telHrefs = [...html.matchAll(/href=["'](tel:[^"']+)["']/gi)].map((m) => m[1]);
  const hasForm = /<form[\s>]/i.test(html);
  const booking = detectBooking(html);
  const cms = detectCms(html, generator, pageUrl);
  const analytics = detectAnalytics(html);
  const cdn = detectCdn(html, pageUrl);
  const httpProtocol = null;

  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)];
  const imgsMissingAlt = imgs.filter((m) => !/\balt\s*=/i.test(m[1])).length;
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]).trim()).filter(Boolean);

  const hasBrampton = /\bbrampton\b/i.test(text);
  const hasAddress = /\b(on|ontario)\b/i.test(text) && /\b(l6[a-z]|l7[a-z])\s*\d/i.test(text);
  const phonePresent = telHrefs.length > 0 || /(?:\+?1[-.\s]?)?(?:\(?(?:905|289|416|437|647)\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(text);
  const hours = /\b(monday|mon–|hours|open(?:ing)? hours|am\s*[–-]\s*\d)/i.test(text);
  const reviews = /\b(testimonial|google review|rated\s+\d|stars?\b|what (?:our|my) (?:clients|customers|patients) say)\b/i.test(text);
  const faq = /\bfaq\b|\bfrequently asked questions\b/i.test(text);
  const blog = /href=["'][^"']*(blog|news|resources|articles)[^"']*["']/i.test(html);
  const pricing = /\b(our pricing|price list|starting at|from \$\d|fee guide)\b/i.test(text);
  const cta = detectCta(html, text);
  const servicePages = detectServicePages(html);
  const trust = /\b(licensed|insured|wcb|wsib|bbb|google reviews?|years of experience|award)\b/i.test(text);
  const whoServes = /\b(brampton|peel|gta|cal[ae]don|mississauga)\b/i.test(text);
  const whatTheyDo = h1s.length > 0 || title.length > 0;

  return {
    title: title || null,
    metaDescription: metaDesc || null,
    canonical: canonical || null,
    robotsMeta: robotsMeta || null,
    indexableHomepage: !/noindex/i.test(robotsMeta || ""),
    viewport,
    generator: generator || null,
    h1: h1s[0] || null,
    h1Count: h1s.length,
    jsonLdPresent: jsonLdBlocks.length > 0,
    schemaTypes,
    localBusinessSchema,
    schemaAddress,
    schemaTelephone,
    schemaOpeningHours,
    schemaSameAs,
    schemaAreaServed,
    phonePresent,
    clickToCall: telHrefs.length > 0,
    contactForm: hasForm,
    booking,
    primaryCta: cta,
    bramptonLocationPresent: hasBrampton,
    addressPresent: hasAddress || schemaAddress,
    businessHours: hours || schemaOpeningHours,
    reviewsTestimonials: reviews,
    trustIndicators: trust,
    faqPresent: faq,
    blogPresent: blog,
    pricingPresent: pricing,
    servicePagesPresent: servicePages,
    whoServesObvious: whoServes,
    whatBusinessDoesObvious: whatTheyDo,
    cms,
    cdn,
    gtmDetected: analytics.gtm,
    ga4Detected: analytics.ga4,
    analyticsDetected: analytics.any,
    otherMarketingScripts: analytics.others,
    imagesWithoutAlt: imgsMissingAlt,
    imageCount: imgs.length,
    httpProtocol,
  };
}

function detectCms(html, generator, pageUrl) {
  const blob = `${html}\n${generator || ""}\n${pageUrl}`;
  if (/wp-content|wordpress/i.test(blob) || /wordpress/i.test(generator || "")) return "WordPress";
  if (/cdn\.shopify\.com|myshopify\.com/i.test(blob)) return "Shopify";
  if (/wix\.com|wixstatic|X-Wix/i.test(blob)) return "Wix";
  if (/squarespace/i.test(blob)) return "Squarespace";
  if (/webflow/i.test(blob)) return "Webflow";
  if (/godaddy|websitebuilder/i.test(blob)) return "GoDaddy";
  if (/weebly/i.test(blob)) return "Weebly";
  if (/duda\.co|cdn\.duda/i.test(blob)) return "Duda";
  if (/webstarts/i.test(blob)) return "Webstarts";
  if (generator) return `generator:${generator.slice(0, 80)}`;
  return "not identified";
}

function detectCdn(html, pageUrl) {
  const blob = `${html}\n${pageUrl}`;
  const found = [];
  if (/cloudflare|cdnjs\.cloudflare/i.test(blob)) found.push("Cloudflare");
  if (/cloudfront\.net/i.test(blob)) found.push("CloudFront");
  if (/fastly/i.test(blob)) found.push("Fastly");
  if (/akamai/i.test(blob)) found.push("Akamai");
  if (/googleusercontent|gstatic\.com/i.test(blob)) found.push("Google");
  return found.length ? found.join("; ") : "not identified";
}

function detectAnalytics(html) {
  const gtm = /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html);
  const ga4 = /gtag\/js\?id=G-|G-[A-Z0-9]{6,}/i.test(html) || /google-analytics\.com\/g\/collect/i.test(html);
  const others = [];
  if (/facebook\.net\/.*fbevents|fbq\(/i.test(html)) others.push("Meta Pixel");
  if (/static\.hotjar\.com|hjid/i.test(html)) others.push("Hotjar");
  if (/connect\.facebook\.net/i.test(html) && !others.includes("Meta Pixel")) others.push("Facebook SDK");
  if (/clarity\.ms/i.test(html)) others.push("Microsoft Clarity");
  if (/js\.hs-scripts\.com|hubspot/i.test(html)) others.push("HubSpot");
  return { gtm, ga4, any: gtm || ga4 || others.length > 0, others };
}

function detectBooking(html) {
  if (/calendly\.com/i.test(html)) return "Calendly";
  if (/jane\.app/i.test(html)) return "Jane";
  if (/opentable\.com/i.test(html)) return "OpenTable";
  if (/square\.site|squareup\.com|squareupsandbox/i.test(html)) return "Square";
  if (/mindbodyonline|healow|zocdoc|booker\.com/i.test(html)) return "third-party booking";
  if (/book(?:ing)? (?:now|online|an appointment)|request an appointment|schedule (?:now|online)/i.test(html)) {
    return "on-site booking CTA";
  }
  return null;
}

function detectCta(html, text) {
  const patterns = [
    "call now",
    "book now",
    "book online",
    "request a quote",
    "get a quote",
    "free estimate",
    "contact us",
    "order online",
    "schedule",
    "request an appointment",
  ];
  for (const p of patterns) {
    if (text.toLowerCase().includes(p) || new RegExp(p, "i").test(html)) return p;
  }
  return null;
}

function detectServicePages(html) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase());
  const hits = hrefs.filter((h) =>
    /\/(services?|treatments?|menu|practice-areas?|what-we-do|our-work)\b/.test(h)
  );
  return hits.length >= 1;
}

function walkJsonLd(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, visit);
    return;
  }
  visit(node);
  if (node["@graph"]) walkJsonLd(node["@graph"], visit);
}

function sitemapCandidates(robotsBody, origin) {
  const fromRobots = [...String(robotsBody).matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1].trim());
  const defaults = origin ? [origin + "/sitemap.xml", origin + "/sitemap_index.xml"] : [];
  return [...new Set([...fromRobots, ...defaults])];
}

async function probe(url) {
  try {
    const res = await fetchWithTimeout(url);
    const body = await readCapped(res, 80_000);
    return { status: res.status, body };
  } catch {
    return { status: null, body: "" };
  }
}

function attrOf(html, tag, keyName, keyVal, attr) {
  const rx = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  let m;
  while ((m = rx.exec(html)) !== null) {
    const tagHtml = m[0];
    const keyRx = new RegExp(`${keyName}=["']${keyVal}["']`, "i");
    const keyRx2 = new RegExp(`${keyName}=["'][^"']*["']`, "i");
    if (!keyRx.test(tagHtml) && !(keyName === "rel" && new RegExp(`${keyName}=["'][^"']*${keyVal}[^"']*["']`, "i").test(tagHtml))) {
      if (!keyRx.test(tagHtml)) continue;
    }
    const a = tagHtml.match(new RegExp(`${attr}=["']([^"']*)["']`, "i"));
    if (a) return decodeEntities(a[1]);
  }
  return "";
}

function hrefOf(html, tag, keyName, keyVal) {
  return attrOf(html, tag, keyName, keyVal, "href");
}

function stripTags(s) {
  return String(s).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
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

function normalizeUrl(raw) {
  if (!raw) return "";
  let u = String(raw).trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).toString();
  } catch {
    return "";
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
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
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
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

function describeErr(err) {
  const msg = String(err?.cause?.code || err?.message || err);
  if (/abort/i.test(msg)) return "timed out";
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return "domain not found";
  if (/CERT|SSL|TLS/i.test(msg)) return "SSL/certificate error";
  return msg.slice(0, 80);
}
