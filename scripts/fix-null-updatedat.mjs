#!/usr/bin/env node
// One-shot data fix: backfill NULL `updatedAt` values across every table
// whose model declares `@updatedAt`. Required after a push-turso-schema
// run added an updatedAt column to an existing table (the script strips
// NOT NULL when there's no DEFAULT, so existing rows land with NULL).
//
// Prisma 6 hard-rejects those rows on read with P2032
// "expected non-nullable DateTime, found null", which is exactly the
// /messages page error we're chasing here.
//
// Backfill rule: where the table has a `createdAt`, use that. Otherwise
// fall back to CURRENT_TIMESTAMP. Both produce a value Prisma accepts and
// preserve the intent ("the row hasn't been touched since it was made").
//
// Usage:
//   node scripts/fix-null-updatedat.mjs                # dry-run, count nulls per table
//   node scripts/fix-null-updatedat.mjs --apply        # commit the backfill

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

const apply = process.argv.includes("--apply");

// Tables with @updatedAt in prisma/schema.prisma. Keep this hand-curated
// rather than parsing the schema again — a typo here just means we skip
// a table; we won't accidentally wipe anything.
const TABLES = [
  "User",
  "Address",
  "Wallet",
  "PayoutRequest",
  "Manager",
  "Product",
  "Post",
  "Cart",
  "Order",
  "Shipment",
  "SellerReview",
  "Chat",
  "Message",
  "DeliveryCity",
  "SiteSetting",
  "ShipbubbleAddressCode",
];

const client = createClient({ url, authToken });
console.log(`Connected to ${url}`);
console.log(`${apply ? "▶ APPLY" : "○ DRY-RUN"} — checking ${TABLES.length} tables\n`);

let touched = 0;
for (const table of TABLES) {
  let nullCount = 0;
  try {
    const r = await client.execute(
      `SELECT COUNT(*) AS n FROM "${table}" WHERE "updatedAt" IS NULL`,
    );
    nullCount = Number(r.rows[0]?.n ?? 0);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("no such table") || msg.includes("no such column")) {
      console.log(`  – ${table}: (skipped — table or column missing)`);
      continue;
    }
    console.error(`  ✗ ${table}: ${msg}`);
    continue;
  }

  if (nullCount === 0) {
    console.log(`  ✓ ${table}: 0 rows need backfill`);
    continue;
  }

  // Does this table have a createdAt column we can use as the seed?
  let hasCreatedAt = false;
  try {
    const r = await client.execute(`PRAGMA table_info("${table}")`);
    hasCreatedAt = r.rows.some((row) => String(row.name) === "createdAt");
  } catch {
    /* table missing — already handled above */
  }
  const seed = hasCreatedAt ? `COALESCE("createdAt", CURRENT_TIMESTAMP)` : `CURRENT_TIMESTAMP`;

  console.log(`  → ${table}: ${nullCount} row(s) to backfill (seed: ${seed})`);

  if (apply) {
    try {
      await client.execute(
        `UPDATE "${table}" SET "updatedAt" = ${seed} WHERE "updatedAt" IS NULL`,
      );
      touched += nullCount;
    } catch (err) {
      console.error(`  ✗ ${table}: ${err}`);
    }
  }
}

if (apply) {
  console.log(`\n✓ Done. Updated approximately ${touched} row(s) across all tables.`);
} else {
  console.log("\n○ Dry-run only. Re-run with --apply to commit.");
}
