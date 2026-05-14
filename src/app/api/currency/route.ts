import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { COOKIE_NAME, CURRENCIES } from "@/lib/currency";
import { getServerCurrencyContext } from "@/lib/currencyServer";

// GET /api/currency  → returns the resolved currency context for the request
//                      (handy for clients that want to re-confirm without
//                      re-rendering the whole tree).
// POST /api/currency { code } → persists the user's currency preference in
//                      the cookie. The cookie is read by getServerCurrencyContext
//                      on the next request so server-side prices stay in sync.

export async function GET() {
  const ctx = await getServerCurrencyContext();
  return NextResponse.json({ ctx });
}

const Body = z.object({
  code: z.enum(CURRENCIES.map((c) => c.code) as [string, ...string[]]),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 });
  }
  cookies().set(COOKIE_NAME, parsed.data.code, {
    httpOnly: false, // intentional — the selector reads this client-side too
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, code: parsed.data.code });
}
