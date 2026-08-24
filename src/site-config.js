// window.SITE contract (#40) + preview helpers.
// Template files stay identical on disk / local / R2; only config.js is per-lead.

import { existsSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATE_ROOT = join(ROOT, "template");

export const PREVIEW_MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const TYPE_ALIASES = {
  accounting: "accountant",
  accountants: "accountant",
  cpa: "accountant",
  "chartered-accountant": "accountant",
  "chartered-professional-accountant": "accountant",
};

/**
 * Canonical empty/example SITE object (ticket #40 contract).
 * Served when a lead has no mockup.config yet so the template still renders.
 * @param {string} [placeId]
 */
export function emptySiteConfig(placeId = "") {
  return {
    business: {
      name: "Preview example",
      category: "",
      phone: "",
      tel: "",
      address: "",
      mapsUrl: "",
      area: "",
      rating: null,
      reviewCount: null,
    },
    copy: {
      heroHeadline: "Preview / mockup",
      heroSub: "No config yet — generate a mockup to personalize this template.",
      about: "",
      services: [],
      faq: [],
    },
    reviews: [],
    meta: { preview: true, generatedAt: null, placeId: placeId || "" },
  };
}

/**
 * Serialize a SITE object as config.js. JSON.stringify plus `<` / `>` / `&`
 * escaping so a value like `</script>` cannot break out of a <script> tag.
 * @param {object} config
 * @returns {string}
 */
export function serializeConfigJs(config) {
  const json = JSON.stringify(config === undefined ? null : config)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `window.SITE = ${json};\n`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function dirHasIndex(dir) {
  return existsSync(join(dir, "index.html"));
}

/**
 * Pick `template/<business_type>/` for a lead. Falls back to `accountant`.
 * @param {object} [lead]
 * @returns {string} absolute directory
 */
export function resolveTemplateDir(lead) {
  const raw = lead?.businessType || lead?.business_type || lead?.category || "accountant";
  const slug = slugify(raw) || "accountant";
  const exact = join(TEMPLATE_ROOT, slug);
  if (dirHasIndex(exact)) return exact;
  const alias = TYPE_ALIASES[slug];
  if (alias) {
    const aliased = join(TEMPLATE_ROOT, alias);
    if (dirHasIndex(aliased)) return aliased;
  }
  return join(TEMPLATE_ROOT, "accountant");
}

/**
 * Directory the dashboard serves for `/preview`. Prefers the Next static
 * export (`out/`) when present so local preview matches production.
 * @param {object} [lead]
 * @returns {string}
 */
export function resolvePreviewRoot(lead) {
  const dir = resolveTemplateDir(lead);
  const out = join(dir, "out");
  if (dirHasIndex(out)) return out;
  return dir;
}

/**
 * Resolve a file under a template dir. Rejects path traversal and missing files.
 * @param {string} templateDir
 * @param {string} urlPath  e.g. "/index.html", "/about.html", "/"
 * @returns {string|null} absolute file path
 */
export function resolvePreviewFile(templateDir, urlPath) {
  let rel = String(urlPath || "");
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return null;
  }
  rel = rel.replace(/^\/+/, "") || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  if (rel.includes("\0") || rel.split(/[/\\]/).includes("..")) return null;

  const root = resolve(templateDir);
  const resolved = resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(root + sep)) return null;
  if (!existsSync(resolved)) return null;
  try {
    if (!statSync(resolved).isFile()) return null;
  } catch {
    return null;
  }
  return resolved;
}

export function mimeFor(filePath) {
  return PREVIEW_MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
}
