// Admin-editable runtime settings.
//
// Most things that used to be plain env vars can now be overridden in the
// admin panel. `getSetting()` checks the SiteSetting table first and falls
// back to process.env, so existing code that reads `process.env.X` keeps
// working unchanged — just route new reads through `getSetting("X")`.
//
// Not everything is exposed to the admin. JWT_SECRET, DATABASE_URL,
// TURSO_DATABASE_URL, etc. stay env-only because changing them at runtime
// either invalidates every session or breaks the live DB connection.
// SETTINGS_DEFINITIONS below is the whitelist of admin-editable keys.

import { prisma } from "./db";

// A tiny in-process cache so we don't query SiteSetting on every request.
// TTL is short — admin edits show up within ~30 s without a redeploy.
const CACHE: Map<string, { value: string | null; expiresAt: number }> = new Map();
const TTL_MS = 30_000;

export type SettingKind = "text" | "secret" | "number" | "percent" | "url" | "boolean";

export type SettingDefinition = {
  key: string;
  label: string;
  kind: SettingKind;
  group: string;
  help?: string;
  envFallback?: string; // process.env key to read when DB row is absent
};

// Admin-editable settings. Adding a row here exposes it on /admin/settings.
// Use `kind: "secret"` to mask the input + value display.
export const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  // Platform economics
  {
    key: "DELIVERY_PLATFORM_CUT_BPS",
    label: "Platform cut on delivery fees",
    kind: "percent",
    group: "Platform fees",
    help: "Basis points (100 = 1%) the platform takes off every delivery fee before crediting the seller's wallet.",
    envFallback: "DELIVERY_PLATFORM_CUT_BPS",
  },
  {
    key: "PLATFORM_FEE_BPS",
    label: "Platform cut on every sale",
    kind: "percent",
    group: "Platform fees",
    help: "Basis points. 100 = 1%. Applies to every sale before crediting the seller's wallet.",
  },
  {
    key: "WITHDRAWAL_FEE_BPS",
    label: "Withdrawal fee",
    kind: "percent",
    group: "Platform fees",
    help: "Basis points charged on every payout to a seller's bank.",
  },

  // App-wide config
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public app URL",
    kind: "url",
    group: "Site",
    help: "Used by Monnify, Google OAuth callbacks, and shareable URLs.",
    envFallback: "NEXT_PUBLIC_APP_URL",
  },
  {
    key: "FEATURE_SKETCH_3D",
    label: "Enable Sketch Studio 3D mockup",
    kind: "boolean",
    group: "Features",
    envFallback: "FEATURE_SKETCH_3D",
  },

  // Third-party API keys (safe to rotate at runtime — no live connection state).
  { key: "ANTHROPIC_API_KEY",     label: "Anthropic API key",        kind: "secret", group: "AI",         envFallback: "ANTHROPIC_API_KEY" },
  { key: "RESEND_API_KEY",        label: "Resend API key",            kind: "secret", group: "Email",      envFallback: "RESEND_API_KEY" },
  { key: "EMAIL_FROM",            label: "Email From address",        kind: "text",   group: "Email",      envFallback: "EMAIL_FROM" },
  { key: "CLOUDINARY_CLOUD_NAME", label: "Cloudinary cloud name",     kind: "text",   group: "Uploads",    envFallback: "CLOUDINARY_CLOUD_NAME" },
  { key: "CLOUDINARY_API_KEY",    label: "Cloudinary API key",        kind: "secret", group: "Uploads",    envFallback: "CLOUDINARY_API_KEY" },
  { key: "CLOUDINARY_API_SECRET", label: "Cloudinary API secret",     kind: "secret", group: "Uploads",    envFallback: "CLOUDINARY_API_SECRET" },
  { key: "GOOGLE_CLIENT_ID",      label: "Google OAuth client ID",    kind: "secret", group: "Auth",       envFallback: "GOOGLE_CLIENT_ID" },
  { key: "GOOGLE_CLIENT_SECRET",  label: "Google OAuth client secret", kind: "secret", group: "Auth",       envFallback: "GOOGLE_CLIENT_SECRET" },
  { key: "MONNIFY_LIVE",          label: "Monnify live mode (0/1)",   kind: "boolean", group: "Payments",  envFallback: "MONNIFY_LIVE" },
  { key: "MONNIFY_API_KEY",       label: "Monnify API key",           kind: "secret", group: "Payments",   envFallback: "MONNIFY_API_KEY" },
  { key: "MONNIFY_SECRET_KEY",    label: "Monnify secret key",        kind: "secret", group: "Payments",   envFallback: "MONNIFY_SECRET_KEY" },
  { key: "MONNIFY_CONTRACT_CODE", label: "Monnify contract code",     kind: "text",   group: "Payments",   envFallback: "MONNIFY_CONTRACT_CODE" },
  { key: "MONNIFY_WALLET_ID",     label: "Monnify wallet ID",         kind: "text",   group: "Payments",   envFallback: "MONNIFY_WALLET_ID" },
  { key: "MONNIFY_WEBHOOK_HASH",  label: "Monnify webhook hash",      kind: "secret", group: "Payments",   envFallback: "MONNIFY_WEBHOOK_HASH" },
];

export function isAdminEditable(key: string): boolean {
  return SETTINGS_DEFINITIONS.some((s) => s.key === key);
}

// Resolve a setting: SiteSetting row → process.env → null.
// `def` gives the env fallback name when caller doesn't want to pass it
// explicitly — works for the curated whitelist above.
export async function getSetting(key: string): Promise<string | null> {
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await prisma.siteSetting.findUnique({ where: { key } });
  const def = SETTINGS_DEFINITIONS.find((d) => d.key === key);
  const fallback = def?.envFallback ? process.env[def.envFallback] : process.env[key];
  const value = row?.value ?? fallback ?? null;
  CACHE.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function getSettingNumber(key: string, defaultValue: number): Promise<number> {
  const raw = await getSetting(key);
  if (raw == null) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

export async function getSettingBool(key: string, defaultValue = false): Promise<boolean> {
  const raw = await getSetting(key);
  if (raw == null) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

// Admin write — invalidates the cache for this key immediately so the
// admin sees their change reflected without waiting on the TTL.
export async function setSetting(key: string, value: string, adminId: string): Promise<void> {
  if (!isAdminEditable(key)) {
    throw new Error(`Setting "${key}" is not admin-editable.`);
  }
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, updatedBy: adminId },
    update: { value, updatedBy: adminId },
  });
  CACHE.delete(key);
}

// Bulk read — used by the admin UI to populate the settings page.
// Effective value is what callers would actually receive (DB row OR env
// fallback OR empty); source tells the admin where it came from.
export async function listEffectiveSettings(): Promise<
  { def: SettingDefinition; value: string; source: "db" | "env" | "unset" }[]
> {
  const rows = await prisma.siteSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value] as const));
  return SETTINGS_DEFINITIONS.map((def) => {
    const dbVal = byKey.get(def.key);
    if (dbVal != null) return { def, value: dbVal, source: "db" as const };
    const envVal = def.envFallback ? process.env[def.envFallback] : process.env[def.key];
    if (envVal) return { def, value: envVal, source: "env" as const };
    return { def, value: "", source: "unset" as const };
  });
}
