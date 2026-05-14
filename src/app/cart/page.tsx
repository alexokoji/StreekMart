import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { Price } from "@/components/Price";
import { CartClient } from "./CartClient";

export default async function CartPage() {
  const user = await requireUser();

  // Lazy provision the cart on first visit.
  const cart = await prisma.cart.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    include: {
      items: {
        include: {
          product: { include: { seller: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const items = cart.items.map((it) => ({
    id: it.id,
    quantity: it.quantity,
    product: {
      id: it.product.id,
      name: it.product.name,
      price: it.product.price,
      salePrice: it.product.salePrice,
      effectivePrice: it.product.salePrice ?? it.product.price,
      image: parseJsonArray(it.product.imagesJson)[0] ?? null,
      seller: it.product.seller,
      stock: it.product.stock,
    },
  }));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl card p-10 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty.</h1>
        <p className="mt-1 text-sm text-gray-600">
          Browse the storefront and add a few pieces to get started.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Continue shopping
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((s, it) => s + it.product.effectivePrice * it.quantity, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your cart</h1>
          <p className="text-sm text-gray-500">{items.length} item{items.length === 1 ? "" : "s"}</p>
        </div>
        <CartClient items={items} />
      </div>

      <aside className="card sticky top-4 h-fit p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-medium"><Price amount={subtotal} /></dd>
          </div>
          <div className="flex justify-between text-gray-500">
            <dt>Shipping</dt>
            <dd>Calculated at checkout</dd>
          </div>
          <div className="mt-3 flex justify-between border-t pt-3 text-base">
            <dt className="font-semibold">Estimated total</dt>
            <dd className="font-bold"><Price amount={subtotal} /></dd>
          </div>
        </dl>
        <Link href="/cart/checkout" className="btn-primary mt-6 w-full text-center">
          Checkout
        </Link>
        <Link href="/" className="mt-2 block text-center text-xs text-gray-500 hover:text-brand-700">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
