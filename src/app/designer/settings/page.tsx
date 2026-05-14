import Link from "next/link";
import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { ProfileSettingsForm } from "@/components/forms/ProfileSettingsForm";
import { ShareButton } from "@/components/ShareButton";

export default async function DesignerSettingsPage() {
  const user = await requireUser(Permission.DESIGNER);
  const handle = user.slug ?? user.id;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Account settings</h1>
          <p className="text-sm text-ink-600">Edit how you show up to buyers and other designers.</p>
          <p className="mt-1 text-xs text-ink-500">
            Public profile:{" "}
            <Link href={`/u/${handle}`} className="text-violet-700 hover:underline">
              /u/{handle}
            </Link>
          </p>
        </div>
        <ShareButton
          path={`/u/${handle}`}
          title={`${user.name} on StreekMart`}
          text={user.bio ?? "Check out my StreekMart portfolio."}
        />
      </div>
      <div className="card p-6">
        <ProfileSettingsForm
          initial={{
            name: user.name,
            email: user.email,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            slug: user.slug,
            isSeller: user.isSeller,
            isDesigner: user.isDesigner,
          }}
        />
      </div>
    </div>
  );
}
