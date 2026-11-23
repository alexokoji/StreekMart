import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { ConfigurableApiAdapter } from "@/lib/suppliers/adapters";
import { checkSupplierUrl, validateApiConfig } from "@/lib/suppliers/apiConfig";

export const maxDuration = 60;

const Body = z.object({
  supplierId: z.string().optional(),
  apiBaseUrl: z.string().trim().max(300),
  // Blank + supplierId → use the stored key.
  apiKey: z.string().trim().max(300).optional(),
  apiConfig: z.record(z.any()).optional(),
});

// POST /api/admin/suppliers/test — dry run against the supplier's catalog
// endpoint using the (possibly unsaved) form values. Fetches ONE page,
// writes nothing, and shows how the first items map, so mapping mistakes
// are caught before a real sync.
export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const urlErr = checkSupplierUrl(d.apiBaseUrl, process.env.NODE_ENV !== "production");
  if (urlErr) return NextResponse.json({ ok: false, error: urlErr });
  const v = validateApiConfig(d.apiConfig);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error });

  let apiKey = d.apiKey || null;
  if (!apiKey && d.supplierId) {
    apiKey = (await prisma.supplier.findUnique({ where: { id: d.supplierId }, select: { apiKey: true } }))?.apiKey ?? null;
  }
  const started = Date.now();
  try {
    const adapter = new ConfigurableApiAdapter({ apiBaseUrl: d.apiBaseUrl, apiKey }, v.config);
    const r = await adapter.fetchCatalog({ maxItems: 25 });
    return NextResponse.json({
      ok: true,
      ms: Date.now() - started,
      count: r.items.length,
      sample: r.items.slice(0, 3),
      skipped: r.skipped.slice(0, 5),
      warnings: [
        r.items.length === 0 ? "No usable items came back — check the items path and field mapping." : null,
        r.items.length > 0 && r.items.every((i) => i.images.length === 0)
          ? "No images found — items can't be published without at least one image."
          : null,
      ].filter(Boolean),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Test failed" });
  }
}
