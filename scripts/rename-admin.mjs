// One-shot: rename the demo admin from @upclo.dev to @streekmart.online.
// Preserves every other row in the DB — much safer than re-seeding once
// you've started capturing real signups / orders.
//
// Usage:
//   node scripts/rename-admin.mjs
//
// Auto-loads TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from .env, matching
// the other scripts/* helpers.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";

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

// Find by current email or slug — handles both an already-migrated account
// and a stale seed.
const lookup = await client.execute({
  sql: `SELECT id, email, slug, name FROM User
        WHERE email = ? OR slug = ?
        LIMIT 1`,
  args: ["admin@upclo.dev", "upclo-admin"],
});

if (lookup.rows.length === 0) {
  console.log("No legacy admin row found — nothing to rename.");
  process.exit(0);
}

const row = lookup.rows[0];
console.log("Found:", row);

await client.execute({
  sql: `UPDATE User
        SET email = ?, slug = ?, name = ?
        WHERE id = ?`,
  args: [
    "admin@streekmart.online",
    "streekmart-admin",
    "StreekMart Admin",
    row.id,
  ],
});

console.log("✓ Admin renamed. Log in with:");
console.log("  Email: admin@streekmart.online");
console.log("  Password: (unchanged from before)");
