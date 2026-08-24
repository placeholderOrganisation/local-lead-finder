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
import { r2Enabled, publishMockup } from "./r2.js";
import {
  emptySiteConfig,
  mimeFor,
  resolvePreviewFile,
  resolvePreviewRoot,
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

    const mockupMatch = url.pathname.match(/^\/mockup\/([^/]+)\/?$/);
    if (req.method === "GET" && mockupMatch) {
      const placeId = decodeURIComponent(mockupMatch[1]);
      res.writeHead(302, { Location: `/preview/${encodeURIComponent(placeId)}/` });
      res.end();
      return;
    }

    const previewMatch = url.pathname.match(/^\/preview\/([^/]+)(\/.*)?$/);
    if (req.method === "GET" && previewMatch) {
      const placeId = decodeURIComponent(previewMatch[1]);
      return servePreview(res, placeId, previewMatch[2]);
    }

    // Next export uses origin-absolute `/_next/…` and `/{placeId}/config.json`.
    if (req.method === "GET" && url.pathname.startsWith("/_next/")) {
      return serveExportAsset(res, url.pathname);
    }
    const configMatch = url.pathname.match(/^\/([^/]+)\/config\.json$/);
    if (req.method === "GET" && configMatch) {
      const placeId = decodeURIComponent(configMatch[1]);
      if (!["api", "preview", "mockup"].includes(placeId)) {
        const lead = await getLead(placeId);
        if (!lead) return sendJson(res, 404, { error: "lead not found" });
        return sendLeadConfig(res, lead, placeId);
      }
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
      const ready = await ensureMockup(lead, { publish: r2Enabled() });
      const assets = await prepareOutreach(ready.lead);
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
      const out = await ensureMockup(lead, { regenerate: true, publish: r2Enabled() });
      return sendJson(res, 200, {
        ok: true,
        previewUrl: out.previewUrl,
        publicUrl: out.publicUrl,
        lead: out.lead,
      });
    }

    if (route === "POST /api/publish") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "forbidden origin" });
      req.setTimeout(60_000);
      const body = await readJson(req);
      if (!body || !body.placeId) return sendJson(res, 400, { error: "placeId required" });
      if (!r2Enabled()) return sendJson(res, 400, { error: "R2 is not configured" });
      const lead = await getLead(body.placeId);
      if (!lead) return sendJson(res, 404, { error: "lead not found" });
      const out = await ensureMockup(lead, { regenerate: !lead.mockup?.config, publish: true });
      let doc = out.lead;
      if (out.publicUrl) {
        const assets = await prepareOutreach(doc);
        doc = await saveAssets(body.placeId, assets);
      }
      return sendJson(res, 200, {
        ok: true,
        previewUrl: out.previewUrl,
        publicUrl: out.publicUrl,
        lead: doc,
        assets: doc?.assets || null,
      });
    }

    return sendJson(res, 404, { error: "not found" });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}

/**
 * Build (if needed) and optionally publish a mockup. Used by generate, publish,
 * and prepare so the email CTA always sees a real publicUrl when R2 is on.
 */
async function ensureMockup(lead, { regenerate = false, publish = false } = {}) {
  const placeId = lead._id || lead.placeId;
  let config = !regenerate && lead.mockup?.config ? lead.mockup.config : null;
  const built = !config;
  if (!config) {
    config = await buildSiteConfig(lead);
  }
  const payload = {
    config,
    generatedAt: config.meta?.generatedAt || lead.mockup?.generatedAt,
    model: config.meta?.model || lead.mockup?.model,
  };
  // Always persist a newly built config so /preview works even when R2 is off.
  if (built) await saveMockup(placeId, payload);

  let publicUrl = lead.mockup?.publicUrl || null;
  if (publish && r2Enabled()) {
    publicUrl = await publishMockup(placeId, config, lead.category);
    await saveMockup(placeId, { ...payload, publicUrl });
  }
  const fresh = (await getLead(placeId)) || lead;
  return {
    config,
    publicUrl: fresh.mockup?.publicUrl || publicUrl || null,
    previewUrl: `/preview/${encodeURIComponent(placeId)}/`,
    lead: fresh,
  };
}

/**
 * GET /preview/:placeId/* — Next `out/` + per-lead config.json (SPA fallback).
 * Origin-absolute `/_next/…` and `/{placeId}/config.json` are served separately
 * so the export matches production.
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

  if (base === "config.json") {
    return sendLeadConfig(res, lead, placeId);
  }

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

  const root = resolvePreviewRoot(lead);
  let file = resolvePreviewFile(root, rel);
  if (!file && base && !base.includes(".")) {
    file = resolvePreviewFile(root, "/index.html");
  }
  if (!file) return sendJson(res, 404, { error: "not found" });
  const buf = await readFile(file);
  res.writeHead(200, {
    "Content-Type": mimeFor(file),
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(buf);
}

async function serveExportAsset(res, pathname) {
  const root = resolvePreviewRoot({ category: "accountant" });
  const file = resolvePreviewFile(root, pathname);
  if (!file) return sendJson(res, 404, { error: "not found" });
  const buf = await readFile(file);
  res.writeHead(200, {
    "Content-Type": mimeFor(file),
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(buf);
}

function sendLeadConfig(res, lead, placeId) {
  const stored = lead.mockup?.config;
  const config = stored && typeof stored === "object" ? { ...stored } : emptySiteConfig(placeId);
  config.meta = { ...(config.meta || {}), preview: true, placeId };
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(JSON.stringify(config));
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
