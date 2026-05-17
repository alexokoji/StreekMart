// One-shot push: applies .turso/schema.sql to the Turso database whose
// credentials are in the env vars below.
//
// Usage (PowerShell):
//   $env:TURSO_DATABASE_URL = "libsql://streekmart-...turso.io"
//   $env:TURSO_AUTH_TOKEN   = "eyJhbGciOi..."
//   node scripts/push-turso-schema.mjs
//
// Idempotent: every CREATE TABLE includes "IF NOT EXISTS" via the wrapper
// below, so re-running on a populated DB is safe. CREATE INDEX statements
// already work that way in libsql; uniqueness violations are swallowed.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";

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
  console.error(
    "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN. Set them in your shell first.",
  );
  process.exit(1);
}

const sql = readFileSync(".turso/schema.sql", "utf8");

// Prisma's generated SQL uses bare `CREATE TABLE "Foo"` and `CREATE …
// INDEX "bar"`. Turning them into `IF NOT EXISTS` variants makes the
// script safe to re-run after partial failures.
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) =>
    s
      .replace(/^CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ")
      .replace(/^CREATE UNIQUE INDEX\s+/i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/^CREATE INDEX\s+/i, "CREATE INDEX IF NOT EXISTS "),
  );

const client = createClient({ url, authToken });

console.log(`Applying ${statements.length} statements to ${url}…`);
let ok = 0;
let skipped = 0;
for (const stmt of statements) {
  try {
    await client.execute(stmt);
    ok++;
  } catch (err) {
    const msg = String(err);
    // "already exists" + duplicate column = safe to ignore (idempotent re-run).
    if (msg.includes("already exists") || msg.includes("duplicate column")) {
      skipped++;
    } else {
      console.error(`\n✗ Statement failed:\n${stmt}\n${msg}`);
      process.exit(1);
    }
  }
}
console.log(`✓ Done. ${ok} applied, ${skipped} skipped (already present).`);
