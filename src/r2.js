// Cloudflare R2 publish for mockup sites (#43). S3 API; template files stay
// identical — only config.js is per-lead. Callers check r2Enabled() and skip.

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCloudflareToken, getHostingMode, getR2Config, getWorkersSubdomain } from "./env.js";
import { mimeFor, resolvePreviewFile, resolveTemplateDir, serializeConfigJs } from "./site-config.js";

const TEMPLATE_FILES = ["index.html", "about.html", "styles.css", "app.js"];

/** True when every R2 env var is present. Callers skip publish when false. */
export function r2Enabled() {
  const c = getR2Config();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicBase);
}

/** Canonical template type (`accountant`), matching `resolveTemplateDir`. */
export function typeSlug(type) {
  return basename(resolveTemplateDir({ category: type }));
}

/** Per-type R2 bucket: `mockup-<type>`. */
export function bucketFor(type) {
  return `mockup-${typeSlug(type)}`;
}

/**
 * Public mockup URL.
 * Worker mode: `https://mockup-<type>.<WORKERS_SUBDOMAIN>/{placeId}/`
 * Bucket rollback: `${MOCKUP_PUBLIC_BASE}/{placeId}/index.html`
 * A 2nd argument that looks like a URL is treated as the legacy public base
 * (unit tests + explicit rollback).
 *
 * @param {string} placeId
 * @param {string} [typeOrBase]
 */
export function publicUrlFor(placeId, typeOrBase) {
  const looksUrl = typeof typeOrBase === "string" && /^https?:\/\//i.test(typeOrBase);
  const mode = getHostingMode();
  if (mode === "bucket" || looksUrl) {
    const base = String(looksUrl ? typeOrBase : getR2Config().publicBase).replace(/\/+$/, "");
    const id = encodeURI(String(placeId || "").replace(/^\/+|\/+$/g, ""));
    return `${base}/${id}/index.html`;
  }
  const sub = getWorkersSubdomain();
  if (!sub) {
    throw new Error(
      "Missing WORKERS_SUBDOMAIN in .env (e.g. your-name.workers.dev). Required when HOSTING_MODE=worker."
    );
  }
  const id = encodeURI(String(placeId || "").replace(/^\/+|\/+$/g, ""));
  return `https://${bucketFor(typeOrBase)}.${sub}/${id}/`;
}

/**
 * Publish a lead mockup. Worker mode writes only `{placeId}/config.json` to
 * `mockup-<type>`. Bucket rollback keeps the old per-lead template + config.js
 * upload to R2_BUCKET so HOSTING_MODE=bucket still serves.
 *
 * @param {string} placeId
 * @param {object} config
 * @param {string} [businessType]
 * @returns {Promise<string|null>}
 */
export async function publishMockup(placeId, config, businessType) {
  if (!placeId) throw new Error("publishMockup requires placeId");
  if (getHostingMode() === "worker") {
    if (!getCloudflareToken() && !r2Enabled()) return null;
    if (!getWorkersSubdomain()) {
      throw new Error(
        "Missing WORKERS_SUBDOMAIN in .env (e.g. your-name.workers.dev). Required when HOSTING_MODE=worker."
      );
    }
    const type = typeSlug(businessType || config?.business?.category);
    const body = JSON.stringify(config ?? {});
    await putObject(bucketFor(type), `${placeId}/config.json`, body, "application/json; charset=utf-8", "public, max-age=60");
    return publicUrlFor(placeId, type);
  }

  if (!r2Enabled()) return null;

  const r2 = getR2Config();
  const dir = resolveTemplateDir({ category: businessType || config?.business?.category });
  const client = s3Client(r2);

  for (const name of TEMPLATE_FILES) {
    const file = resolvePreviewFile(dir, "/" + name);
    if (!file) throw new Error(`template file missing: ${name} in ${dir}`);
    const body = await readFile(file);
    await put(client, r2.bucket, `${placeId}/${name}`, body, mimeFor(file));
  }

  const js = serializeConfigJs(config);
  await put(client, r2.bucket, `${placeId}/config.js`, js, "text/javascript; charset=utf-8");

  return publicUrlFor(placeId, r2.publicBase);
}

function s3Client(r2) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  });
}

async function put(client, bucket, key, body, contentType, cacheControl = "public, max-age=60") {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
}

/**
 * Put an object. Uses the S3 API when the target is the legacy R2_BUCKET
 * (those keys are often bucket-scoped). Per-type buckets (`mockup-*`) are
 * written via the Cloudflare R2 HTTP API with CLOUDFLARE_API_TOKEN, which
 * Wrangler already uses for bucket create + Worker deploy.
 */
export async function putObject(bucket, key, body, contentType, cacheControl) {
  const r2 = getR2Config();
  if (!r2.accountId) throw new Error("R2 env is missing (R2_ACCOUNT_ID)");
  const token = getCloudflareToken();
  const useApi = Boolean(token && bucket && bucket !== r2.bucket);
  if (useApi) {
    await putViaApi(r2.accountId, token, bucket, key, body, contentType, cacheControl);
    return;
  }
  if (!r2Enabled()) throw new Error("R2 env is missing (R2_ACCOUNT_ID / keys / bucket)");
  try {
    await put(s3Client(r2), bucket, key, body, contentType, cacheControl);
  } catch (err) {
    const denied = err?.name === "AccessDenied" || err?.Code === "AccessDenied";
    if (denied && token) {
      await putViaApi(r2.accountId, token, bucket, key, body, contentType, cacheControl);
      return;
    }
    throw err;
  }
}

async function putViaApi(accountId, token, bucket, key, body, contentType, cacheControl) {
  const encodedKey = String(key)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodedKey}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType || "application/octet-stream",
  };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  const res = await fetch(url, { method: "PUT", headers, body });
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  // WAF blocks some keys (Next hashed chunks named `*..js`). Wrangler PUT still works.
  if (res.status === 403 || res.status === 400) {
    await putViaWrangler(token, bucket, key, body, contentType, cacheControl);
    return;
  }
  throw new Error(`R2 API PUT ${bucket}/${key} → ${res.status}: ${text.slice(0, 400)}`);
}

async function putViaWrangler(token, bucket, key, body, contentType, cacheControl) {
  const dir = await mkdtemp(join(tmpdir(), "r2put-"));
  const file = join(dir, "body");
  await writeFile(file, body);
  try {
    const args = [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      file,
      "--remote",
    ];
    if (contentType) args.push("--content-type", contentType);
    if (cacheControl) args.push("--cache-control", cacheControl);
    const r = spawnSync("npx", args, {
      cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
      encoding: "utf8",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
    });
    if (r.status !== 0) {
      throw new Error(`wrangler r2 object put ${bucket}/${key} failed: ${(r.stdout || "") + (r.stderr || "")}`.slice(0, 500));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
