import { PrismaClient } from "@prisma/client";

// Prisma client wrapper.
//
// Local dev → falls back to the SQLite file at `DATABASE_URL` (dev.db).
// Production (Cloud Run, Vercel, etc.) → uses the libSQL driver adapter to
// talk to Turso, sourced from TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
//
// We lazy-require the adapter packages so devs without Turso credentials
// don't pay the import cost in `npm run dev`.

function buildClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const log: ("error" | "warn")[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (tursoUrl) {
    // libSQL adapter for Turso — production path. We construct the libsql
    // client first and hand it to the Prisma adapter (v5-compatible API).
    //
    // The `as any` cast is a known minor-version interface drift between
    // @prisma/adapter-libsql@5.4.3 and @prisma/client@5.22.0 — the runtime
    // contract holds but the types declare an extra property. Removable
    // when we bump to Prisma 6 (which moves driverAdapters out of preview
    // and unifies the interface).
    //
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaLibSQL } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
    const adapter = new PrismaLibSQL(libsql);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter: adapter as any, log });
  }

  // Local dev — plain sqlite file at DATABASE_URL.
  return new PrismaClient({ log });
}

// Reuse the Prisma client across hot-reloads in dev so we don't open a new
// connection on every request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? buildClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
