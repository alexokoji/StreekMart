import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ProfileSettingsForm } from "@/components/forms/ProfileSettingsForm";
import { AddressBookManager } from "@/components/forms/AddressBookManager";
import { LogoutButton } from "@/components/layout/LogoutButton";

export default async function BuyerAccountSettingsPage() {
  const user = await requireUser();
  const handle = user.slug ?? user.id;
  const pendingBusinessNameRequest = user.businessName
    ? await prisma.businessNameChangeRequest.findFirst({
        where: { userId: user.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, requestedName: true, createdAt: true },
      })
    : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Account settings</h1>
        <p className="text-sm text-ink-600">Update your name, email, password, and profile.</p>
        <p className="mt-1 text-xs text-ink-500">
          Public profile:{" "}
          <Link href={`/u/${handle}`} className="text-violet-700 hover:underline">
            /u/{handle}
          </Link>
        </p>
      </div>

      <div className="card p-6">
        <ProfileSettingsForm
          initial={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            businessName: user.businessName,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            coverImageUrl: user.coverImageUrl,
            slug: user.slug,
            isSeller: user.isSeller,
            isDesigner: user.isDesigner,
            country: user.country,
            city: user.city,
            region: user.region,
            pendingBusinessNameRequest: pendingBusinessNameRequest
              ? {
                  id: pendingBusinessNameRequest.id,
                  requestedName: pendingBusinessNameRequest.requestedName,
                  createdAt: pendingBusinessNameRequest.createdAt.toISOString(),
                }
              : null,
          }}
        />
      </div>

      <div className="card p-6">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Saved delivery addresses</h2>
          <p className="text-xs text-ink-500">
            Picked once at checkout, reused on every order. Set a default to skip
            address entry next time.
          </p>
        </div>
        <AddressBookManager
          kind="DELIVERY"
          countryRestriction={(user.country || "NG").toLowerCase()}
          emptyHint="You haven't saved any delivery addresses yet. Add one to speed up checkout."
        />
      </div>

      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">Sign out of StreekMart</p>
          <p className="text-xs text-ink-500">You&apos;ll be returned to the home page.</p>
        </div>
        <LogoutButton className="btn-secondary" label="Sign out" />
      </div>
    </div>
  );
}
