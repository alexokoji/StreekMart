import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { WalletPanel } from "@/components/dashboard/WalletPanel";

export default async function DesignerWalletPage() {
  await requireUser(Permission.DESIGNER);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-ink-600">
          Earnings from sales of your listed pieces accumulate here.
        </p>
      </div>
      <WalletPanel />
    </div>
  );
}
