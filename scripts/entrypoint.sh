#!/bin/sh
# Container entrypoint. Decides whether to use Turso (Render / Cloud Run path)
# or a mounted SQLite file (Fly.io / Compute Engine path), syncs the schema,
# then hands off to the standalone Next.js server.

set -e

if [ -n "$TURSO_DATABASE_URL" ]; then
  # Render / Cloud Run / Turso path. Schema push is idempotent — the script
  # wraps each CREATE in `IF NOT EXISTS`, so it's a no-op when the DB is
  # already in sync. We don't `set -e` around the push because a transient
  # network blip during an idempotent op shouldn't kill the boot.
  echo "[entrypoint] Mode: Turso (libSQL) — TURSO_DATABASE_URL is set"
  if [ -f ./.turso/schema.sql ] && [ -f ./scripts/push-turso-schema.mjs ]; then
    echo "[entrypoint] Syncing Prisma schema → Turso (idempotent)…"
    if ! node ./scripts/push-turso-schema.mjs; then
      echo "[entrypoint] WARNING: schema push hit an error. Booting anyway —"
      echo "             requests against missing tables will 500 until this resolves."
    fi
  else
    echo "[entrypoint] WARNING: .turso/schema.sql or push script missing. Skipping sync."
  fi
elif [ -d /data ]; then
  # Fly.io / Compute Engine path — SQLite file on a persistent volume.
  echo "[entrypoint] Mode: Local SQLite on /data"
  export DATABASE_URL="${DATABASE_URL:-file:/data/upclo.db}"
  npx --no-install prisma db push --skip-generate
else
  echo "[entrypoint] No TURSO_DATABASE_URL and no /data volume — refusing to boot."
  echo "             Either set TURSO_DATABASE_URL (Render / Cloud Run / hosted libSQL)"
  echo "             or mount a persistent volume at /data (Fly.io / VM)."
  exit 1
fi

echo "[entrypoint] Starting server on :${PORT:-3000}"
exec "$@"
