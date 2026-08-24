#!/usr/bin/env node
// Zero-dependency dashboard server: serves the single-file SPA (#26) and a small
// JSON API over the CRM store (#23). Loopback-only, with an Origin/Host guard so
// mutating routes can't be driven by other sites (CSRF / DNS-rebinding).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./env.js";
import { listLeads, stats, updateLead, getLead, saveLighthouse, saveAssets, saveMockup, STAGES } from "./store.js";
import { ensureIndexes, close } from "./db.js";
import { deepAudit } from "./deepaudit.js";
import { prepareOutreach } from "./compose.js";
import { buildSiteConfig } from "./mockup.js";
import {
  emptySiteConfig,
  mimeFor,
  resolvePreviewFile,
  resolveTemplateDir,
  serializeConfigJs,
} from "./site-config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, "public");
const HOST = "127.0.0.1";

loadEnv();
const PORT = Number(process.env.PORT) || 4000;

async function handle(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);
    const route = `${req.method} ${url.pathname}`;

    // ── read routes ──────────────────────────────────────────────────────────
    if (route === "GET /" || route === "GET /index.html") {
      return serveSpa(res);
    }
    if (route === "GET /api/leads") {
      const [leads, s] = await Promise.all([listLeads(filterFromQuery(url.searchParams)), stats()]);
      return sendJson(res, 200, { leads, stats: s, stages: STAGES });
    }

    const mockupMatch = url.pathname.match(/^\/mockup\/([^/]+)$/);
    if (req.method === "GET" && mockupMatch) {
      const placeId = decodeURIComponent(mockupMatch[1]);
      const lead = await getLead(placeId);
      const html = lead?.mockup?.html;
      if (!html) return sendJson(res, 404, { error: "mockup not found" });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    const previewMatch = url.pathname.match(/^\/preview\/([^/]+)(\/.*)?$/);
    if (req.method === "GET" && previewMatch) {
      const placeId = decodeURIComponent(previewMatch[1]);
      return servePreview(res, placeId, previewMatch[2]);
    }

    // ── mutating routes (CSRF/DNS-rebinding guarded) ──────────────────────────
    if (route === "POST /api/update") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "forbidden origin" });
      const body = await readJson(req);
      if (!body || !body.placeId) return sendJson(res, 400, { error: "placeId required" });
      const doc = await updateLead(body.placeId, body.patch || {});
      if (!doc) return sendJson(res, 404, { error: "lead not found" });
      return sendJson(res, 200, doc);
    }

    if (route === "POST /api/deepaudit") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "forbidden origin" });
      req.setTimeout(180_000);
      const body = await readJson(req);
      if (!body || !body.placeId) return sendJson(res, 400, { error: "placeId required" });
      const lead = await getLead(body.placeId);
      if (!lead) return sendJson(res, 404, { error: "lead not found" });
      if (!lead.website) return sendJson(res, 400, { error: "lead has no website" });
      const scores = await deepAudit(lead.website);
      const doc = await saveLighthouse(body.placeId, scores);
      return sendJson(res, 200, { lighthouse: scores, lead: doc });
    }

    if (route === "POST /api/prepare") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "forbidden origin" });
      req.setTimeout(90_000);
      const body = await readJson(req);
      if (!body || !body.placeId) return sendJson(res, 400, { error: "placeId required" });
      const lead = await getLead(body.placeId);
      if (!lead) return sendJson(res, 404, { error: "lead not found" });
      const assets = await prepareOutreach(lead);
      const doc = await saveAssets(body.placeId, assets);
      return sendJson(res, 200, { assets, lead: doc });
    }

    if (route === "POST /api/mockup") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "forbidden origin" });
      req.setTimeout(90_000);
      const body = await readJson(req);
      if (!body || !body.placeId) return sendJson(res, 400, { error: "placeId required" });
      const lead = await getLead(body.placeId);
      if (!lead) return sendJson(res, 404, { error: "lead not found" });
      const config = await buildSiteConfig(lead);
      const doc = await saveMockup(body.placeId, {
        config,
        generatedAt: config.meta?.generatedAt,
        model: config.meta?.model,
      });
      return sendJson(res, 200, { ok: true, url: `/preview/${encodeURIComponent(body.placeId)}/`, lead: doc });
    }

    return sendJson(res, 404, { error: "not found" });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}

/**
 * GET /preview/:placeId/* — serve the checked-in template with per-lead config.js.
 * Template files are never rewritten; only config.js is generated from mockup.config.
 * Relative links (about.html, styles.css, app.js) resolve the same as file://.
 */
async function servePreview(res, placeId, rest) {
  if (rest == null) {
    res.writeHead(302, { Location: `/preview/${encodeURIComponent(placeId)}/` });
    res.end();
    return;
  }

  const lead = await getLead(placeId);
  if (!lead) return sendJson(res, 404, { error: "lead not found" });

  const rel = rest === "/" ? "/index.html" : rest;
  const base = rel.split("/").filter(Boolean).pop() || "";

  if (base === "config.js") {
    const stored = lead.mockup?.config;
    const config = stored && typeof stored === "object" ? { ...stored } : emptySiteConfig(placeId);
    config.meta = { ...(config.meta || {}), preview: true, placeId };
    const body = serializeConfigJs(config);
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    });
    res.end(body);
    return;
  }

  const file = resolvePreviewFile(resolveTemplateDir(lead), rel);
  if (!file) return sendJson(res, 404, { error: "not found" });
  const buf = await readFile(file);
  res.writeHead(200, {
    "Content-Type": mimeFor(file),
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(buf);
}

async function serveSpa(res) {
  try {
    const html = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    // The SPA (#26) isn't built yet — respond gracefully instead of crashing.
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><meta charset=utf-8><title>Local Lead Finder</title>" +
      "<p>Dashboard UI not built yet (see ticket #26). API is live at <code>/api/leads</code>.</p>");
  }
}

// ── helpers ───────────────────────────────────────────────────────────────
function filterFromQuery(sp) {
  const f = {};
  for (const k of ["status", "tier", "category", "text"]) {
    const v = sp.get(k);
    if (v) f[k] = v;
  }
  if (isTrue(sp.get("due"))) f.due = true;
  if (isTrue(sp.get("hasAssets"))) f.hasAssets = true;
  return f;
}

const isTrue = (v) => v === "1" || v === "true";

// Loopback guard: Host must be localhost, and any Origin sent must be localhost too.
function isLocalRequest(req) {
  if (!isLoopback(hostname(req.headers.host))) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!isLoopback(new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function isLoopback(h) {
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function hostname(h) {
  if (!h) return "";
  if (h.startsWith("[")) return h.slice(1, h.indexOf("]")); // [::1]:port
  return h.split(":")[0];
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function start() {
  await ensureIndexes(); // connects Mongo once and ensures indexes exist
  const server = createServer(handle);
  server.listen(PORT, HOST, () => {
    console.log(`Local Lead Finder dashboard → http://${HOST}:${PORT}`);
  });

  const shutdown = async () => {
    await close();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
