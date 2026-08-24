// R2 helpers (#43). No network — does not call S3.

import test from "node:test";
import assert from "node:assert/strict";
import { r2Enabled, publicUrlFor } from "../src/r2.js";
import { getR2Config } from "../src/env.js";

test("publicUrlFor always points at index.html under the placeId prefix", () => {
  assert.equal(
    publicUrlFor("ChIJ123", "https://mockups.example.com/"),
    "https://mockups.example.com/ChIJ123/index.html"
  );
});

test("r2Enabled is false when required env is missing", () => {
  const keys = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "MOCKUP_PUBLIC_BASE",
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) process.env[k] = "";
    assert.equal(r2Enabled(), false);
    assert.equal(getR2Config().bucket, "");
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
