import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { PromoteButton } from "@/components/PromoteButton";

export default async function DesignerViewPostPage({ params }: { params: { id: string } }) {
  const user = await requireUser("DESIGNER");
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { promotions: { where: { active: true, endsAt: { gt: new Date() } } } },
  });
  if (!post || post.authorId !== user.id) notFound();

  const images = parseJsonArray(post.imagesJson);
  const tags = parseJsonArray(post.tagsJson);
  const isPromoted = post.promotions.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/designer/posts" className="text-sm text-brand-700 hover:underline">← All posts</Link>
        <div className="flex gap-2">
          <Link href={`/designer/posts/${post.id}/edit`} className="btn-secondary">Edit</Link>
          <PromoteButton kind="post" id={post.id} disabled={isPromoted} />
        </div>
      </div>

      <article className="card overflow-hidden">
        {images[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0]} alt={post.title} className="aspect-video w-full object-cover" />
        )}
        <div className="p-6">
          <h1 className="text-3xl font-bold">{post.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {timeAgo(post.createdAt)} · {post.viewCount} views · {post.likeCount} likes · {post.saveCount} saves
            {isPromoted && <span className="ml-2 badge bg-brand-50 text-brand-700">Promoted</span>}
          </p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((t) => <span key={t} className="badge bg-gray-100 text-gray-700">#{t}</span>)}
            </div>
          )}
          <div className="prose mt-6 whitespace-pre-wrap text-gray-800">{post.body}</div>
          {images.slice(1).length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {images.slice(1).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="aspect-video w-full rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
