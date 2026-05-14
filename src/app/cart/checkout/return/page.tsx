import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isLiveMode } from "@/lib/monnify";
import { StubConfirmPanel } from "./StubConfirmPanel";

// /cart/checkout/return?ref=…
//
// Buyers land here after Monnify redirects them back from the hosted
// checkout. We resolve the order group by paymentReference and show one of
// three states based on what the webhook has written so far:
//
//   PAID      — webhook has fired and orders are finalised. Show success.
//   PENDING   — webhook hasn't fired yet (race / network blip). Tell them
//               to refresh; the webhook will catch up.
//   CANCELLED — payment failed or was abandoned. Offer to retry.
//
// In stub mode (no real Monnify) we render a confirmation panel so the
// developer can choose paid / failed and exercise the rest of the pipeline.
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const user = await requireUser();
  const ref = searchParams.ref;
  if (!ref) redirect("/cart");

  const orders = await prisma.order.findMany({
    where: { paymentReference: ref, buyerId: user.id },
    select: { id: true, status: true, totalPrice: true },
  });

  if (orders.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Payment not found</h1>
        <p className="mt-2 text-sm text-ink-600">We couldn&apos;t find a payment with that reference.</p>
        <Link href="/cart" className="btn-primary mt-4 inline-flex">Back to cart</Link>
      </div>
    );
  }

  const allPaid = orders.every((o) => o.status === OrderStatus.PAID || o.status === OrderStatus.SHIPPED || o.status === OrderStatus.COMPLETED);
  const allCancelled = orders.every((o) => o.status === OrderStatus.CANCELLED);
  const stubPending = !isLiveMode() && orders.every((o) => o.status === OrderStatus.PENDING);

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      {allPaid ? (
        <>
          <h1 className="font-display text-xl font-semibold">Payment received</h1>
          <p className="mt-2 text-sm text-ink-600">
            Your {orders.length} order{orders.length === 1 ? "" : "s"} {orders.length === 1 ? "is" : "are"} being prepared. You&apos;ll see updates in your account.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/account/orders" className="btn-primary">View orders</Link>
            <Link href="/" className="btn-secondary">Keep shopping</Link>
          </div>
        </>
      ) : allCancelled ? (
        <>
          <h1 className="font-display text-xl font-semibold">Payment cancelled</h1>
          <p className="mt-2 text-sm text-ink-600">No charge was made. Items remain in your cart so you can try again.</p>
          <Link href="/cart/checkout" className="btn-primary mt-4 inline-flex">Try again</Link>
        </>
      ) : stubPending ? (
        <StubConfirmPanel paymentReference={ref} />
      ) : (
        <>
          <h1 className="font-display text-xl font-semibold">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-ink-600">
            Your payment is being verified by the bank. Refresh in a moment, or check{" "}
            <Link href="/account/orders" className="text-violet-700 hover:underline">your orders</Link>.
          </p>
        </>
      )}
    </div>
  );
}
