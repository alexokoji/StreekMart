#!/bin/sh
# Fly.io container entrypoint.
#
# 1. Make sure /data exists (it's the persistent volume mount).
# 2. Apply any pending Prisma schema changes to the SQLite file living there.
#    `db push --accept-data-loss=false` is additive-only — safe on every boot.
# 3. Hand off to whatever CMD the Dockerfile specified (next standalone server).

set -e

if [ ! -d /data ]; then
  echo "[entrypoint] /data not mounted — Fly volume missing?"
  exit 1
fi

# Ensure the SQLite file URL points at the volume.
export DATABASE_URL="${DATABASE_URL:-file:/data/upclo.db}"

echo "[entrypoint] Syncing Prisma schema → ${DATABASE_URL}"
npx --no-install prisma db push --skip-generate

echo "[entrypoint] Starting server on :${PORT:-3000}"
exec "$@"
