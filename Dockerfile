# syntax=docker/dockerfile:1.7

# Multi-stage Next.js build for Fly.io. Produces a small final image that
# only contains the compiled standalone server + the Prisma client.
#
# Layers are arranged so that lockfile + schema changes invalidate the deps
# layer early, while source-only edits reuse the cached install.

ARG NODE_VERSION=20-alpine

# ---------- 1) deps ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# Prisma's engine binaries on Alpine need libc6-compat.
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

# Generate the Prisma client against the schema BEFORE next build, otherwise
# the build will fail on `import { PrismaClient } from "@prisma/client"`.
RUN npx prisma generate

# Skip Next.js telemetry inside CI builds.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- 3) runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind to 0.0.0.0 so Fly's proxy can reach the server.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Non-root user for runtime. Fly's volume gets chowned to this uid in the
# entrypoint so the SQLite file is writable.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# .next/standalone is a self-contained Node app. We also need the prerendered
# static assets and the public folder.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma needs the schema + the generated client at runtime for migrations
# and the engine. The standalone bundle copies the @prisma/client folder
# automatically; we just bring along the schema so `prisma db push` works.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Entrypoint runs `prisma db push` against the volume-mounted SQLite file
# on every boot — safe (idempotent additive migrations) and means new
# columns appear without a manual step.
COPY --chown=nextjs:nodejs scripts/fly-entrypoint.sh /usr/local/bin/fly-entrypoint.sh
RUN chmod +x /usr/local/bin/fly-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/fly-entrypoint.sh"]
CMD ["node", "server.js"]
