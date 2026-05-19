import Link from "next/link";
import { prisma } from "@/lib/db";
import { Permission } from "@/lib/enums";
import { requireUser } from "@/lib/auth";
import { ProfileSettingsForm } from "@/components/forms/ProfileSettingsForm";
import { DeliveryFeesView } from "@/components/dashboard/DeliveryFeesView";
import { ShareButton } from "@/components/ShareButton";

export default async function DesignerSettingsPage() {
  const user = await requireUser(Permission.DESIGNER);
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
        <h2 className="font-display text-lg font-semibold">Delivery rates</h2>
        <p className="text-sm text-ink-600">
          What buyers pay your own rider when an order falls outside the platform&apos;s
          delivery zones. Set by StreekMart admins — read-only here.
        </p>
        <div className="mt-4">
          <DeliveryFeesView
            rates={{
              withinCityCents: user.deliveryWithinCityCents,
              outsideCityCents: user.deliveryOutsideCityCents,
              outsideCountryCents: user.deliveryOutsideCountryCents,
            }}
          />
        </div>
      </div>
    </div>
  );
}
