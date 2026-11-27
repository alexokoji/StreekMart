import { NextResponse } from "next/server";
import { STORE_COOKIE } from "@/lib/storefront";

// GET /api/store/clear?next=/ — drop the storefront lock and carry on.
// Used when a storefront link points at a seller that no longer exists, so a
// visitor is never stuck behind a dead link. Only same-site paths are honoured.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safe, url.origin));
  res.cookies.set(STORE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
