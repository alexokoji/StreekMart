import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { VerificationPanel } from "@/components/dashboard/VerificationPanel";

export default async function SellerVerificationPage() {
  const user = await requireUser(Permission.SELLER);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Seller verification</h1>
        <p className="text-sm text-ink-600">
          A check mark next to your shop name signals trust to buyers.
        </p>
      </div>
      <VerificationPanel kind="SELLER" alreadyVerified={user.sellerVerified} />
    </div>
  );
}
