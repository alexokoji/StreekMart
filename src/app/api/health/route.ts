import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/health
// Lightweight liveness probe used by Fly.io's http_checks. We do a 1-row
// SELECT to confirm the SQLite file on the volume is reachable too — a dead
// disk should fail the healthcheck so Fly restarts the machine.

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "db unreachable" },
      { status: 503 },
    );
  }
}
