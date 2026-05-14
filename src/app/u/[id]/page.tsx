import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { FollowButton } from "./FollowButton";
import { ShareButton } from "@/components/ShareButton";

// Public profile page — surfaces a user's seller storefront and (if they're
// also a designer) their portfolio posts. URL: /u/<userId>?tab=products|posts
//
// Linked from anywhere a seller/designer name appears (product detail,
// post header, designer rail, etc.).

const VALID_TABS = ["products", "posts"] as const;
type Tab = (typeof VALID_TABS)[number];

// Resolve a profile by either its slug or its raw cuid. Slugs win when
// they're set; that lets us redirect cuid URLs to the canonical slug form.
async function resolveProfile(idOrSlug: string) {
  // Try slug first (more common in shared links).
  const bySlug = await prisma.user.findUnique({
    where: { slug: idOrSlug },
    select: PROFILE_SELECT,
  });
  if (bySlug) return bySlug;
  return prisma.user.findUnique({
    where: { id: idOrSlug },
    select: PROFILE_SELECT,
  });
}

const PROFILE_SELECT = {
  id: true,
  slug: true,
  name: true,
  bio: true,
  avatarUrl: true,
  isSeller: true,
  isDesigner: true,
  sellerVerified: true,
  designerVerified: true,
  exposureScore: true,
  createdAt: true,
  _count: { select: { products: true, posts: true, followedBy: true } },
} as const;

// generateMetadata runs server-side for every request and gives shared
// links a proper preview card on social/messaging apps.
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const profile = await resolveProfile(params.id);
  if (!profile) return { title: "StreekMart" };

  const role =
    profile.isSeller && profile.isDesigner
      ? "seller & designer"
      : profile.isSeller
        ? "seller"
        : profile.isDesigner
          ? "designer"
          : "member";
  const desc = profile.bio ?? `${profile.name} on StreekMart — independent ${role}.`;
  return {
    title: `${profile.name} · StreekMart`,
    description: desc,
    openGraph: {
      title: `${profile.name} on StreekMart`,
      description: desc,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${profile.name} on StreekMart`,
      description: desc,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const viewer = await getCurrentUser();

  const profile = await resolveProfile(params.id);
  if (!profile) notFound();

  // Canonical-redirect: when someone hits the cuid form but a slug exists,
  // bounce them to the pretty URL so any future shares from that page
  // carry the slug, and search engines see one canonical address.
  if (profile.slug && params.id !== profile.slug) {
    const tabSuffix = searchParams.tab ? `?tab=${encodeURIComponent(searchParams.tab)}` : "";
    redirect(`/u/${profile.slug}${tabSuffix}`);
  }

  const handle = profile.slug ?? profile.id;

  // Default to whichever tab makes sense for the user's role mix.
  const requested = (searchParams.tab as Tab | undefined) ?? null;
  const defaultTab: Tab = profile.isSeller ? "products" : "posts";
  const tab: Tab =
    requested && (VALID_TABS as readonly string[]).includes(requested)
      ? (requested as Tab)
      : defaultTab;

  const [products, posts, alreadyFollowing] = await Promise.all([
    profile.isSeller
      ? prisma.product.findMany({
          where: { sellerId: profile.id, status: ProductStatus.ACTIVE },
          orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
          take: 60,
        })
      : Promise.resolve([]),
    profile.isDesigner
      ? prisma.post.findMany({
          where: { authorId: profile.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    viewer && profile.isDesigner
      ? prisma.follow.findUnique({
          where: {
            followerId_designerId: { followerId: viewer.id, designerId: profile.id },
          },
        })
      : Promise.resolve(null),
  ]);

  const verified = profile.sellerVerified || profile.designerVerified;

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <header className="card overflow-hidden">
        <div className="h-24 w-full bg-g-aurora sm:h-32" />
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-4 px-6 pb-5 sm:-mt-12">
          <div className="flex items-end gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-soft sm:h-24 sm:w-24">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-500 text-2xl font-bold text-white">
                  {profile.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">
                {profile.name}
                {verified && (
                  <span
                    title="Verified by StreekMart"
                    className="ml-2 inline-flex h-5 w-5 -translate-y-0.5 items-center justify-center rounded-full bg-emerald-accent text-[10px] font-bold text-white"
                  >
                    ✓
                  </span>
                )}
              </h1>
              <p className="mt-0.5 text-sm text-ink-600">{profile.bio ?? "Independent maker on StreekMart."}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                {profile.isSeller && <span className="badge bg-violet-50 text-violet-700">Seller</span>}
                {profile.isDesigner && <span className="badge bg-fuchsia-50 text-fuchsia-700">Designer</span>}
                <span>· joined {timeAgo(profile.createdAt)}</span>
                {profile._count.followedBy > 0 && (
                  <span>· {profile._count.followedBy} follower{profile._count.followedBy === 1 ? "" : "s"}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ShareButton
              path={`/u/${handle}`}
              title={`${profile.name} on StreekMart`}
              text={profile.bio ?? "Check out this StreekMart profile."}
            />
            {viewer && viewer.id !== profile.id && (
              <Link
                href={`/messages?with=${profile.id}`}
                className="btn-secondary text-sm"
              >
                Message
              </Link>
            )}
            {profile.isDesigner && viewer && viewer.id !== profile.id && (
              <FollowButton
                designerId={profile.id}
                initialFollowing={!!alreadyFollowing}
              />
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      {profile.isSeller && profile.isDesigner && (
        <div className="flex gap-1 border-b border-ink-100">
          <TabLink href={`/u/${profile.id}?tab=products`} active={tab === "products"}>
            Products
            <span className="ml-2 text-[10px] text-ink-400">{profile._count.products}</span>
          </TabLink>
          <TabLink href={`/u/${profile.id}?tab=posts`} active={tab === "posts"}>
            Posts
            <span className="ml-2 text-[10px] text-ink-400">{profile._count.posts}</span>
          </TabLink>
        </div>
      )}

      {/* Products grid */}
      {tab === "products" && profile.isSeller && (
        products.length === 0 ? (
          <div className="card p-10 text-center text-ink-500">
            No active listings right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {products.map((p) => {
              const img = parseJsonArray(p.imagesJson)[0];
              const eff = p.salePrice ?? p.price;
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="product-card"
                >
                  <div className="aspect-square bg-ink-50">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-ink-600"><Price amount={eff} /></p>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* Posts grid */}
      {tab === "posts" && profile.isDesigner && (
        posts.length === 0 ? (
          <div className="card p-10 text-center text-ink-500">
            No posts yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => {
              const img = parseJsonArray(p.imagesJson)[0];
              return (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.title} className="aspect-video w-full object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="font-display text-base font-semibold">{p.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-600">{p.body}</p>
                    <p className="mt-2 text-[11px] text-ink-500">{timeAgo(p.createdAt)} · {p.likeCount} likes</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* Fallback when tab doesn't match the user's roles */}
      {((tab === "products" && !profile.isSeller) ||
        (tab === "posts" && !profile.isDesigner)) && (
        <div className="card p-10 text-center text-ink-500">
          {profile.name} hasn&apos;t enabled that part of their profile.
        </div>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "text-violet-700" : "text-ink-500 hover:text-ink-800"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" />
      )}
    </Link>
  );
}
