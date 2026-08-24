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

test("resolvePreviewFile serves template assets and rejects traversal", () => {
  const dir = resolveTemplateDir({ category: "Accountant" });
  assert.equal(dir, join(TEMPLATE_ROOT, "accountant"));
  assert.ok(resolvePreviewFile(dir, "/").endsWith("index.html"));
  assert.ok(resolvePreviewFile(dir, "/index.html").endsWith("index.html"));
  assert.ok(resolvePreviewFile(dir, "/about.html").endsWith("about.html"));
  assert.ok(resolvePreviewFile(dir, "/styles.css").endsWith("styles.css"));
  assert.ok(resolvePreviewFile(dir, "/app.js").endsWith("app.js"));
  assert.equal(resolvePreviewFile(dir, "/config.js") !== null, true);
  assert.equal(resolvePreviewFile(dir, "/../src/env.js"), null);
  assert.equal(resolvePreviewFile(dir, "/../../package.json"), null);
  assert.equal(resolvePreviewFile(dir, "/%2e%2e/src/env.js"), null);
});

test("template HTML has noindex + preview banner; app.js binds via textContent", () => {
  const index = readFileSync(join(ROOT, "template/accountant/index.html"), "utf8");
  const about = readFileSync(join(ROOT, "template/accountant/about.html"), "utf8");
  const app = readFileSync(join(ROOT, "template/accountant/app.js"), "utf8");
  for (const html of [index, about]) {
    assert.match(html, /<meta name="robots" content="noindex/);
    assert.match(html, /preview-banner/);
    assert.match(html, /Preview \/ mockup/i);
    assert.match(html, /href="styles.css"/);
    assert.match(html, /src="app.js"/);
    assert.match(html, /src="config.js"/);
    assert.doesNotMatch(html, /<(?:script|link|img|iframe)\b[^>]*(?:src|href)\s*=\s*["']https?:/i);
  }
  assert.match(index, /href="about.html"/);
  assert.match(app, /textContent/);
  assert.match(app, /function normalizeSite/);
  const assigns = [...app.matchAll(/\.innerHTML\s*=/g)];
  assert.equal(assigns.length, 1);
  assert.match(app, /sanitizeSvg[\s\S]{0,400}innerHTML/);
});
