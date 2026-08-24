// Shared .env loading + API key resolution (no dotenv dependency).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Load KEY=VALUE pairs from a .env file into process.env (won't overwrite existing). */
export function loadEnv(path = join(ROOT, ".env")) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (key.startsWith("#")) continue;
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

/**
 * Resolve the Google API key, loading .env first.
 * @param {{required?: boolean}} [opts]
 * @returns {string|undefined}
 */
export function getApiKey({ required = false } = {}) {
  loadEnv();
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const missing = !key || key === "your-key-here";
  if (missing && required) {
    throw new Error(
      "No API key found.\n" +
        "  1. cp .env.example .env\n" +
        "  2. paste your key into .env as GOOGLE_PLACES_API_KEY=...\n" +
        "Then re-run."
    );
  }
  return missing ? undefined : key;
}

/**
 * Resolve the MongoDB connection string, loading .env first.
 * @param {{required?: boolean}} [opts]
 * @returns {string|undefined}
 */
export function getMongoUri({ required = false } = {}) {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  const missing = !uri || uri === "your-mongodb-uri-here";
  if (missing && required) {
    throw new Error(
      "No MongoDB URI found.\n" +
        "  1. cp .env.example .env\n" +
        "  2. paste your Atlas connection string into .env as MONGODB_URI=...\n" +
        "Then re-run."
    );
  }
  return missing ? undefined : uri;
}

/**
 * Resolve the worker's monthly Places-request cap, loading .env first.
 * The worker refuses to start a run once the month's usage reaches this.
 * @param {{fallback?: number}} [opts]  value to use when unset/invalid.
 * @returns {number}
 */
export function getMonthlyPlacesCap({ fallback = 4500 } = {}) {
  loadEnv();
  const n = Number(process.env.MONTHLY_PLACES_CAP);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Resolve the OpenAI API key, loading .env first.
 * @param {{required?: boolean}} [opts]
 * @returns {string|undefined}
 */
export function getOpenAIKey({ required = false } = {}) {
  loadEnv();
  const key = process.env.OPENAI_API_KEY;
  const missing = !key || key === "your-openai-key-here";
  if (missing && required) {
    throw new Error(
      "No OpenAI API key found.\n" +
        "  1. cp .env.example .env\n" +
        "  2. paste your key into .env as OPENAI_API_KEY=...\n" +
        "Then re-run."
    );
  }
  return missing ? undefined : key;
}

/**
 * Resolve the OpenAI chat model, loading .env first.
 * @param {{fallback?: string}} [opts]
 * @returns {string}
 */
export function getOpenAIModel({ fallback = "gpt-4o-mini" } = {}) {
  loadEnv();
  const m = (process.env.OPENAI_MODEL || "").trim();
  return m || fallback;
}

/**
 * Optional OpenAI-compatible base URL (OpenRouter, etc.). Empty → official API.
 * @returns {string|undefined}
 */
export function getOpenAIBaseURL() {
  loadEnv();
  const u = (process.env.OPENAI_BASE_URL || "").trim();
  return u || undefined;
}

/**
 * Sender identity injected into outreach copy.
 * @returns {{senderName:string, localArea:string, portfolioUrl:string, calendarUrl:string}}
 */
export function getOutreachProfile() {
  loadEnv();
  return {
    senderName: (process.env.SENDER_NAME || "").trim(),
    localArea: (process.env.LOCAL_AREA || "").trim(),
    portfolioUrl: (process.env.PORTFOLIO_URL || "").trim(),
    calendarUrl: (process.env.CALENDAR_URL || "").trim(),
  };
}

/**
 * Cloudflare R2 (S3 API) config for mockup hosting (#43).
 * @returns {{accountId:string, accessKeyId:string, secretAccessKey:string, bucket:string, publicBase:string}}
 */
export function getR2Config() {
  loadEnv();
  return {
    accountId: r2Val(process.env.R2_ACCOUNT_ID),
    accessKeyId: r2Val(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: r2Val(process.env.R2_SECRET_ACCESS_KEY),
    bucket: r2Val(process.env.R2_BUCKET),
    publicBase: r2Val(process.env.MOCKUP_PUBLIC_BASE).replace(/\/+$/, ""),
  };
}

function r2Val(v) {
  const s = String(v || "").trim();
  if (!s || /^your-|^<.*>$/i.test(s)) return "";
  return s;
}
