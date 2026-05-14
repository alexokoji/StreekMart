import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { VerificationPanel } from "@/components/dashboard/VerificationPanel";

export default async function DesignerVerificationPage() {
  const user = await requireUser(Permission.DESIGNER);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Designer verification</h1>
        <p className="text-sm text-ink-600">
          Followers and buyers see a check next to your name when you&apos;re verified.
        </p>
      </div>
      <VerificationPanel kind="DESIGNER" alreadyVerified={user.designerVerified} />
    </div>
  );
}
