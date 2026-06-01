import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { RoleChangePanel } from "@/components/account/RoleChangePanel";

// Standalone role-change page. Lives at /account/role so sellers and
// designers can reach it too (the /account page redirects single-role
// users away to their dashboard).

export const metadata = { title: "Role change · StreekMart" };

export default async function RoleChangePage() {
  const user = await requireUser();

  const pending = await prisma.roleChangeRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true, toIsSeller: true, toIsDesigner: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <Link href="/account" className="text-sm text-violet-700 hover:underline">
        ← Account
      </Link>
      <RoleChangePanel
        currentIsSeller={user.isSeller}
        currentIsDesigner={user.isDesigner}
        pending={
          pending
            ? {
                id: pending.id,
                toIsSeller: pending.toIsSeller,
                toIsDesigner: pending.toIsDesigner,
                createdAt: pending.createdAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}
