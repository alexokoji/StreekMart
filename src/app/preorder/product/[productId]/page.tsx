import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";
import { displaySellerName } from "@/lib/businessName";
import { PreorderRequestForm } from "../../[postId]/PreorderRequestForm";

// Where the buyer lands after tapping "Preorder this piece" on a product
// listing. Mirrors src/app/preorder/[postId]/page.tsx for Designer posts.

export const dynamic = "force-dynamic";

export default async function ProductPreorderRequestPage({
  params,
}: {
  params: { productId: string };
}) {
  const user = await requireUser();

  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          slug: true,
          businessName: true,
          suspendedAt: true,
        },
      },
    },
  });
  if (!product) notFound();
  if (
    !product.preorderEnabled ||
    typeof product.preorderPriceCents !== "number" ||
    typeof product.preorderLeadDays !== "number" ||
    product.seller.suspendedAt
  ) {
    redirect(`/products/${product.id}`);
  }
  if (product.seller.id === user.id) {
    redirect(`/seller/products/${product.id}`);
  }

  const cover = parseJsonArray(product.imagesJson)[0] ?? null;
  const handle = product.seller.slug ?? product.seller.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <Link href={`/products/${product.id}`} className="text-sm text-violet-700 hover:underline">
          ← Back to product
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="card overflow-hidden">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buildWatermarkedUrl(cover)}
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-ink-50 text-sm text-ink-400 dark:bg-ink-700 dark:text-ink-400">
              No image
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
              Preorder
            </p>
            <h1 className="font-display text-2xl font-bold">{product.name}</h1>
            <p className="mt-1 text-sm text-ink-500">
              by{" "}
              <Link href={`/u/${handle}`} className="font-medium text-violet-700 hover:underline">
                {displaySellerName(product.seller)}
              </Link>
            </p>
          </div>

          <div className="card space-y-2 p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-ink-500">Design price</span>
              <span className="font-bold">
                ₦{(product.preorderPriceCents / 100).toLocaleString("en-NG")}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-ink-500">Estimated lead time</span>
              <span className="font-medium">
                {product.preorderLeadDays} day{product.preorderLeadDays === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-ink-500">Delivery</span>
              <span className="text-xs text-ink-500">Paid separately when ready</span>
            </div>
          </div>

          <PreorderRequestForm productId={product.id} />
        </div>
      </div>

      <div className="card border-violet-100 bg-violet-50/40 p-5 text-sm text-ink-700 dark:border-violet-900 dark:bg-violet-950/20 dark:text-ink-200">
        <p className="font-semibold">How preorders work</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-600 dark:text-ink-300">
          <li>You pay the design price now. We hold it until the piece is delivered (verified sellers get funds immediately to buy materials).</li>
          <li>
            The seller makes the piece within{" "}
            <strong>{product.preorderLeadDays} day{product.preorderLeadDays === 1 ? "" : "s"}</strong>.
          </li>
          <li>When ready, the seller marks it available — you&rsquo;ll get an email + push.</li>
          <li>You pay delivery, the seller ships, and you confirm with the delivery code on arrival.</li>
        </ol>
      </div>
    </div>
  );
}
