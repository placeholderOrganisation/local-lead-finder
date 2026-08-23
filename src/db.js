// Lazy MongoDB connection singleton shared by every store/worker/server module.
// One MongoClient per process — do not open a client per call.

import { MongoClient } from "mongodb";
import { getMongoUri } from "./env.js";

let client;
let db;
let indexesReady = false;

/** Connect (once) and cache the client + db handle. */
async function connect() {
  if (db) return db;
  const uri = getMongoUri({ required: true });
  const dbName = process.env.MONGODB_DB || "leadfinder";
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

/**
 * Lazy-connect and return a Collection. Reuses the single cached client.
 * @param {string} name
 */
export async function getColl(name) {
  const database = await connect();
  return database.collection(name);
}

/**
 * Idempotent index setup on the `leads` collection. Safe to call repeatedly.
 * Indexes: status, followUpDate, priority. (_id is unique in Mongo already.)
 */
export async function ensureIndexes() {
  const leads = await getColl("leads");
  await leads.createIndexes([
    { key: { status: 1 }, name: "status_1" },
    { key: { followUpDate: 1 }, name: "followUpDate_1" },
    { key: { priority: -1 }, name: "priority_-1" },
  ]);
  indexesReady = true;
  return indexesReady;
}

/** Close the client so CLI one-shot processes can exit cleanly. */
export async function close() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
    indexesReady = false;
  }
}
