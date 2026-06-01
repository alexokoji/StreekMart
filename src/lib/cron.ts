// Cron auth helper. The two cron endpoints under /api/cron/* are fired by
// GitHub Actions on a schedule (see .github/workflows/cron-*.yml) — we
// dropped Vercel Cron because the Hobby plan can't run sub-daily schedules.
// GitHub Actions sets `Authorization: Bearer <CRON_SECRET>` from the repo
// secret of the same name; we verify that here so a stray public request
// can't trigger an expensive fan-out.
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
