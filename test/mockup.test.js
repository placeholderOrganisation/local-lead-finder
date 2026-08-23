// Mockup self-containment (#34). No network.

import test from "node:test";
import assert from "node:assert/strict";
import { templateMockup, hasExternalRequests } from "../src/mockup.js";

test("template mockup is self-contained and uses the real business name", () => {
  const html = templateMockup(
    { business: "Bramcountry Dental", category: "Dentist", phone: "905-555-0100" },
    { localArea: "Brampton, ON" }
  );
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /Bramcountry Dental/);
  assert.match(html, /Dentist/i);
  assert.match(html, /Brampton/);
  assert.match(html, /tel:9055550100/);
  assert.equal(hasExternalRequests(html), false);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("hasExternalRequests flags CDN / Google Fonts / remote images", () => {
  assert.equal(hasExternalRequests('<link href="https://fonts.googleapis.com/css?family=x" rel="stylesheet">'), true);
  assert.equal(hasExternalRequests('<img src="https://cdn.example/logo.png">'), true);
  assert.equal(hasExternalRequests("<style>body{font-family:system-ui}</style>"), false);
});
