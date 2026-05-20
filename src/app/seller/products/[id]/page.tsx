import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PromotionStatus } from "@/lib/enums";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { PromoteButton } from "@/components/PromoteButton";

export default async function ViewProductPage({ params }: { params: { id: string } }) {
  const user = await requireUser("SELLER");
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      // All non-terminal promotions for this product. We use this to drive
      // the PromoteButton: APPROVED+live → "Promoted" (disabled),
      // PENDING_PAYMENT/PENDING_REVIEW → in-flight state, else → can pay.
      promotions: {
        where: {
          status: {
            in: [
              PromotionStatus.APPROVED,
              PromotionStatus.PENDING_PAYMENT,
              PromotionStatus.PENDING_REVIEW,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  if (!product || product.sellerId !== user.id) notFound();

  const images = parseJsonArray(product.imagesJson);
  const now = new Date();
  const livePromotion = product.promotions.find(
    (p) => p.status === PromotionStatus.APPROVED && p.endsAt > now,
  );
  const isPromoted = !!livePromotion;
  const pendingPromo = product.promotions.find(
    (p) =>
      p.status === PromotionStatus.PENDING_PAYMENT ||
      p.status === PromotionStatus.PENDING_REVIEW,
  );
  const pendingState: "payment" | "review" | undefined =
    pendingPromo?.status === PromotionStatus.PENDING_PAYMENT
      ? "payment"
      : pendingPromo?.status === PromotionStatus.PENDING_REVIEW
        ? "review"
        : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="flex gap-2">
          <Link href={`/seller/products/${product.id}/edit`} className="btn-secondary">Edit</Link>
          <PromoteButton
            kind="product"
            id={product.id}
            disabled={isPromoted}
            pendingState={pendingState}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Fixed gallery envelope — matches the buyer-facing product page so
            tall/wide product photos can't push the rest of the layout
            around. See products/[id]/page.tsx for the rationale. */}
        <div className="card mx-auto w-full max-w-[480px] overflow-hidden lg:mx-0">
          <div className="aspect-square bg-gray-100">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">No image uploaded</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2 p-2">
              {images.slice(1).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="aspect-square w-full rounded bg-gray-100 object-contain" />
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="badge bg-gray-100 text-gray-700">{product.status}</span>
            <span className="badge bg-gray-100 text-gray-700">{product.category}</span>
            {isPromoted && <span className="badge bg-brand-50 text-brand-700">Promoted</span>}
          </div>
          <p className="text-3xl font-bold"><Price amount={product.price} /></p>
          <p className="mt-4 whitespace-pre-wrap text-gray-700">{product.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Views" value={product.viewCount} />
            <Stat label="Likes" value={product.likeCount} />
            <Stat label="Saves" value={product.saveCount} />
            <Stat label="Sales" value={product.salesCount} />
          </dl>
          <p className="mt-4 text-xs text-gray-500">Created {timeAgo(product.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
