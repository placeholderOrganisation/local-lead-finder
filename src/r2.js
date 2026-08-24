// Cloudflare R2 publish for mockup sites (#43). S3 API; template files stay
// identical — only config.js is per-lead. Callers check r2Enabled() and skip.

import { readFile } from "node:fs/promises";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Config } from "./env.js";
import { mimeFor, resolvePreviewFile, resolveTemplateDir, serializeConfigJs } from "./site-config.js";

const TEMPLATE_FILES = ["index.html", "about.html", "styles.css", "app.js"];

/** True when every R2 env var is present. Callers skip publish when false. */
export function r2Enabled() {
  const c = getR2Config();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicBase);
}

/** Public object URL (R2 has no directory index — always …/index.html). */
export function publicUrlFor(placeId, publicBase = getR2Config().publicBase) {
  const base = String(publicBase || "").replace(/\/+$/, "");
  const id = encodeURI(String(placeId || "").replace(/^\/+|\/+$/g, ""));
  return `${base}/${id}/index.html`;
}

/**
 * Upload template/<type>/{index,about,styles,app} + generated config.js to
 * `{placeId}/` in the R2 bucket. Overwrites on re-publish.
 *
 * @param {string} placeId
 * @param {object} config  window.SITE object
 * @param {string} [businessType]
 * @returns {Promise<string|null>} publicUrl, or null if R2 env is missing
 */
export async function publishMockup(placeId, config, businessType) {
  if (!placeId) throw new Error("publishMockup requires placeId");
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

async function put(client, bucket, key, body, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=60",
    })
  );
}
