import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { Price } from "@/components/Price";
import { isLiveMode } from "@/lib/monnify";
import { CheckoutForm } from "./CheckoutForm";

export default async function CheckoutPage() {
  const user = await requireUser();
  const live = isLiveMode();
  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: { include: { seller: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) redirect("/cart");

  const items = cart.items.map((it) => ({
    id: it.id,
    name: it.product.name,
    image: parseJsonArray(it.product.imagesJson)[0] ?? null,
    quantity: it.quantity,
    price: (it.product.salePrice ?? it.product.price) * it.quantity,
  }));
  const subtotal = items.reduce((s, it) => s + it.price, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-3">
        <Link href="/cart" className="text-sm text-brand-700 hover:underline">← Back to cart</Link>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="text-sm text-gray-600">
          {live
            ? "You'll be redirected to Monnify to complete payment securely."
            : "Monnify is in stub mode — orders will auto-confirm without a real charge. Set MONNIFY_LIVE=1 in .env for the real flow."}
        </p>
        <div className="card p-6">
          <CheckoutForm />
        </div>
      </div>

      <aside className="card h-fit p-6 lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold">Summary</h2>
        <ul className="mt-3 divide-y">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                {it.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="line-clamp-1 text-sm font-medium">{it.name}</p>
                <p className="text-xs text-gray-500">× {it.quantity}</p>
              </div>
              <p className="text-sm font-medium"><Price amount={it.price} /></p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 text-base font-bold">
          <span>Total</span>
          <span><Price amount={subtotal} /></span>
        </div>
      </aside>
    </div>
  );
}
