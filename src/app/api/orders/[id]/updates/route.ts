import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managersServer";

// GET  /api/orders/[id]/updates — timeline (buyer or seller of the order)
// POST /api/orders/[id]/updates — append an update (seller / manager only)

const Body = z.object({
  kind: z.enum(["STATUS", "DISPATCHED", "ARRIVING", "NOTE"]),
  message: z.string().min(2).max(500),
  // ISO string with the estimated arrival time. Optional — only meaningful
  // for DISPATCHED / ARRIVING kinds.
  etaAt: z.string().datetime().optional(),
});

async function loadOrderForActor(id: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (order.buyerId !== userId && order.sellerId !== userId) {
    // Allow shop managers (manage_orders) AND delivery riders
    // (manage_deliveries) to read/post the timeline. A rider posting
    // "DISPATCHED — heading to Ikeja, ETA 30 min" is exactly the buyer-side
    // visibility the tracking page is designed for.
    const [isOrderMgr, isRider] = await Promise.all([
      hasManagerPermission(userId, order.sellerId, "manage_orders"),
      hasManagerPermission(userId, order.sellerId, "manage_deliveries"),
    ]);
    if (!isOrderMgr && !isRider) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }
  return { order };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const r = await loadOrderForActor(params.id, guard.session.sub);
  if ("error" in r) return r.error;
  const updates = await prisma.orderUpdate.findMany({
    where: { orderId: r.order.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ updates });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const r = await loadOrderForActor(params.id, guard.session.sub);
  if ("error" in r) return r.error;

  // Posting an update is a seller / manager / rider privilege — buyers
  // see them read-only. The loadOrderForActor check above already allows
  // the buyer to read, so we re-gate writes here.
  const canWrite =
    r.order.sellerId === guard.session.sub ||
    (await hasManagerPermission(guard.session.sub, r.order.sellerId, "manage_orders")) ||
    (await hasManagerPermission(guard.session.sub, r.order.sellerId, "manage_deliveries"));
  if (!canWrite) {
    return NextResponse.json(
      { error: "Only the seller, a manager, or a rider can post updates." },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const update = await prisma.orderUpdate.create({
    data: {
      orderId: r.order.id,
      kind: parsed.data.kind,
      message: parsed.data.message,
      etaAt: parsed.data.etaAt ? new Date(parsed.data.etaAt) : null,
      createdById: guard.session.sub,
    },
  });

  return NextResponse.json({ update });
}
