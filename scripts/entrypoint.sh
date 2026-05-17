#!/bin/sh
# Container entrypoint. Decides whether to use Turso (Cloud Run path) or a
# mounted SQLite file (Fly.io / Compute Engine path) based on env, then hands
# off to the standalone Next.js server.

set -e

if [ -n "$TURSO_DATABASE_URL" ]; then
  # Cloud Run / Turso path — no local file to sync; schema is pushed from
  # the developer's laptop or CI via Turso's CLI. Just boot the server.
  echo "[entrypoint] Mode: Turso (libSQL) — TURSO_DATABASE_URL is set"
elif [ -d /data ]; then
  # Fly.io / Compute Engine path — SQLite file on a persistent volume.
  echo "[entrypoint] Mode: Local SQLite on /data"
  export DATABASE_URL="${DATABASE_URL:-file:/data/upclo.db}"
  npx --no-install prisma db push --skip-generate
else
  echo "[entrypoint] No TURSO_DATABASE_URL and no /data volume — refusing to boot."
  echo "             Either set TURSO_DATABASE_URL (Cloud Run / hosted libSQL)"
  echo "             or mount a persistent volume at /data (Fly.io / VM)."
  exit 1
fi

echo "[entrypoint] Starting server on :${PORT:-3000}"
exec "$@"
