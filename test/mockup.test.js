// Site-config mockup (#41). No network — tests the deterministic fallback.

import test from "node:test";
import assert from "node:assert/strict";
import { fallbackSiteConfig, factsOf, telOf } from "../src/mockup.js";

const TECH = /viewport|lcp\b|http\s*403|http\s*500|meta tags|seo audit|\btls\b|mobile-friendly|responsive design|page speed/i;

test("telOf normalizes a human phone into a tel: href", () => {
  assert.equal(telOf("(905) 555-0142"), "tel:9055550142");
  assert.equal(telOf("+1 416 893 0781"), "tel:+14168930781");
  assert.equal(telOf(""), "");
});

test("fallback SITE matches the #40 contract, uses real facts, reviews empty", () => {
  const site = fallbackSiteConfig({
    business: "Ash Tax",
    category: "Accountant",
    phone: "(905) 555-0142",
    address: "64 Bramalea Rd, Brampton, ON",
    mapsUrl: "https://maps.google.com/?cid=1",
    rating: 4.8,
    reviews: 87,
  });
  assert.equal(site.business.name, "Ash Tax");
  assert.equal(site.business.category, "Accountant");
  assert.equal(site.business.phone, "(905) 555-0142");
  assert.equal(site.business.tel, "tel:9055550142");
  assert.equal(site.business.rating, 4.8);
  assert.equal(site.business.reviewCount, 87);
  assert.equal(site.html, undefined);
  assert.ok(Array.isArray(site.reviews) && site.reviews.length === 0);
  assert.match(site.copy.heroHeadline, /Ash Tax/);
  assert.match(site.copy.heroSub, /Accountant/i);
  assert.ok(site.copy.about.length > 40);
  assert.ok(site.copy.services.length >= 3);
  assert.equal(typeof site.copy.services[0].title, "string");
  assert.equal(typeof site.copy.services[0].desc, "string");
  assert.ok(site.copy.faq.length >= 3);
  assert.match(site.copy.faq[0].q + site.copy.faq[0].a, /preview|mockup/i);
  assert.equal(site.meta.preview, true);
  const blob = JSON.stringify(site.copy);
  assert.equal(TECH.test(blob), false);
  assert.match(blob, /call|customer|job|neighbour|phone/i);
});

test("factsOf reads canonical lead fields (reviews count, mapsUrl)", () => {
  const f = factsOf({
    business: "Ash Tax",
    category: "Accountant",
    phone: "905-555-0142",
    address: "Brampton, ON",
    mapsUrl: "https://maps.google.com/?q=x",
    rating: 5,
    reviews: 411,
  });
  assert.equal(f.reviewCount, 411);
  assert.equal(f.mapsUrl, "https://maps.google.com/?q=x");
});

test("no-website vs has-site fallback copy takes a different angle", () => {
  const none = fallbackSiteConfig({ business: "Ash Tax", category: "Accountant", phone: "905-555-0142" });
  const has = fallbackSiteConfig({
    business: "Ash Tax",
    category: "Accountant",
    phone: "905-555-0142",
    website: "https://ashtax.example",
  });
  assert.notEqual(none.copy.heroHeadline, has.copy.heroHeadline);
  assert.match(none.copy.about, /number|Google|legitimate/i);
  assert.match(has.copy.about, /phone|bounce|call/i);
});
