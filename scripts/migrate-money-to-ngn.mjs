#!/usr/bin/env node
// One-shot data fix: convert every money column that was historically stored
// in USD (or USD-cents) into NGN (or NGN-kobo). Multiplies each value by the
// USD→NGN exchange rate.
//
// Usage:
//   node scripts/migrate-money-to-ngn.mjs                # dry-run, default rate 1500
//   node scripts/migrate-money-to-ngn.mjs --rate=1372    # dry-run with a custom rate
//   node scripts/migrate-money-to-ngn.mjs --apply        # actually mutate, default rate
//   node scripts/migrate-money-to-ngn.mjs --apply --rate=1372
//   node scripts/migrate-money-to-ngn.mjs --apply --force  # ignore the "already applied" marker
//
// Idempotency:
//   On first --apply run the script writes a row into SiteSetting with key
//   `ngn_money_migration_applied_at`. Subsequent runs detect the marker and
//   refuse to re-apply (use --force to override). Always inspect the dry-run
//   output BEFORE applying.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MARKER_KEY = "ngn_money_migration_applied_at";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const rateArg = args.find((a) => a.startsWith("--rate="));
const rate = rateArg ? parseFloat(rateArg.split("=")[1]) : 1500;

if (!Number.isFinite(rate) || rate <= 0) {
  console.error(`✖ invalid --rate value: ${rateArg}`);
  process.exit(1);
}

console.log(
  `\n${apply ? "▶ APPLY MODE" : "○ DRY-RUN MODE"} — using rate ${rate} NGN per USD\n`,
);

// (model, field, kind) tuples. `kind` is just metadata for the report.
//   "float" → currency stored in regular units (USD → NGN)
//   "cents" → currency stored in minor units (USD-cents → NGN-kobo)
// Both are multiplied by the same scalar — value/100 happens at display
// time, so the unit label changes but the multiplier is the same.
//
// Promotion.priceCents is intentionally omitted: its schema comment says it's
// already stored as Monnify-compatible kobo (NGN).
const TARGETS = [
  { model: "product",          field: "price",                        kind: "float", nullable: false },
  { model: "product",          field: "salePrice",                    kind: "float", nullable: true  },
  { model: "order",            field: "totalPrice",                   kind: "float", nullable: false },
  { model: "order",            field: "deliveryFeeCents",             kind: "cents", nullable: false },
  { model: "wallet",           field: "balanceCents",                 kind: "cents", nullable: false },
  { model: "wallet",           field: "heldCents",                    kind: "cents", nullable: false },
  { model: "walletTransaction",field: "amountCents",                  kind: "cents", nullable: false },
  { model: "user",             field: "deliveryWithinCityCents",      kind: "cents", nullable: false },
  { model: "user",             field: "deliveryOutsideCityCents",     kind: "cents", nullable: false },
  { model: "user",             field: "deliveryOutsideCountryCents",  kind: "cents", nullable: false },
  { model: "shipment",         field: "shippingFeeCents",             kind: "cents", nullable: false },
  { model: "shippingRate",     field: "amountCents",                  kind: "cents", nullable: false },
  { model: "deliveryCity",     field: "feeCents",                     kind: "cents", nullable: false },
  { model: "payoutRequest",    field: "amountCents",                  kind: "cents", nullable: false },
];

async function summary(model, field, nullable) {
  // Read all rows once. SQLite + small datasets in dev/staging — fine.
  const rows = await prisma[model].findMany({ select: { id: true, [field]: true } });
  let count = 0;
  let nonZero = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    const v = r[field];
    if (v === null || v === undefined) continue;
    count++;
    if (v !== 0) nonZero++;
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { total: rows.length, count, nonZero, sum, min: nonZero ? min : 0, max: nonZero ? max : 0 };
}

async function applyOne(model, field, nullable) {
  // Round to integer for cents fields, keep precision for floats.
  const tuple = TARGETS.find((t) => t.model === model && t.field === field);
  const isCents = tuple?.kind === "cents";
  // SQLite via Prisma can't do arithmetic UPDATE in a single statement that
  // also rounds, so read → write per row. Datasets are small.
  const rows = await prisma[model].findMany({
    where: nullable ? { [field]: { not: null } } : {},
    select: { id: true, [field]: true },
  });
  let updated = 0;
  for (const row of rows) {
    const v = row[field];
    if (v === null || v === undefined || v === 0) continue;
    const next = isCents ? Math.round(v * rate) : v * rate;
    await prisma[model].update({
      where: { id: row.id },
      data: { [field]: next },
    });
    updated++;
  }
  return updated;
}

async function main() {
  // Marker check (idempotency).
  const marker = await prisma.siteSetting.findUnique({ where: { key: MARKER_KEY } });
  if (marker && apply && !force) {
    console.log(
      `✖ Migration already applied at ${marker.value}. Use --force to run again (dangerous — will multiply values again).`,
    );
    process.exit(1);
  }
  if (marker) {
    console.log(`ℹ Marker present: applied at ${marker.value}\n`);
  }

  // Pre-flight: print the per-field summary.
  console.log("Field                                            total  nonZero      min        max          sum");
  console.log("------------------------------------------------------------------------------------------------");
  for (const t of TARGETS) {
    try {
      const s = await summary(t.model, t.field, t.nullable);
      const tag = `${t.model}.${t.field}`.padEnd(48);
      const row = `${tag} ${String(s.total).padStart(6)} ${String(s.nonZero).padStart(8)}  ${String(s.min).padStart(8)}  ${String(s.max).padStart(9)}  ${String(s.sum).padStart(11)}`;
      console.log(row);
    } catch (e) {
      console.log(`${t.model}.${t.field}  ✖ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log();

  if (!apply) {
    console.log("○ Dry-run only — no changes written. Re-run with --apply to commit.");
    return;
  }

  // Apply.
  console.log("▶ Applying multiplications…");
  let totalUpdated = 0;
  for (const t of TARGETS) {
    try {
      const n = await applyOne(t.model, t.field, t.nullable);
      console.log(`  ${t.model}.${t.field}: updated ${n} row(s)`);
      totalUpdated += n;
    } catch (e) {
      console.log(`  ${t.model}.${t.field}: ✖ ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Write marker.
  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({
    where: { key: MARKER_KEY },
    update: { value: now },
    create: { key: MARKER_KEY, value: now },
  });
  console.log(`\n✓ Done. ${totalUpdated} row(s) updated. Marker set at ${now}.`);
}

main()
  .catch((e) => {
    console.error("\n✖ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
