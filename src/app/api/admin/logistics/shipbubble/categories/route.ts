import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { ShipbubbleService } from "@/services/logistics/shipbubble.service";

/**
 * GET /api/admin/logistics/shipbubble/categories
 *
 * Lists the package categories Shipbubble accepts for your account. Use this
 * to pick a stable category_id and pin it via SHIPBUBBLE_DEFAULT_CATEGORY_ID,
 * which skips the auto-fetch in production.
 */
export async function GET() {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  try {
    const service = new ShipbubbleService();
    const categories = await service.fetchCategories();
    return NextResponse.json({ ok: true, categories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch categories" },
      { status: 502 },
    );
  }
}
