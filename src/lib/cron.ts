// Cron auth helper. Vercel Cron fires GET requests against the path
// configured in vercel.json and signs them with the `CRON_SECRET` env var
// as `Authorization: Bearer <secret>`. We verify that here so a stray
// public request can't trigger an expensive fan-out.
//
// In dev (no CRON_SECRET set) we accept any request — useful for
// manually hitting the endpoint with curl or the browser to test.

import { NextResponse } from "next/server";

export function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — anything goes
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export function cronForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
