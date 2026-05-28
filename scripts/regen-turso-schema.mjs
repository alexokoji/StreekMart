#!/usr/bin/env node
// Regenerate .turso/schema.sql from the current prisma/schema.prisma.
//
// Runs as part of the `prebuild` step so the schema SQL the push script
// reads is always in sync with the Prisma model that the deployed code
// queries. Without this regen step, you can ship code that selects a
// column that doesn't exist in the production database — exactly the
// failure mode that drove this script to exist.
//
// The diff target is `--from-empty` because the push script then handles
// merging the resulting "fresh CREATE TABLE" statements into the live DB
// additively (CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN for
// each missing column). We deliberately don't use `--from-prod` because
// that would require credentials at build time on every developer's
// machine; the additive push handles drift just as well.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync(".turso", { recursive: true });

// execSync handles Windows .cmd shims natively (no EINVAL like spawnSync)
// and lets us capture stdout cleanly. The command + args are a fixed
// string with no user input so no escaping concerns.
let sql;
try {
  sql = execSync(
    "npx --no-install prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
} catch (err) {
  console.error("[regen-turso-schema] prisma migrate diff failed.");
  process.exit(typeof err?.status === "number" ? err.status : 1);
}

// Strip any UTF-16 BOM the diff tool might emit on Windows.
if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);

writeFileSync(".turso/schema.sql", sql, { encoding: "utf8" });

const lines = sql.split("\n").length;
console.log(`[regen-turso-schema] Wrote .turso/schema.sql (${lines} lines).`);
