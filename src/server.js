#!/usr/bin/env node
// Zero-dependency dashboard server: serves the single-file SPA (#26) and a small
// JSON API over the CRM store (#23). Loopback-only, with an Origin/Host guard so
// mutating routes can't be driven by other sites (CSRF / DNS-rebinding).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./env.js";
import { listLeads, stats, updateLead, STAGES } from "./store.js";
import { ensureIndexes, close } from "./db.js";

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

    // ── mutating routes (CSRF/DNS-rebinding guarded) ──────────────────────────
    if (route === "POST /api/update") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "forbidden origin" });
      const body = await readJson(req);
      if (!body || !body.placeId) return sendJson(res, 400, { error: "placeId required" });
      const doc = await updateLead(body.placeId, body.patch || {});
      if (!doc) return sendJson(res, 404, { error: "lead not found" });
      return sendJson(res, 200, doc);
    }

    // Future mutating routes slot in here (e.g. POST /api/prepare, POST /api/mockup,
    // GET /mockup/:id) — reuse isLocalRequest() for the mutating ones.

    return sendJson(res, 404, { error: "not found" });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
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
