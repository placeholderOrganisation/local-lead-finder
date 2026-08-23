// Orchestrates auditing a set of leads: DIY fetch checks + optional PageSpeed.
// Returns a map of website -> { audit, psi } for the pipeline to merge in.

import { auditSite } from "./audit.js";
import { runPageSpeed } from "./pagespeed.js";

/**
 * Audit the given canonical lead objects (must have `.website` and `.name`).
 * @param {Array<object>} targets
 * @param {object} opts
 * @param {number} [opts.concurrency]
 * @param {boolean} [opts.pagespeed]
 * @param {string} [opts.apiKey]
 * @param {(msg:string)=>void} [opts.onProgress]
 * @returns {Promise<Map<string,{audit:object,psi:object}>>}
 */
export async function auditTargets(targets, opts = {}) {
  const { concurrency = 6, pagespeed = false, apiKey, onProgress = () => {} } = opts;
  // PSI runs real Lighthouse audits server-side and is slow — throttle it hard.
  const limit = pagespeed ? Math.min(3, concurrency) : concurrency;

  const results = new Map();
  let done = 0;

  await mapLimit(targets, limit, async (lead) => {
    const audit = await auditSite(lead.website);

    let psi = null;
    if (pagespeed && audit.reachable) {
      psi = await runPageSpeed({ url: audit.finalUrl || lead.website, apiKey, strategy: "mobile" });
      if (psi.ok && typeof psi.performance === "number" && psi.performance < 50) {
        // Most persuasive line — put it first so it leads the pitch.
        audit.issues.unshift(`scores ${psi.performance}/100 on Google's mobile speed test`);
        audit.priority = Math.min(5, (audit.priority ?? 1) + 1);
      }
    }

    results.set(lead.website, { audit, psi });
    done++;
    const bits = [audit.issues.length ? `${audit.issues.length} issue(s)` : "clean"];
    if (psi?.ok) bits.push(`PSI ${psi.performance}`);
    else if (psi && !psi.ok) bits.push("PSI err");
    onProgress(`  [${done}/${targets.length}] ${trunc(lead.name, 34)} — ${bits.join(", ")}`);
  });

  return results;
}

export function summarizeAudits(map) {
  const entries = [...map.values()];
  return {
    total: entries.length,
    withIssues: entries.filter((e) => e.audit.issues.length).length,
    noHttps: entries.filter((e) => e.audit.reachable && !e.audit.secure).length,
    noMobile: entries.filter((e) => e.audit.reachable && e.audit.mobileFriendly === false).length,
    down: entries.filter((e) => !e.audit.reachable).length,
    slowPsi: entries.filter((e) => e.psi?.ok && typeof e.psi.performance === "number" && e.psi.performance < 50).length,
  };
}

/**
 * @param {object} s      summary from summarizeAudits
 * @param {boolean} pagespeed
 * @param {Array<object>} rows  unified rows (for the top-opportunities display)
 */
export function printSummary(s, pagespeed, rows = []) {
  console.log(`\n--- Audit summary ---`);
  console.log(`  ${s.withIssues}/${s.total} sites have at least one sellable issue`);
  console.log(`  ${s.noMobile} not mobile-friendly`);
  console.log(`  ${s.noHttps} missing HTTPS`);
  console.log(`  ${s.down} down / unreachable`);
  if (pagespeed) console.log(`  ${s.slowPsi} score under 50/100 on Google mobile speed`);
  const top = rows.filter((r) => r.Website && r.Issues && r.Issues !== "no website").slice(0, 3);
  if (top.length) {
    console.log(`\n  Top opportunities:`);
    for (const r of top) console.log(`   • ${trunc(r.Business, 30)} — ${r.Issues}`);
  }
}

export async function mapLimit(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

export const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
