import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { WalletPanel } from "@/components/dashboard/WalletPanel";

export default async function SellerWalletPage() {
  await requireUser(Permission.SELLER);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-ink-600">
          Sale proceeds (minus the platform fee) land here. Withdraw to your bank via Monnify.
        </p>
      </div>
      <WalletPanel />
    </div>
  );
}
