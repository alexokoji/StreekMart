import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";

type OrderRow = {
  id: string;
  totalPrice: number;
  status: string;
  createdAt: Date;
  product: { id: string; name: string };
  buyer: { id: string; name: string };
  shipment?: { status: string } | null;
};

export function OrderList({ orders, empty }: { orders: OrderRow[]; empty: string }) {
  if (orders.length === 0) {
    return <div className="card p-8 text-center text-gray-500">{empty}</div>;
  }
  return (
    <div className="card divide-y">
      {orders.map((o) => (
        <div key={o.id} className="flex items-center justify-between p-4">
          <div>
            <Link href={`/seller/orders/${o.id}`} className="font-medium hover:underline">
              {o.product.name}
            </Link>
            <p className="text-xs text-gray-500">
              Buyer: {o.buyer.name} · {timeAgo(o.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium"><Price amount={o.totalPrice} /></p>
            <div className="space-y-1 text-right">
            <p className="text-sm font-medium"><Price amount={o.totalPrice} /></p>
            <span className={`badge ${!o.shipment && o.status === "PAID" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"}`}>
              {!o.shipment && o.status === "PAID" ? "Shipment pending" : o.status}
            </span>
          </div>
          </div>
        </div>
      ))}
    </div>
  );
}
