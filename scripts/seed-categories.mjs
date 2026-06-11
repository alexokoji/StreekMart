// Idempotent seed for the Category table.
//
// Reads the legacy CATEGORY_GROUPS from src/lib/enums.ts and upserts every
// entry into the Category table so a fresh DB (dev or prod Turso) always
// has the base list available without an admin having to add them by hand.
//
// Runs from the build pipeline AFTER push-turso-schema.mjs so the table
// exists before we write. Safe to call repeatedly — names are unique.

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|(.*))$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? "";
  }
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.log("[seed-categories] No TURSO_DATABASE_URL — skipping (dev mode uses prisma db seed).");
  process.exit(0);
}

// Hand-copied snapshot of CATEGORY_GROUPS from src/lib/enums.ts. Kept here
// (rather than imported) because this script runs as plain Node before the
// TS files are compiled and we don't want a ts-node dep just for seeding.
// If you add a fabric to enums.ts and want it on prod boot, edit BOTH.
const CATEGORY_GROUPS = {
  Materials: [
    "Ankara", "Lace", "Linen", "Cotton", "Silk", "Denim", "Chiffon",
    "Velvet", "Satin", "Sewing Supplies", "Tailoring Tools",
  ],
  Clothing: [
    "Tops", "Bottoms", "Dresses", "Outerwear", "Native Wear",
    "Activewear", "Loungewear",
  ],
  Accessories: [
    "Shoes", "Bags", "Jewelry", "Watches", "Sunglasses", "Hats",
    "Belts", "Scarves",
  ],
  Beauty: ["Beauty"],
};

const client = createClient({ url, authToken });
let inserted = 0;
let updated = 0;
const now = new Date().toISOString();
const groups = Object.entries(CATEGORY_GROUPS);
for (const [groupName, names] of groups) {
  let order = 0;
  for (const name of names) {
    const kind = groupName === "Materials" ? "MATERIAL" : "PRODUCT";
    const existing = await client.execute({
      sql: "SELECT id FROM Category WHERE name = ?",
      args: [name],
    });
    if (existing.rows.length > 0) {
      await client.execute({
        sql: "UPDATE Category SET groupName = ?, displayOrder = ?, kind = ?, updatedAt = ? WHERE name = ?",
        args: [groupName, order, kind, now, name],
      });
      updated++;
    } else {
      const id = "c" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
      await client.execute({
        sql: "INSERT INTO Category (id, name, groupName, displayOrder, kind, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        args: [id, name, groupName, order, kind, now, now],
      });
      inserted++;
    }
    order += 10;
  }
}
console.log(`[seed-categories] Inserted ${inserted}, updated ${updated}.`);
