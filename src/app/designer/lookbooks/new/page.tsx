import { LookbookCreateForm } from "./LookbookCreateForm";

export default function NewLookbookPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">New look-book</h1>
      <p className="text-sm text-ink-500">
        Pick a title — you&rsquo;ll add posts and products on the next screen.
      </p>
      <div className="card p-6">
        <LookbookCreateForm />
      </div>
    </div>
  );
}
