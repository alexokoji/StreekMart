#!/usr/bin/env bash
# One-shot Cloud Run + Turso bootstrap for StreekMart.
#
# Run this on a Unix-y shell (Git Bash on Windows works) AFTER:
#   1. `gcloud auth login` and `gcloud config set project <PROJECT_ID>`
#   2. `turso auth login`
#
# It will:
#   - Enable the Cloud Run / Artifact Registry / Secret Manager APIs.
#   - Create the Artifact Registry repo for the image.
#   - Create the Turso database + token, then push the Prisma schema to it.
#   - Create every required Secret Manager secret (you'll be prompted).
#   - Trigger the first Cloud Build deploy.
#
# Re-running is safe — every create is `|| true`d so the script can be
# resumed after a prompt error.

set -euo pipefail

REGION="${REGION:-us-central1}"
REPO="${REPO:-streekmart}"
SERVICE="${SERVICE:-streekmart}"
TURSO_DB="${TURSO_DB:-streekmart}"

echo "→ Region:     $REGION"
echo "→ Repo:       $REPO"
echo "→ Service:    $SERVICE"
echo "→ Turso DB:   $TURSO_DB"
echo

# 1) APIs ----------------------------------------------------------------
echo "▶ Enabling required GCP APIs…"
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# 2) Artifact Registry --------------------------------------------------
echo "▶ Creating Artifact Registry repo (skip if exists)…"
gcloud artifacts repositories create "$REPO" \
  --location="$REGION" \
  --repository-format=docker \
  --description="StreekMart container images" \
  2>/dev/null || true

# 3) Turso database -----------------------------------------------------
echo "▶ Creating Turso DB (skip if exists)…"
turso db create "$TURSO_DB" 2>/dev/null || true
TURSO_URL=$(turso db show "$TURSO_DB" --url)
echo "  TURSO_DATABASE_URL = $TURSO_URL"

echo "▶ Minting a fresh Turso auth token…"
TURSO_TOKEN=$(turso db tokens create "$TURSO_DB")

# 4) Push the Prisma schema to Turso ------------------------------------
# We generate raw SQL from the schema and apply it via the Turso shell.
# That's the supported workflow — `prisma db push` doesn't speak libsql
# directly in Prisma 5.
echo "▶ Pushing schema to Turso…"
mkdir -p .turso
npx --no-install prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > .turso/schema.sql
cat .turso/schema.sql | turso db shell "$TURSO_DB"

# 5) Secrets ------------------------------------------------------------
echo "▶ Creating / updating Secret Manager entries…"

put_secret () {
  # $1 = secret name, $2 = value (passed via stdin to avoid shell history)
  local name="$1"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic
  fi
  printf "%s" "$2" | gcloud secrets versions add "$name" --data-file=-
}

prompt_secret () {
  # Prompts the user (hidden input) and stores via put_secret.
  local name="$1"
  local label="$2"
  local value
  read -r -s -p "  $label: " value
  echo
  put_secret "$name" "$value"
}

# Auto-set ones we already know.
put_secret turso-database-url "$TURSO_URL"
put_secret turso-auth-token   "$TURSO_TOKEN"

# Random JWT secret if you don't have one yet.
JWT_VAL=$(openssl rand -hex 32)
put_secret jwt-secret "$JWT_VAL"

# Hand-entered secrets.
prompt_secret anthropic-api-key       "ANTHROPIC_API_KEY"
prompt_secret cloudinary-cloud-name   "CLOUDINARY_CLOUD_NAME"
prompt_secret cloudinary-api-key      "CLOUDINARY_API_KEY"
prompt_secret cloudinary-api-secret   "CLOUDINARY_API_SECRET"
prompt_secret google-client-id        "GOOGLE_CLIENT_ID    (Enter for none)"
prompt_secret google-client-secret    "GOOGLE_CLIENT_SECRET (Enter for none)"
prompt_secret monnify-api-key         "MONNIFY_API_KEY      (Enter for stub mode)"
prompt_secret monnify-secret-key      "MONNIFY_SECRET_KEY   (Enter for stub mode)"
prompt_secret monnify-contract-code   "MONNIFY_CONTRACT_CODE"
prompt_secret monnify-wallet-id       "MONNIFY_WALLET_ID"
prompt_secret monnify-webhook-hash    "MONNIFY_WEBHOOK_HASH"
prompt_secret app-url                 "NEXT_PUBLIC_APP_URL (e.g. https://streekmart-xxx.run.app)"

# 6) First deploy -------------------------------------------------------
echo "▶ Submitting the first Cloud Build → Cloud Run deploy…"
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_REPO="$REPO",_SERVICE="$SERVICE"

echo
echo "✓ Done. Get the live URL with:"
echo "    gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)'"
