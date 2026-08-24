// Outreach compose (#33): money language, segment angles, no unverified down-claims.
// Run: node --test

import test from "node:test";
import assert from "node:assert/strict";
import { mockOutreach } from "../src/compose.js";

const profile = {
  senderName: "Saksham",
  localArea: "Brampton, ON",
  portfolioUrl: "https://example-portfolio.test",
  calendarUrl: "https://cal.example.test/saksham",
};

const TECH = /viewport|lcp\b|http\s*403|http\s*500|meta tags|seo audit|\btls\b|mobile-friendly tag/i;
const DOWN = /\b(site|website|page)\b.{0,24}\b(down|broken|offline|unreachable|dead)\b|\b(down|broken|offline)\b.{0,24}\b(site|website)\b|http\s*(403|500)|returns? an error/i;

test("no-website vs has-site produce different pitched angles", () => {
  const none = mockOutreach(
    { business: "Ash Tax", website: "", issues: "no website", tier: "HOT", needsVerification: false },
    profile
  );
  const has = mockOutreach(
    { business: "Ash Tax", website: "https://ashtax.ca", issues: ["not mobile-friendly"], tier: "WARM", needsVerification: false },
    profile
  );
  assert.equal(none.pitchedAngle, "no-website-legitimacy");
  assert.equal(has.pitchedAngle, "lost-customers");
  assert.notEqual(none.moneyPitch, has.moneyPitch);
  assert.ok(/referral|don't already know|invisible/i.test(none.phoneScript), "no-website leans on the phone script");
  assert.ok(/phone/i.test(has.moneyPitch), "has-site talks lost mobile customers");
});

test("moneyPitch uses customer/revenue language, not raw tech", () => {
  const a = mockOutreach({ business: "Ash Tax", website: "", issues: "no website", needsVerification: false }, profile);
  const b = mockOutreach({ business: "Ash Tax", website: "https://ashtax.ca", issues: ["not mobile-friendly"], needsVerification: false }, profile);
  for (const x of [a, b]) {
    assert.ok(x.moneyPitch && x.emailDraft.subject && x.emailDraft.body && x.phoneScript);
    assert.ok(!TECH.test(x.moneyPitch + x.emailDraft.body + x.phoneScript));
    assert.ok(x.emailDraft.body.includes("Saksham"), "sender name injected");
    assert.ok(x.emailDraft.body.includes("Brampton"), "local area injected");
    assert.ok(x.emailDraft.body.includes(profile.portfolioUrl), "portfolio injected");
  }
});

test("needsVerification lead makes NO site-down claim", () => {
  const x = mockOutreach(
    {
      business: "Ash Tax",
      website: "https://ashtax.ca",
      issues: ["site returns an error (HTTP 403)"],
      needsVerification: true,
    },
    profile
  );
  assert.equal(x.pitchedAngle, "verify-first");
  const blob = `${x.moneyPitch}\n${x.emailDraft.body}\n${x.phoneScript}`;
  assert.ok(!DOWN.test(blob), blob);
  assert.ok(/haven't verified|not going to claim|rather look/i.test(blob));
});

test("email CTA includes mockup.publicUrl when present and never a null placeholder", () => {
  const url = "https://pub.example.test/ChIJ123/index.html";
  const none = mockOutreach(
    { business: "Ash Tax", website: "", issues: "no website", mockup: { publicUrl: url } },
    profile
  );
  const has = mockOutreach(
    { business: "Ash Tax", website: "https://ashtax.ca", mockup: { publicUrl: url } },
    profile
  );
  assert.ok(none.emailDraft.body.includes(url), "no-website email carries the public URL");
  assert.ok(has.emailDraft.body.includes(url), "has-site email carries the public URL");
  const missing = mockOutreach({ business: "Ash Tax", website: "", issues: "no website" }, profile);
  assert.ok(!/\bnull\b/.test(missing.emailDraft.body), "no publicUrl must not emit the string null");
});

test("verified lighthouse score is cited in the has-site moneyPitch", () => {
  const x = mockOutreach(
    {
      business: "Ash Tax",
      website: "https://ashtax.ca",
      needsVerification: false,
      lighthouse: { performance: 34, seo: 50 },
    },
    profile
  );
  assert.match(x.moneyPitch, /34\/100/);
});
