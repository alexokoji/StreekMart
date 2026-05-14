import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";

export default async function DesignerPostsPage() {
  const user = await requireUser("DESIGNER");
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My posts</h1>
        <Link href="/designer/posts/new" className="btn-primary">+ New post</Link>
      </div>

      {posts.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          No posts yet. <Link href="/designer/posts/new" className="text-brand-700 hover:underline">Publish your first one</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const images = parseJsonArray(p.imagesJson);
            return (
              <div key={p.id} className="card overflow-hidden">
                {images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt={p.title} className="aspect-video w-full object-cover" />
                )}
                <div className="p-4">
                  <Link href={`/designer/posts/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.body}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {p.likeCount} likes · {p.viewCount} views · {timeAgo(p.createdAt)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/designer/posts/${p.id}`} className="btn-secondary text-xs">View</Link>
                    <Link href={`/designer/posts/${p.id}/edit`} className="btn-secondary text-xs">Edit</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
