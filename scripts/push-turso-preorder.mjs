// One-off: apply the additive schema changes for seller-preorder support
// directly to the Turso database. `prisma db push` can't target a libsql://
// URL (the datasource provider is pinned to "sqlite" + file: for local dev;
// Turso is only reached at runtime via the driver adapter, see src/lib/db.ts).
// These are pure additions (new nullable/defaulted columns) — nothing is
// dropped or altered, so existing rows/queries are unaffected.
import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error("TURSO_DATABASE_URL not set");

const client = createClient({ url, authToken });

const statements = [
  `ALTER TABLE "Product" ADD COLUMN "preorderEnabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Product" ADD COLUMN "preorderPriceCents" INTEGER`,
  `ALTER TABLE "Product" ADD COLUMN "preorderLeadDays" INTEGER`,
  `ALTER TABLE "Preorder" ADD COLUMN "productId" TEXT`,
];

for (const sql of statements) {
  try {
    await client.execute(sql);
    console.log("OK:", sql);
  } catch (err) {
    if (String(err.message || err).includes("duplicate column name")) {
      console.log("SKIP (already exists):", sql);
    } else {
      throw err;
    }
  }
}
console.log("Done.");
