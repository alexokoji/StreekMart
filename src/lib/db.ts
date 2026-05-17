import { PrismaClient } from "@prisma/client";

// Prisma client wrapper.
//
// Local dev → falls back to the SQLite file at `DATABASE_URL` (dev.db).
// Production (Render, Cloud Run, Vercel) → uses the libSQL driver adapter
// to talk to Turso, sourced from TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
//
// On @prisma/client@6 + @prisma/adapter-libsql@6 the adapter is a factory
// that takes the libsql connection config directly. No separate
// createClient call, no `as any` cast — interfaces line up.

function buildClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const log: ("error" | "warn")[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (tursoUrl) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaLibSQL } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
    return new PrismaClient({ adapter, log });
  }

  // Local dev — plain sqlite file at DATABASE_URL.
  return new PrismaClient({ log });
}

// Reuse the Prisma client across hot-reloads in dev so we don't open a new
// connection on every request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? buildClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
