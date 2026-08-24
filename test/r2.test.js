// R2 helpers (#43). No network — does not call S3.

import test from "node:test";
import assert from "node:assert/strict";
import { r2Enabled, publicUrlFor, bucketFor } from "../src/r2.js";
import { getR2Config } from "../src/env.js";

test("publicUrlFor always points at index.html under the placeId prefix", () => {
  assert.equal(
    publicUrlFor("ChIJ123", "https://mockups.example.com/"),
    "https://mockups.example.com/ChIJ123/index.html"
  );
});

test("bucketFor is mockup-<type>", () => {
  assert.equal(bucketFor("accountant"), "mockup-accountant");
  assert.equal(bucketFor("Accounting"), "mockup-accountant");
  assert.equal(bucketFor("Consultant"), "mockup-accountant");
});

test("publicUrlFor worker mode uses the Worker URL and throws without WORKERS_SUBDOMAIN", () => {
  const keys = ["HOSTING_MODE", "HOSTING_MODE", "WORKERS_SUBDOMAIN", "WORKERS_SUBDOMAIN"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.HOSTING_MODE = "worker";
    process.env.HOSTING_MODE = "worker";
    process.env.WORKERS_SUBDOMAIN = "example.workers.dev";
    process.env.WORKERS_SUBDOMAIN = "example.workers.dev";
    assert.equal(
      publicUrlFor("ChIJ123", "accountant"),
      "https://mockup-accountant.example.workers.dev/ChIJ123/"
    );
    process.env.WORKERS_SUBDOMAIN = "";
    process.env.WORKERS_SUBDOMAIN = "";
    assert.throws(
      () => publicUrlFor("ChIJ123", "accountant"),
      /WORKERS_SUBDOMAIN/
    );
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test("publicUrlFor bucket mode keeps the old public-bucket index.html URL", () => {
  const keys = ["HOSTING_MODE", "MOCKUP_PUBLIC_BASE"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.HOSTING_MODE = "bucket";
    process.env.MOCKUP_PUBLIC_BASE = "https://pub.example.com";
    assert.equal(
      publicUrlFor("ChIJ123", "accountant"),
      "https://pub.example.com/ChIJ123/index.html"
    );
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
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
