import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { syncSupplier } from "@/lib/suppliers/service";

export const maxDuration = 60;

// POST /api/admin/suppliers/[id]/sync — pull the supplier's catalog (API
// suppliers only). Updates cost + stock of known items (and re-prices
// published ones); new items arrive as IMPORTED, never auto-published.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  if ("error" in guard) return guard.error;
  try {
    const r = await syncSupplier(params.id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 502 });
  }
}
