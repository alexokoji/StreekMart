import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { PostForm } from "@/components/forms/PostForm";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const user = await requireUser("DESIGNER");
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post || post.authorId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Edit post</h1>
      <div className="card p-6">
        <PostForm
          mode="edit"
          initial={{
            id: post.id,
            title: post.title,
            body: post.body,
            images: parseJsonArray(post.imagesJson),
            tags: parseJsonArray(post.tagsJson),
          }}
        />
      </div>
    </div>
  );
}
