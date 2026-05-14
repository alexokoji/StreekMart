import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { ManagersPanel } from "@/components/dashboard/ManagersPanel";

export default async function SellerManagersPage() {
  await requireUser(Permission.SELLER);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Shop managers</h1>
        <p className="text-sm text-ink-600">
          Hand off day-to-day work — pick exactly which actions each manager can perform on your store.
        </p>
      </div>
      <ManagersPanel scope="seller" />
    </div>
  );
}
