import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";

export default async function PublicPostPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { author: { select: { id: true, name: true, bio: true } } },
  });
  if (!post) notFound();

  prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const images = parseJsonArray(post.imagesJson).map(buildWatermarkedUrl);
  const tags = parseJsonArray(post.tagsJson);

  return (
    <article className="mx-auto max-w-3xl card overflow-hidden">
      {images[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={images[0]} alt={post.title} className="aspect-video w-full object-cover" />
      )}
      <div className="p-6">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          By{" "}
          <Link href={`/messages?with=${post.author.id}`} className="text-brand-700 hover:underline">
            {post.author.name}
          </Link>{" "}
          · {timeAgo(post.createdAt)}
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

        {user && user.id !== post.author.id && (
          <div className="mt-6">
            <Link href={`/messages?with=${post.author.id}`} className="btn-secondary">Message designer</Link>
          </div>
        )}
      </div>
    </article>
  );
}
