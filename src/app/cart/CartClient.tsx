"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Price } from "@/components/Price";

type Item = {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
    effectivePrice: number;
    image: string | null;
    seller: { id: string; name: string };
    stock: number;
  };
};

export function CartClient({ items: initial }: { items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setQty(itemId: string, qty: number) {
    if (qty < 1) return;
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, quantity: qty } : it)));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(itemId: string) {
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="card divide-y">
      {items.map((it) => (
        <li key={it.id} className="flex gap-4 p-4">
          <Link href={`/products/${it.product.id}`} className="block h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100">
            {it.product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.product.image} alt={it.product.name} className="h-full w-full object-cover" />
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/products/${it.product.id}`} className="font-medium hover:underline">
              {it.product.name}
            </Link>
            <p className="text-xs text-gray-500">Sold by {it.product.seller.name}</p>
            <p className="mt-1 text-sm">
              <span className="font-semibold"><Price amount={it.product.effectivePrice} /></span>
              {it.product.salePrice !== null && (
                <span className="ml-2 text-xs text-gray-400 line-through"><Price amount={it.product.price} /></span>
              )}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="inline-flex items-center rounded-md border border-gray-300">
                <button
                  type="button"
                  className="px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
                  onClick={() => setQty(it.id, it.quantity - 1)}
                  disabled={busyId === it.id || it.quantity <= 1}
                >
                  −
                </button>
                <span className="min-w-[2rem] px-2 text-center text-sm">{it.quantity}</span>
                <button
                  type="button"
                  className="px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
                  onClick={() => setQty(it.id, it.quantity + 1)}
                  disabled={busyId === it.id || it.quantity >= it.product.stock}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-red-600"
                onClick={() => remove(it.id)}
                disabled={busyId === it.id}
              >
                Remove
              </button>
            </div>
          </div>
          <p className="shrink-0 text-right text-sm font-semibold">
            <Price amount={it.product.effectivePrice * it.quantity} />
          </p>
        </li>
      ))}
    </ul>
  );
}
