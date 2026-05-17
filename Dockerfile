# syntax=docker/dockerfile:1.7

# Multi-stage Next.js build for Render / Cloud Run / Fly.io.
#
# Base: node:20-slim (Debian-bookworm).
#   We tried node:20-alpine first, but the libsql native binding's
#   linux-x64-musl variant has a glibc `fcntl64` symbol baked in that
#   musl can't resolve — container crashes with ERR_DLOPEN_FAILED at
#   first request. Debian-slim ships glibc and the linux-x64-gnu
#   binary works out of the box. Image goes from ~150 MB to ~210 MB,
#   worth it for native-module reliability.
#
# Works for both targets:
#   - Render / Cloud Run: DB lives in Turso (env TURSO_DATABASE_URL set →
#     src/lib/db.ts routes Prisma through the libSQL adapter; no
#     filesystem dependency).
#   - Fly.io: DB lives on a mounted volume; the entrypoint script handles
#     `prisma db push` against /data/upclo.db before booting.

ARG NODE_VERSION=20-slim

# ---------- 1) deps ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# openssl + ca-certificates are needed by Prisma's query engine and the
# libsql client respectively. Debian's apt is verbose so we silence + clean.
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# .npmrc carries `legacy-peer-deps=true`. Belt-and-suspenders flag on
# `npm ci` for environments that don't honour npmrc.
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# ---------- 2) build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Defensive: Next.js doesn't require a public/ dir but our runner stage
# unconditionally copies it. Make sure an empty one exists.
RUN mkdir -p public

# Generate the Prisma client (uses the local sqlite datasource for codegen;
# at runtime the libSQL adapter takes over when TURSO_DATABASE_URL is set).
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# Build-time-only DB. Next.js pre-renders some API routes during
# `next build` and Prisma needs a connectable SQLite file. The runtime
# libSQL adapter (configured via TURSO_DATABASE_URL) takes over before
# any production request touches Prisma.
ENV DATABASE_URL="file:/tmp/build-placeholder.db"
RUN npx prisma db push --skip-generate --accept-data-loss && npm run build

# ---------- 3) runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Non-root user. Debian's adduser syntax differs slightly from Alpine's —
# both `--system` and `--no-create-home` are honoured.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma schema + generated client for runtime engine resolution.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Explicit copy of the libsql native packages into the standalone
# node_modules. Next.js's standalone tracer often misses the
# platform-specific binary subpackages (@libsql/linux-x64-gnu etc.)
# because they're loaded via dynamic require.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/libsql ./node_modules/libsql
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/adapter-libsql ./node_modules/@prisma/adapter-libsql

COPY --chown=nextjs:nodejs scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
# Strip Windows CRLF if authored on Windows — otherwise the shebang reads
# as `#!/bin/sh\r` and the container exits silently with "no such file".
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
