import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { OrderList } from "../OrderList";

export default async function ActiveOrdersPage() {
  const user = await requireUser("SELLER");
  const orders = await prisma.order.findMany({
    where: {
      sellerId: user.id,
      status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED] },
    },
    include: { product: true, buyer: { select: { id: true, name: true } }, shipment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Active orders</h1>
      <OrderList orders={orders} empty="No active orders." />
    </div>
  );
}
