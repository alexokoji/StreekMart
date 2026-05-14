import { PostForm } from "@/components/forms/PostForm";

export default function NewPostPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">New post</h1>
      <div className="card p-6">
        <PostForm mode="create" />
      </div>
    </div>
  );
}
