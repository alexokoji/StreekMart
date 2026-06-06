import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";
import { displaySellerName } from "@/lib/businessName";
import { PreorderRequestForm } from "./PreorderRequestForm";

// Where the buyer lands after tapping "Preorder this piece" on the feed.
// Shows the piece, the price, the lead time, and a notes field. Submit
// kicks off the payment flow.

export const dynamic = "force-dynamic";

export default async function PreorderRequestPage({
  params,
}: {
  params: { postId: string };
}) {
  // Signed-in only — anonymous buyers got redirected to /login by the feed
  // CTA, but we re-check here for direct-link safety.
  const user = await requireUser();

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          slug: true,
          businessName: true,
          designerVerified: true,
          designerTier: true,
          suspendedAt: true,
        },
      },
    },
  });
  if (!post) notFound();
  if (
    !post.preorderEnabled ||
    typeof post.preorderPriceCents !== "number" ||
    typeof post.preorderLeadDays !== "number" ||
    post.author.suspendedAt
  ) {
    // Either the designer turned preorders off, or their account is
    // inactive — send the buyer back to the feed gracefully.
    redirect("/feed");
  }
  if (post.author.id === user.id) {
    // Can't preorder your own piece — designer should preview from edit.
    redirect(`/designer/posts/${post.id}`);
  }

  const cover = parseJsonArray(post.imagesJson)[0] ?? null;
  const handle = post.author.slug ?? post.author.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <Link href="/feed" className="text-sm text-violet-700 hover:underline">
          ← Back to feed
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="card overflow-hidden">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buildWatermarkedUrl(cover)}
              alt={post.title}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-ink-50 text-sm text-ink-400">
              No image
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
              Preorder
            </p>
            <h1 className="font-display text-2xl font-bold">{post.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              by{" "}
              <Link href={`/u/${handle}`} className="font-medium text-violet-700 hover:underline">
                {displaySellerName(post.author)}
              </Link>
            </p>
          </div>

          <div className="card space-y-2 p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-ink-500">Design price</span>
              <span className="font-bold">
                ₦{(post.preorderPriceCents / 100).toLocaleString("en-NG")}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-ink-500">Estimated lead time</span>
              <span className="font-medium">
                {post.preorderLeadDays} day{post.preorderLeadDays === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-ink-500">Delivery</span>
              <span className="text-xs text-ink-500">Paid separately when ready</span>
            </div>
          </div>

          <PreorderRequestForm postId={post.id} />
        </div>
      </div>

      <div className="card border-violet-100 bg-violet-50/40 p-5 text-sm text-ink-700">
        <p className="font-semibold">How preorders work</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-600">
          <li>You pay the design price now. We hold it until the piece is delivered (verified designers get funds immediately to buy materials).</li>
          <li>
            The designer makes the piece within{" "}
            <strong>{post.preorderLeadDays} day{post.preorderLeadDays === 1 ? "" : "s"}</strong>.
          </li>
          <li>When ready, the designer marks it available — you&rsquo;ll get an email + push.</li>
          <li>You pay delivery, the designer ships, and you confirm with the delivery code on arrival.</li>
        </ol>
      </div>
    </div>
  );
}
