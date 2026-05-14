import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { ManualVerifyButtons } from "./ManualVerifyButtons";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireAdmin();
  const q = (searchParams.q ?? "").trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      isSeller: true,
      isDesigner: true,
      sellerVerified: true,
      designerVerified: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="text-sm text-ink-600">{users.length} matched</p>
        </div>
        <form action="/admin/users" method="get" className="w-full max-w-xs">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by email or name…"
            className="input text-sm"
          />
        </form>
      </div>

      <ul className="card divide-y divide-ink-100">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium">
                <Link href={`/u/${u.id}`} className="hover:underline">{u.name}</Link>
                {u.isAdmin && <span className="ml-2 badge bg-burgundy-50 text-burgundy-700">Admin</span>}
              </p>
              <p className="text-xs text-ink-500">{u.email} · joined {timeAgo(u.createdAt)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {u.isSeller && (
                  <span className={`badge ${u.sellerVerified ? "bg-emerald-50 text-emerald-accent" : "bg-violet-50 text-violet-700"}`}>
                    Seller{u.sellerVerified ? " ✓" : ""}
                  </span>
                )}
                {u.isDesigner && (
                  <span className={`badge ${u.designerVerified ? "bg-emerald-50 text-emerald-accent" : "bg-fuchsia-50 text-fuchsia-700"}`}>
                    Designer{u.designerVerified ? " ✓" : ""}
                  </span>
                )}
                {!u.isSeller && !u.isDesigner && !u.isAdmin && (
                  <span className="badge bg-ink-50 text-ink-500">Buyer</span>
                )}
              </div>
            </div>
            <ManualVerifyButtons
              userId={u.id}
              isSeller={u.isSeller}
              isDesigner={u.isDesigner}
              sellerVerified={u.sellerVerified}
              designerVerified={u.designerVerified}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
