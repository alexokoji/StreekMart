// Diagnostic: connects to Turso and reports what's there.
//
// Usage:
//   $env:TURSO_DATABASE_URL = "..."
//   $env:TURSO_AUTH_TOKEN   = "..."
//   node scripts/check-turso.mjs

import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";

// Tiny .env loader so plain `node` picks up TURSO_* like Next.js does.
// Only sets keys that aren't already in process.env (env wins over file).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|(.*))$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? "";
  }
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN.");
  process.exit(1);
}

const client = createClient({ url, authToken });

console.log(`Connected to: ${url}`);
console.log();

// 1) List all tables.
const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
);
console.log(`Tables (${tables.rows.length}):`);
for (const row of tables.rows) {
  console.log(`  - ${row.name}`);
}
console.log();

// 2) Count rows in the most important tables (if they exist).
const KEY_TABLES = ["User", "Product", "Order", "Cart", "DeliveryCity", "SiteSetting"];
for (const t of KEY_TABLES) {
  try {
    const r = await client.execute(`SELECT COUNT(*) AS n FROM "${t}"`);
    console.log(`  ${t}: ${r.rows[0].n} rows`);
  } catch (err) {
    console.log(`  ${t}: MISSING (${String(err).split("\n")[0]})`);
  }
}
