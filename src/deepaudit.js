// On-demand Lighthouse deep-audit for ONE lead (#38). Never used by the worker.
// Prefers unlighthouse (real Chrome Lighthouse); falls back to PageSpeed Insights
// only if unlighthouse cannot run. Requires Node >= 22.18.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPageSpeed } from "./pagespeed.js";
import { getApiKey } from "./env.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CI = join(HERE, "../node_modules/@unlighthouse/cli/bin/unlighthouse-ci.mjs");
const TIMEOUT_MS = 180_000;

/**
 * @param {string} url
 * @returns {Promise<{performance:number|null, seo:number|null, accessibility:number|null, bestPractices:number|null, lcpSec:number|null, reportPath:string|null, source:string, at:string}>}
 */
export async function deepAudit(url) {
  if (!url) throw new Error("deepAudit requires a url");
  const at = new Date().toISOString();
  try {
    const fromUl = await runUnlighthouse(url);
    return { ...fromUl, source: "unlighthouse", at };
  } catch (err) {
    console.warn(`[deepaudit] unlighthouse failed (${err.message}); trying PSI fallback`);
    const psi = await psiFallback(url);
    if (!psi) throw new Error(`deep audit failed: ${err.message}`);
    return { ...psi, source: "psi", at };
  }
}

async function runUnlighthouse(siteUrl) {
  const outputPath = await mkdtemp(join(tmpdir(), "llf-lh-"));
  const args = [
    CI,
    "--site", siteUrl,
    "--urls", "/",
    "--mobile",
    "--samples", "1",
    "--disable-sitemap",
    "--disable-robots-txt",
    "--disable-dynamic-sampling",
    "--no-cache",
    "--reporter", "json",
    "--output-path", outputPath,
  ];
  const { stdout, stderr, code } = await runNode(args, TIMEOUT_MS);
  const parsed = await parseOutputDir(outputPath) || parseStdoutJson(stdout);
  if (!parsed) {
    throw new Error(`unlighthouse produced no scores (exit ${code}): ${(stderr || stdout).slice(-400)}`);
  }
  return { ...parsed, reportPath: outputPath };
}

function runNode(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("unlighthouse timed out"));
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code });
    });
  });
}

async function parseOutputDir(dir) {
  const files = await walkJson(dir);
  for (const f of files) {
    try {
      const data = JSON.parse(await readFile(f, "utf8"));
      const scores = extractScores(data);
      if (scores) return scores;
    } catch { /* try next */ }
  }
  return null;
}

async function walkJson(dir, acc = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walkJson(p, acc);
    else if (e.name.endsWith(".json")) acc.push(p);
  }
  return acc;
}

function parseStdoutJson(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return extractScores(JSON.parse(text));
  } catch {
    const start = text.indexOf("[");
    const startObj = text.indexOf("{");
    const i = start === -1 ? startObj : startObj === -1 ? start : Math.min(start, startObj);
    if (i < 0) return null;
    try {
      return extractScores(JSON.parse(text.slice(i)));
    } catch {
      return null;
    }
  }
}

function extractScores(data) {
  const row = Array.isArray(data) ? data[0] : (data?.reports?.[0] || data?.routes?.[0] || data);
  if (!row || typeof row !== "object") return null;
  const performance = toPct(row.performance ?? row.categories?.performance?.score);
  const seo = toPct(row.seo ?? row.categories?.seo?.score);
  const accessibility = toPct(row.accessibility ?? row.categories?.accessibility?.score);
  const bestPractices = toPct(row.bestPractices ?? row["best-practices"] ?? row.categories?.["best-practices"]?.score);
  if (performance == null && seo == null && accessibility == null) return null;
  const lcp = row.lcpSec ?? row.lcp ?? row.audits?.["largest-contentful-paint"]?.numericValue;
  const lcpSec = typeof lcp === "number" ? (lcp > 50 ? Number((lcp / 1000).toFixed(1)) : Number(lcp.toFixed(1))) : null;
  return { performance, seo, accessibility, bestPractices, lcpSec };
}

function toPct(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

async function psiFallback(url) {
  const apiKey = getApiKey();
  const psi = await runPageSpeed({ url, apiKey, strategy: "mobile" });
  if (!psi?.ok) return null;
  return {
    performance: psi.performance ?? null,
    seo: psi.seo ?? null,
    accessibility: psi.accessibility ?? null,
    bestPractices: psi.bestPractices ?? null,
    lcpSec: psi.lcpSec ?? null,
    reportPath: null,
  };
}
