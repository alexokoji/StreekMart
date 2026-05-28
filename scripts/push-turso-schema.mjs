// Idempotent schema push for Turso (libSQL).
//
// Two passes:
//   1. CREATE TABLE IF NOT EXISTS for every table in .turso/schema.sql.
//      Creates the table if missing; no-op if it already exists.
//   2. ALTER TABLE ... ADD COLUMN for every column declared in the Prisma
//      schema but missing on the live table. This is the difference from
//      bare "CREATE IF NOT EXISTS" — without it, additive schema changes
//      (a new field on an existing model) never reach the live DB.
//
// We deliberately don't try to handle column drops or type changes. SQLite
// supports DROP/RENAME COLUMN but it's risky to automate; if you need
// either, do it via a manual `turso db shell` session.
//
// Auto-loads TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from .env. Runs at boot
// from scripts/entrypoint.sh inside the container, so every Render deploy
// brings Turso into sync with the schema in the image.

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
  // Soft-skip so a build environment without prod credentials (e.g. a
  // preview deploy, a dev machine without secrets) doesn't fail. Production
  // deploys MUST have these env vars; if they're absent there, the missing
  // columns error will surface at runtime and you'll know to fix the env.
  console.warn(
    "[push-turso-schema] Skipping — TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set. " +
      "(Expected on local builds and preview deploys without prod secrets.)",
  );
  process.exit(0);
}

let sql = readFileSync(".turso/schema.sql", "utf8");
// Strip BOM (PowerShell's Set-Content -Encoding utf8 emits one) and any
// stray CRs so the regex parser sees clean ASCII at line starts.
if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
sql = sql.replace(/\r\n/g, "\n");

// Split the schema into statements. Strip Prisma's `-- CreateTable` /
// `-- CreateIndex` comment headers and any blank lines so each statement
// starts with the actual SQL keyword.
const allStatements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((l) => !/^\s*--/.test(l))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

// Partition into CREATE TABLE vs CREATE INDEX vs everything else.
const tableStatements = [];
const indexStatements = [];
for (const stmt of allStatements) {
  if (/^CREATE TABLE\b/i.test(stmt)) tableStatements.push(stmt);
  else if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(stmt)) indexStatements.push(stmt);
  // Anything else (CREATE TRIGGER, PRAGMA, etc.) is unhandled — Prisma
  // doesn't emit these for the SQLite target so we ignore silently.
}

const client = createClient({ url, authToken });

console.log(`Connected to ${url}`);
console.log(`Found ${tableStatements.length} tables, ${indexStatements.length} indexes in schema.sql`);

let tablesCreated = 0;
let columnsAdded = 0;
let tablesSkipped = 0;

for (const raw of tableStatements) {
  const parsed = parseCreateTable(raw);
  if (!parsed) {
    console.warn(`  ⚠ Couldn't parse: ${raw.slice(0, 80)}…`);
    continue;
  }

  // 1) CREATE TABLE IF NOT EXISTS (no-op when present).
  const ifNotExists = raw.replace(
    /^CREATE TABLE\s+/i,
    "CREATE TABLE IF NOT EXISTS ",
  );
  await client.execute(ifNotExists);

  // 2) Pull the live column list via PRAGMA.
  const pragma = await client.execute(`PRAGMA table_info("${parsed.tableName}")`);
  // Newly-created tables that didn't exist a moment ago will already match
  // the schema we just CREATE'd — so the loop below adds nothing.
  if (pragma.rows.length === 0) {
    // Table somehow doesn't exist after the CREATE — could be a permissions
    // issue. Skip and log.
    console.warn(`  ⚠ ${parsed.tableName}: PRAGMA returned 0 rows after CREATE`);
    continue;
  }
  const existingCols = new Set(pragma.rows.map((r) => String(r.name)));

  // 3) ADD any column declared in schema but missing on the live table.
  let added = 0;
  for (const col of parsed.columns) {
    if (existingCols.has(col.name)) continue;
    // ALTER TABLE in SQLite requires the column definition to be self-
    // contained: name, type, [NOT NULL DEFAULT ...]. We stripped PRIMARY KEY
    // already (you can't ADD a primary-key column to an existing table) and
    // we leave NOT NULL only when there's a DEFAULT, otherwise SQLite
    // rejects the ALTER because existing rows would be NULL.
    const safeDef = makeAlterDefinition(col.definition);
    const alter = `ALTER TABLE "${parsed.tableName}" ADD COLUMN "${col.name}" ${safeDef}`;
    try {
      await client.execute(alter);
      added++;
      columnsAdded++;
      console.log(`  + ${parsed.tableName}.${col.name}  (${safeDef})`);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("duplicate column")) continue; // benign race
      console.error(`  ✗ ${parsed.tableName}.${col.name}: ${msg}`);
      throw err;
    }
  }
  if (added > 0) {
    console.log(`  ✓ ${parsed.tableName}: ${added} column(s) added`);
  } else if (existingCols.size === parsed.columns.length) {
    tablesSkipped++;
  } else {
    tablesCreated++;
  }
}

// 4) Apply every index. CREATE INDEX IF NOT EXISTS is idempotent.
for (const raw of indexStatements) {
  const stmt = raw
    .replace(/^CREATE UNIQUE INDEX\s+/i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/^CREATE INDEX\s+/i, "CREATE INDEX IF NOT EXISTS ");
  try {
    await client.execute(stmt);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("already exists")) continue;
    console.error(`  ✗ index: ${msg}`);
    throw err;
  }
}

console.log(
  `\n✓ Done. ${columnsAdded} column(s) added across existing tables. ${tablesSkipped} table(s) already in sync.`,
);

// ----- parsing helpers -----

/**
 * Parse a Prisma-emitted `CREATE TABLE "Foo" ( … );` statement into a
 * structured form we can diff against PRAGMA table_info.
 */
function parseCreateTable(sql) {
  const m = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"\s*\(([\s\S]*)\)\s*$/i);
  if (!m) return null;
  const [, tableName, body] = m;
  const parts = splitTopLevel(body);
  const columns = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^(CONSTRAINT|FOREIGN KEY|PRIMARY KEY|UNIQUE)\b/i.test(trimmed)) continue;
    const colMatch = trimmed.match(/^"([^"]+)"\s+(.+)$/);
    if (!colMatch) continue;
    const [, name, definition] = colMatch;
    columns.push({ name, definition: definition.trim() });
  }
  return { tableName, columns };
}

/** Split on commas that are at depth 0 — keeps "REFERENCES Foo("id")" intact. */
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/**
 * Sanitise a Prisma column definition for use in `ALTER TABLE ADD COLUMN`.
 *   - Drops `PRIMARY KEY` (forbidden by SQLite for additive ALTER).
 *   - DATETIME NOT NULL columns without a DEFAULT (typically Prisma's
 *     `@updatedAt`) get `DEFAULT CURRENT_TIMESTAMP` added so existing
 *     rows land with a real value instead of NULL. Without this, Prisma
 *     would reject the row on read with P2032 ("expected non-nullable
 *     DateTime, found null") — exactly the crash mode that drove this
 *     workaround to exist.
 *   - For other NOT NULL columns without a DEFAULT, the NOT NULL is
 *     stripped (SQLite refuses to add NOT NULL columns with no default).
 *     The application code is responsible for setting these on next write.
 */
function makeAlterDefinition(definition) {
  let out = definition.replace(/\bPRIMARY KEY\b/gi, "").trim();
  const hasDefault = /\bDEFAULT\b/i.test(out);
  const hasNotNull = /\bNOT NULL\b/i.test(out);
  const isDateTime = /\bDATETIME\b/i.test(out);
  if (hasNotNull && !hasDefault) {
    if (isDateTime) {
      // Backfill with CURRENT_TIMESTAMP so existing rows satisfy NOT NULL
      // and Prisma reads them cleanly. The @updatedAt semantics still hold
      // — Prisma overwrites on the next update — and createdAt-style
      // columns already have their own DEFAULT in the original definition.
      out = `${out} DEFAULT CURRENT_TIMESTAMP`;
    } else {
      // Strip NOT NULL — existing rows have no value to satisfy it.
      out = out.replace(/\bNOT NULL\b/gi, "").trim();
    }
  }
  return out;
}
