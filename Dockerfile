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
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- 2) build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client (uses the local sqlite datasource for codegen;
# at runtime the libSQL adapter takes over when TURSO_DATABASE_URL is set).
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

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
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
