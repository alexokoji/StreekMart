import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { ManagersPanel } from "@/components/dashboard/ManagersPanel";

export default async function DesignerManagersPage() {
  await requireUser(Permission.DESIGNER);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Account managers</h1>
        <p className="text-sm text-ink-600">
          Bring on someone to help post, edit, or reply to messages on your behalf.
        </p>
      </div>
      <ManagersPanel scope="designer" />
    </div>
  );
}
