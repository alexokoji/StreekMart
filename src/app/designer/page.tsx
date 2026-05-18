import Link from "next/link";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { VerificationGate } from "@/components/VerificationGate";

export default async function DesignerDashboardPage() {
  const user = await requireUser("DESIGNER");

  const [postCount, totals, recentPosts, productCount, activeProducts] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.post.aggregate({
      where: { authorId: user.id },
      _sum: { viewCount: true, likeCount: true, saveCount: true },
    }),
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.product.count({ where: { sellerId: user.id } }),
    prisma.product.count({ where: { sellerId: user.id, status: ProductStatus.ACTIVE } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <div className="flex gap-2">
          <Link href="/designer/products/new" className="btn-secondary">+ List product</Link>
          <Link href="/designer/posts/new" className="btn-primary">+ New post</Link>
        </div>
      </div>

      <VerificationGate kind="designer" verified={user.designerVerified} />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Posts" value={postCount} />
        <Stat label="Products" value={productCount} sub={`${activeProducts} active`} />
        <Stat label="Total views" value={totals._sum.viewCount ?? 0} />
        <Stat label="Total likes" value={totals._sum.likeCount ?? 0} />
        <Stat label="Total saves" value={totals._sum.saveCount ?? 0} />
      </div>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent posts</h2>
          <Link href="/designer/posts" className="text-sm text-brand-700 hover:underline">View all</Link>
        </div>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-gray-500">You haven&apos;t published anything yet.</p>
        ) : (
          <ul className="divide-y">
            {recentPosts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <Link href={`/designer/posts/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-gray-500">
                  {p.likeCount} likes · {p.viewCount} views · {timeAgo(p.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
