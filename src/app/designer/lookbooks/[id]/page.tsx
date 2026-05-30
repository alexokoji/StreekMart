import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { LookbookEditor, type EditorItem } from "./LookbookEditor";

export default async function EditLookbookPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser("DESIGNER");
  const collection = await prisma.collection.findUnique({
    where: { id: params.id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          post: { select: { id: true, title: true, imagesJson: true } },
          product: {
            select: { id: true, name: true, imagesJson: true, price: true, salePrice: true },
          },
        },
      },
    },
  });
  if (!collection || collection.ownerId !== user.id) notFound();

  // Pull every post + product the designer owns so the editor's picker
  // panel has the full inventory to choose from. Both lists are typically
  // small (<= a few dozen) for a single designer; we don't paginate.
  const [allPosts, allProducts] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, imagesJson: true },
    }),
    prisma.product.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, imagesJson: true, price: true, salePrice: true },
    }),
  ]);

  const initialItems: EditorItem[] = collection.items.map((it) => {
    if (it.post) {
      return {
        key: `p-${it.post.id}`,
        kind: "post",
        id: it.post.id,
        title: it.post.title,
        image: parseJsonArray(it.post.imagesJson)[0] ?? null,
      };
    }
    if (it.product) {
      return {
        key: `r-${it.product.id}`,
        kind: "product",
        id: it.product.id,
        title: it.product.name,
        image: parseJsonArray(it.product.imagesJson)[0] ?? null,
      };
    }
    return {
      key: `x-${it.id}`,
      kind: "post",
      id: it.id,
      title: "(missing)",
      image: null,
    };
  });

  const allItems: EditorItem[] = [
    ...allPosts.map<EditorItem>((p) => ({
      key: `p-${p.id}`,
      kind: "post",
      id: p.id,
      title: p.title,
      image: parseJsonArray(p.imagesJson)[0] ?? null,
    })),
    ...allProducts.map<EditorItem>((r) => ({
      key: `r-${r.id}`,
      kind: "product",
      id: r.id,
      title: r.name,
      image: parseJsonArray(r.imagesJson)[0] ?? null,
    })),
  ];

  const handle = user.slug ?? user.id;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">Edit look-book</h1>
      <p className="text-sm text-ink-500">
        Curate the items in this look-book. Reorder by removing then re-adding;
        drag-reordering is on the roadmap. Public URL:{" "}
        <code className="rounded bg-ink-50 px-1.5 py-0.5 text-xs">
          /lookbook/{handle}/{collection.slug}
        </code>
      </p>
      <LookbookEditor
        collectionId={collection.id}
        initialTitle={collection.title}
        initialDescription={collection.description ?? ""}
        initialStatus={collection.status as "DRAFT" | "PUBLIC"}
        initialItems={initialItems}
        availableItems={allItems}
        publicHref={`/lookbook/${handle}/${collection.slug}`}
      />
    </div>
  );
}
