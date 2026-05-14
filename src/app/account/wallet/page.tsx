import { requireUser } from "@/lib/auth";
import { WalletPanel } from "@/components/dashboard/WalletPanel";

// Buyer-facing wallet page. Shows refund credit, a withdraw form, and the
// transaction history. Sellers/designers have their own wallet pages under
// /seller/wallet and /designer/wallet — this one is dedicated to the
// buyer-only flow (no held-until-delivery KPI, copy talks about refunds).
export default async function BuyerWalletPage() {
  await requireUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Refund wallet</h1>
        <p className="text-sm text-ink-600">
          Credits from cancelled orders land here. Spend them at checkout or
          withdraw to your bank.
        </p>
      </div>
      <WalletPanel mode="buyer" />
    </div>
  );
}
