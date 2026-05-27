import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchRailPage, fetchSavedIdsFor, isValidRail } from "@/lib/productRails";

/**
 * GET /api/products/list?rail=<key>&offset=<n>&limit=<n>
 *
 * Powers the infinite-scroll grid on every product landing page. Returns
 * the next slice of items plus the subset of those products the current
 * user has saved (so the wishlist heart renders correctly without a second
 * round trip).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rail = url.searchParams.get("rail");
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
  const limit = parseInt(url.searchParams.get("limit") ?? "24", 10) || 24;

  if (!isValidRail(rail)) {
    return NextResponse.json({ error: "Unknown rail" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const { items, hasMore } = await fetchRailPage(rail, { offset, limit });
  const savedIds = await fetchSavedIdsFor(
    user?.id ?? null,
    items.map((i) => i.id),
  );

  return NextResponse.json({ items, savedIds, hasMore });
}
