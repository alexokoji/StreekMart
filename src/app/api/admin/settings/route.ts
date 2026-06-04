import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { isAdminEditable, listEffectiveSettings, setSetting } from "@/lib/settings";

// GET   /api/admin/settings        â€” list every admin-editable key + value + source.
// PATCH /api/admin/settings        â€” update one or many keys at once.

export async function GET() {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  if ("error" in guard) return guard.error;
  const settings = await listEffectiveSettings();
  // Don't return secrets in plaintext â€” mask everything kind=secret. The
  // admin still sees whether a value is set (length > 0).
  const safe = settings.map((s) => ({
    def: s.def,
    source: s.source,
    value: s.def.kind === "secret" ? (s.value ? "â€¢".repeat(8) : "") : s.value,
    hasValue: !!s.value,
  }));
  return NextResponse.json({ settings: safe });
}

const PatchBody = z.object({
  updates: z
    .array(z.object({ key: z.string().min(1), value: z.string() }))
    .min(1)
    .max(50),
});

export async function PATCH(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SETTINGS);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const results: { key: string; ok: boolean; error?: string }[] = [];
  for (const u of parsed.data.updates) {
    if (!isAdminEditable(u.key)) {
      results.push({ key: u.key, ok: false, error: "Not admin-editable" });
      continue;
    }
    try {
      await setSetting(u.key, u.value, guard.user.id);
      results.push({ key: u.key, ok: true });
    } catch (err) {
      results.push({
        key: u.key,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  return NextResponse.json({ results });
}
