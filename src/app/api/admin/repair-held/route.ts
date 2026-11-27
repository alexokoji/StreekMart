import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth";
import { auditHeldFunds } from "@/lib/heldRepair";

// POST /api/admin/repair-held { apply?: boolean }
// Super-admin only (money). Without `apply` it is a dry run that lists the
// wallets whose held balance is out of line; with `apply: true` it corrects
// them. Safe to run repeatedly.
const Body = z.object({ apply: z.boolean().optional() });

export async function POST(req: Request) {
  const guard = await requireApiAdmin(); // no permission arg = full admin only
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const result = await auditHeldFunds(parsed.data.apply === true);
  return NextResponse.json({ ok: true, ...result });
}
