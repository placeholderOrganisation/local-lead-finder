// Per-type mockup Worker: shared Next static export at the bucket root,
// per-lead data at {placeId}/config.json. No npm deps.
//
// GET resolution (Next assets are root-absolute /_next/...):
//   1. key = pathname without leading `/`; trailing `/` or empty → append index.html
//   2. R2.get(key) → serve if hit
//   3. else if the ORIGINAL last path segment has no file extension → ROOT index.html
//   4. else 404
//
// Step 3 uses the original pathname so `/{placeId}/` (rewritten to
// `{placeId}/index.html`, a miss) still SPA-falls-back to root index.html.

/**
 * @param {string} pathname
 * @returns {string}
 */
export function objectKey(pathname) {
  let key = decodePath(pathname).replace(/^\/+/, "");
  if (key === "" || key.endsWith("/")) key += "index.html";
  return key;
}

/**
 * True when the request is a document/route (SPA), not a missing static file.
 * Trailing slash / empty path count as no extension.
 * @param {string} pathname
 */
export function shouldSpaFallback(pathname) {
  const path = decodePath(pathname);
  if (!path || path === "/" || path.endsWith("/")) return true;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return !last.includes(".");
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(String(pathname || "/"));
  } catch {
    return String(pathname || "/");
  }
}

function cacheControlFor(key) {
  const k = String(key || "");
  if (k.endsWith("config.json")) return "public, max-age=60";
  if (k.includes("_next/static/")) return "public, max-age=31536000, immutable";
  if (k.endsWith(".html")) return "public, max-age=60";
  return "public, max-age=300";
}

/**
 * @param {R2ObjectBody} obj
 * @param {string} key
 */
function objectResponse(obj, key) {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  if (!headers.has("cache-control")) headers.set("cache-control", cacheControlFor(key));
  headers.set("x-content-type-options", "nosniff");
  return new Response(obj.body, { headers });
}

export default {
  /**
   * @param {Request} request
   * @param {{ BUCKET: R2Bucket }} env
   */
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const pathname = new URL(request.url).pathname;
    const key = objectKey(pathname);

    let obj = await env.BUCKET.get(key);
    if (obj) return objectResponse(obj, key);

    if (shouldSpaFallback(pathname)) {
      obj = await env.BUCKET.get("index.html");
      if (obj) return objectResponse(obj, "index.html");
    }

    return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};
