# syntax=docker/dockerfile:1.7

# Multi-stage Next.js build for Cloud Run / Fly.io.
#
# Works for both targets:
#   - Cloud Run: DB lives in Turso (env TURSO_DATABASE_URL set → src/lib/db.ts
#     routes Prisma through the libSQL adapter; no filesystem dependency).
#   - Fly.io: DB lives on a mounted volume; the entrypoint script handles
#     `prisma db push` against /data/upclo.db before booting.
#
# The runtime entrypoint script decides which mode to run in based on env.

ARG NODE_VERSION=20-alpine

# ---------- 1) deps ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
# .npmrc carries `legacy-peer-deps=true` to satisfy
# @prisma/adapter-libsql@5.4.3's stale peer range for @libsql/client. The
# explicit flag on `npm ci` is belt-and-suspenders for any environment that
# doesn't read .npmrc (e.g. some buildpacks).
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# ---------- 2) build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Defensive: Next.js doesn't require a public/ dir but our runner stage
# unconditionally copies it. If the repo doesn't ship one (no favicons,
# robots.txt, etc.), make sure an empty one exists so the COPY step in
# the runner stage doesn't fail with "not found".
RUN mkdir -p public

# Generate the Prisma client (uses the local sqlite datasource for codegen;
# at runtime the libSQL adapter takes over when TURSO_DATABASE_URL is set).
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# Build-time-only DB: Next.js pre-renders some API/page routes during
# `next build`. Those routes call Prisma, so we point Prisma at a throwaway
# SQLite file and push the schema to it before building. The runtime libSQL
# adapter (configured via TURSO_DATABASE_URL) takes over before any
# production request touches Prisma.
ENV DATABASE_URL="file:/tmp/build-placeholder.db"
RUN npx prisma db push --skip-generate --accept-data-loss && npm run build

# ---------- 3) runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma schema + generated client for runtime engine resolution.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

COPY --chown=nextjs:nodejs scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
# Strip Windows CRLF if the file was authored on Windows — otherwise the
# shebang reads as `#!/bin/sh\r` and the container exits silently with
# "no such file or directory" on /bin/sh.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
