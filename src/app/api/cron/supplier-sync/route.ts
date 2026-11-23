import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizedCron, cronForbidden } from "@/lib/cron";
import { syncSupplier, syncSupplierOrders } from "@/lib/suppliers/service";

export const maxDuration = 300;

// GET /api/cron/supplier-sync — every few hours (see
// .github/workflows/cron-supplier-sync.yml): refresh each active API
// supplier's catalog (cost + stock → live prices) and poll order status /
// tracking. One supplier failing never blocks the others.
export async function GET(req: Request) {
  if (!authorizedCron(req)) return cronForbidden();
  const suppliers = await prisma.supplier.findMany({
    where: { integration: "API", active: true },
    select: { id: true, name: true },
  });
  const results: Record<string, string> = {};
  for (const s of suppliers) {
    try {
      const r = await syncSupplier(s.id);
      results[s.name] = `ok: ${r.total} items (${r.created} new, ${r.updated} updated)`;
    } catch (e) {
      results[s.name] = `failed: ${e instanceof Error ? e.message : "error"}`;
    }
  }
  const orders = await syncSupplierOrders();
  return NextResponse.json({ ok: true, suppliers: results, orders });
}
