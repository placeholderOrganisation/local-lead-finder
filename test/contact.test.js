// Contact capture (#32): email / socials extraction + pipeline threading.
// No live network. Run: node --test

import test from "node:test";
import assert from "node:assert/strict";
import { extractContacts } from "../src/audit.js";
import { csvToRecord, recordFrom } from "../src/pipeline.js";

const PAGE = "https://www.thinkaccounting.ca/";

test("mailto + own-domain email wins over a gmail fallback", () => {
  const html = `
    <a href="mailto:noreply@thinkaccounting.ca">no</a>
    <a href="mailto:hello@gmail.com">gmail</a>
    <a href="mailto:info@thinkaccounting.ca?subject=Hi">info</a>
    Contact us at billing@thinkaccounting.ca
  `;
  const { email } = extractContacts(html, PAGE);
  assert.equal(email, "info@thinkaccounting.ca");
});

test("junk / vendor / file-extension emails are dropped", () => {
  const html = `
    <p>noreply@thinkaccounting.ca no-reply@thinkaccounting.ca</p>
    <p>pixel@2x.png user@wixpress.com alerts@sentry.io</p>
    <p>ok@otherbiz.ca</p>
  `;
  const { email } = extractContacts(html, PAGE);
  assert.equal(email, "ok@otherbiz.ca", "only the non-junk leftover remains");
});

test("social profile URLs are captured; share/intent/pixel links are not", () => {
  const html = `
    <a href="https://www.facebook.com/thinkaccounting">fb</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
    <a href="https://www.instagram.com/thinkaccounting/">ig</a>
    <a href="https://www.linkedin.com/company/think-accounting">li</a>
    <a href="https://twitter.com/intent/tweet?text=hi">tweet</a>
    <a href="https://x.com/thinkaccounting">x</a>
  `;
  const { socials } = extractContacts(html, PAGE);
  assert.ok(socials.some((u) => /facebook\.com\/thinkaccounting$/i.test(u)), "facebook profile");
  assert.ok(socials.some((u) => /instagram\.com\/thinkaccounting$/i.test(u)), "instagram profile");
  assert.ok(socials.some((u) => /linkedin\.com\/company\/think-accounting$/i.test(u)), "linkedin");
  assert.ok(socials.some((u) => /x\.com\/thinkaccounting$/i.test(u)), "x profile");
  assert.ok(!socials.some((u) => /sharer|intent/i.test(u)), "no share/intent junk");
});

test("csvToRecord threads email, socials, needsVerification", () => {
  const rec = csvToRecord({
    "Place ID": "abc",
    Business: "Ash Tax",
    Email: "info@ashtax.ca",
    Socials: "https://facebook.com/ashtax; https://instagram.com/ashtax",
    NeedsVerification: "true",
  });
  assert.equal(rec.email, "info@ashtax.ca");
  assert.deepEqual(rec.socials, ["https://facebook.com/ashtax", "https://instagram.com/ashtax"]);
  assert.equal(rec.needsVerification, true);
});

test("recordFrom prefers audit-captured contact over empty lead fields", () => {
  const lead = { name: "Ash Tax", website: "https://ashtax.ca", placeId: "p1", tier: "WARM", phone: "", rating: "", reviews: 0, category: "Accountant", address: "", mapsUrl: "" };
  const rec = recordFrom(lead, {
    audit: {
      priority: 4,
      issues: ["site returns an error (HTTP 403)"],
      email: "hello@ashtax.ca",
      socials: ["https://instagram.com/ashtax"],
      needsVerification: true,
    },
    psi: null,
  });
  assert.equal(rec.email, "hello@ashtax.ca");
  assert.deepEqual(rec.socials, ["https://instagram.com/ashtax"]);
  assert.equal(rec.needsVerification, true);
  assert.deepEqual(rec.issues, ["site returns an error (HTTP 403)"]);
});
