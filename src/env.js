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
 * Resolve the Anthropic API key, loading .env first.
 * @param {{required?: boolean}} [opts]
 * @returns {string|undefined}
 */
export function getAnthropicKey({ required = false } = {}) {
  loadEnv();
  const key = process.env.ANTHROPIC_API_KEY;
  const missing = !key || key === "your-anthropic-key-here";
  if (missing && required) {
    throw new Error(
      "No Anthropic API key found.\n" +
        "  1. cp .env.example .env\n" +
        "  2. paste your key into .env as ANTHROPIC_API_KEY=...\n" +
        "Then re-run."
    );
  }
  return missing ? undefined : key;
}
