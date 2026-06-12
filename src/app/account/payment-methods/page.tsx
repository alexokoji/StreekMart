import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PaymentMethodsEditor } from "./PaymentMethodsEditor";

// /account/payment-methods -- list and manage saved cards. Adding a new
// card requires going through checkout with "save this card" toggled
// (wired in Phase 4 -- the post-payment hook populates the table from
// the gateway's response). For now this page is the read + delete +
// set-default surface.
export default async function PaymentMethodsPage() {
  const user = await requireUser();
  const methods = await prisma.savedPaymentMethod.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Payment methods</h1>
        <p className="text-sm text-ink-600">
          Cards you&rsquo;ve saved at checkout. We never store raw card numbers &mdash; only the gateway&rsquo;s token and the last four digits.
        </p>
      </div>
      <PaymentMethodsEditor initial={methods.map((m) => ({
        id: m.id,
        gateway: m.gateway,
        maskedPan: m.maskedPan,
        brand: m.brand,
        expMonth: m.expMonth,
        expYear: m.expYear,
        isDefault: m.isDefault,
      }))} />
    </div>
  );
}