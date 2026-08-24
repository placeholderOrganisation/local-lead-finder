// window.SITE serialization + preview path safety (#40). No network.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptySiteConfig,
  resolvePreviewFile,
  resolveTemplateDir,
  serializeConfigJs,
  TEMPLATE_ROOT,
} from "../src/site-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("serializeConfigJs escapes </script> / < / > so it cannot break out of a script tag", () => {
  const js = serializeConfigJs({
    business: { name: "</script><img src=x onerror=alert(1)>" },
    copy: { heroHeadline: "a < b & c > d" },
  });
  assert.match(js, /^window\.SITE = /);
  assert.doesNotMatch(js, /</);
  assert.doesNotMatch(js, />/);
  assert.match(js, /\\u003c\/script\\u003e/);
  assert.equal(js.includes("</script>"), false);
  const parsed = Function("return " + js.replace(/^window\.SITE = /, "").replace(/;\s*$/, ""))();
  assert.equal(parsed.business.name, "</script><img src=x onerror=alert(1)>");
  assert.equal(parsed.copy.heroHeadline, "a < b & c > d");
});

test("emptySiteConfig matches the #40 contract and is clearly labeled", () => {
  const cfg = emptySiteConfig("ChIJ_test");
  assert.equal(typeof cfg.business, "object");
  assert.equal(typeof cfg.copy, "object");
  assert.ok(Array.isArray(cfg.reviews));
  assert.equal(cfg.meta.preview, true);
  assert.equal(cfg.meta.placeId, "ChIJ_test");
  assert.match(cfg.copy.heroHeadline, /preview|mockup/i);
});

test("resolvePreviewFile rejects traversal (HTML preview is #48; source is Next now)", () => {
  const dir = resolveTemplateDir({ category: "Accountant" });
  assert.equal(dir, join(TEMPLATE_ROOT, "accountant"));
  assert.equal(resolvePreviewFile(dir, "/../src/env.js"), null);
  assert.equal(resolvePreviewFile(dir, "/../../package.json"), null);
  assert.equal(resolvePreviewFile(dir, "/%2e%2e/src/env.js"), null);
});

test("accountant template is a Next static-export SPA (#50)", () => {
  const cfg = readFileSync(join(ROOT, "template/accountant/next.config.mjs"), "utf8");
  assert.match(cfg, /output:\s*["']export["']/);
  const ctx = readFileSync(join(ROOT, "template/accountant/lib/site-context.tsx"), "utf8");
  assert.match(ctx, /config\.json/);
  assert.match(ctx, /placeId/);
  const doc = readFileSync(join(ROOT, "template/accountant/pages/_document.tsx"), "utf8");
  assert.match(doc, /noindex/);
  const app = readFileSync(join(ROOT, "template/accountant/components/site-app.tsx"), "utf8");
  assert.match(app, /Reviews via Google/);
  assert.doesNotMatch(app, /next\/link/);
});
