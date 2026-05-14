import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { OrderList } from "../OrderList";

export default async function CompletedOrdersPage() {
  const user = await requireUser("SELLER");
  const orders = await prisma.order.findMany({
    where: {
      sellerId: user.id,
      status: { in: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
    include: { product: true, buyer: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Completed orders</h1>
      <OrderList orders={orders} empty="No completed orders yet." />
    </div>
  );
}
