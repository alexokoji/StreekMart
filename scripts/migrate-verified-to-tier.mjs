#!/usr/bin/env node
// One-shot data fix: existing sellerVerified=true / designerVerified=true
// users get auto-promoted to the new Tier 2 ("blue check"). Sellers also
// need a default PICKUP address for Tier 2 under the new rules — if they
// lack one, this script still grants Tier 2 (grandfathering them in) and
// the next `recomputeSellerTier` call will keep them there unless an admin
// explicitly downgrades. Designers don't have a pickup requirement.
//
// Usage:
//   node scripts/migrate-verified-to-tier.mjs            # dry-run
//   node scripts/migrate-verified-to-tier.mjs --apply    # mutate

import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Load .env so TURSO_* vars are available when run locally pointed at prod.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|(.*))$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? "";
  }
}

async function buildClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl) {
    const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
    console.log(`(using Turso adapter: ${tursoUrl})`);
    return new PrismaClient({ adapter });
  }
  console.log("(using local sqlite via DATABASE_URL)");
  return new PrismaClient();
}

const prisma = await buildClient();
const MARKER_KEY = "tier_migration_applied_at";
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

async function main() {
  const marker = await prisma.siteSetting.findUnique({ where: { key: MARKER_KEY } });
  if (marker && apply && !force) {
    console.log(`✖ Migration already applied at ${marker.value}. Use --force to re-run.`);
    process.exit(1);
  }

  const sellersToBump = await prisma.user.count({
    where: { sellerVerified: true, sellerTier: { lt: 2 } },
  });
  const designersToBump = await prisma.user.count({
    where: { designerVerified: true, designerTier: { lt: 2 } },
  });

  console.log(`\n${apply ? "▶ APPLY" : "○ DRY-RUN"}`);
  console.log(`Sellers with sellerVerified=true and sellerTier<2:   ${sellersToBump}`);
  console.log(`Designers with designerVerified=true and designerTier<2: ${designersToBump}`);

  if (!apply) {
    console.log("\n○ Re-run with --apply to commit.");
    return;
  }

  const r1 = await prisma.user.updateMany({
    where: { sellerVerified: true, sellerTier: { lt: 2 } },
    data: { sellerTier: 2 },
  });
  const r2 = await prisma.user.updateMany({
    where: { designerVerified: true, designerTier: { lt: 2 } },
    data: { designerTier: 2 },
  });
  await prisma.siteSetting.upsert({
    where: { key: MARKER_KEY },
    update: { value: new Date().toISOString() },
    create: { key: MARKER_KEY, value: new Date().toISOString() },
  });
  console.log(`\n✓ Promoted ${r1.count} seller(s) and ${r2.count} designer(s) to Tier 2.`);
}

main()
  .catch((e) => {
    console.error("✖", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
