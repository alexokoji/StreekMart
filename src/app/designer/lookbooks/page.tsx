import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CollectionStatus } from "@/lib/collections";

// /designer/lookbooks — list + create + edit entry-point for the designer's
// look-book collections. Editing happens at /designer/lookbooks/[id] (with
// an item picker + drag-order). DRAFT collections show an inline preview
// link; PUBLIC ones link out to the live page.

export default async function DesignerLookbooksPage() {
  const user = await requireUser("DESIGNER");
  const collections = await prisma.collection.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
      status: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Look-books</h1>
          <p className="text-sm text-ink-500">
            Bundle posts and products into a curated, shareable URL.
          </p>
        </div>
        <Link href="/designer/lookbooks/new" className="btn-primary">
          + New look-book
        </Link>
      </div>

      {collections.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-500">
            You haven&rsquo;t made a look-book yet. Group a few posts under a
            theme (&ldquo;Aso Ebi Spring 2026&rdquo;, &ldquo;Bridal 2026&rdquo;)
            and share it as one link.
          </p>
          <Link href="/designer/lookbooks/new" className="btn-primary mt-4 inline-flex">
            Make your first look-book
          </Link>
        </div>
      ) : (
        <ul className="card divide-y">
          {collections.map((c) => {
            const handle = user.slug ?? user.id;
            const publicHref = `/lookbook/${handle}/${c.slug}`;
            return (
              <li key={c.id} className="flex items-center gap-4 p-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-ink-100">
                  {c.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.coverUrl}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/designer/lookbooks/${c.id}`}
                    className="block break-words font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {c._count.items} item{c._count.items === 1 ? "" : "s"} ·{" "}
                    {c.status === CollectionStatus.PUBLIC ? (
                      <Link href={publicHref} className="text-violet-700 hover:underline">
                        Public · view
                      </Link>
                    ) : (
                      <span className="text-amber-700">Draft</span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/designer/lookbooks/${c.id}`}
                  className="btn-secondary text-xs"
                >
                  Edit
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
