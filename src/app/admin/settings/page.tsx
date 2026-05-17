import { requireAdmin } from "@/lib/auth";
import { listEffectiveSettings } from "@/lib/settings";
import { SettingsEditor } from "./SettingsEditor";

// /admin/settings — runtime-editable config.
//
// Each row maps to a key in SETTINGS_DEFINITIONS (src/lib/settings.ts). DB
// values override env vars; secrets are masked in the response from
// /api/admin/settings so they never leak to the client even on a refresh.
export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await listEffectiveSettings();

  // Group by definition.group so the UI shows clean sections.
  const grouped = new Map<string, typeof settings>();
  for (const s of settings) {
    const arr = grouped.get(s.def.group) ?? [];
    arr.push(s);
    grouped.set(s.def.group, arr);
  }

  // Server-side render the initial values (with secret masking) so the
  // page works even before the client hydrates.
  const initial = settings.map((s) => ({
    def: s.def,
    source: s.source,
    value: s.def.kind === "secret" ? (s.value ? "•".repeat(8) : "") : s.value,
    hasValue: !!s.value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Site settings</h1>
        <p className="text-sm text-ink-600">
          Edit runtime values without redeploying. Changes are live within ~30 seconds.
          Secrets are masked in the UI — paste a new value to overwrite. Anything not
          listed here (JWT_SECRET, DATABASE_URL, TURSO_*) stays env-only.
        </p>
      </div>
      <SettingsEditor initial={initial} groups={Array.from(grouped.keys())} />
    </div>
  );
}
