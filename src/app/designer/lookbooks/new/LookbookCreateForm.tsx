"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tiny two-field create form. After save we jump straight to the editor
// at /designer/lookbooks/[id] where the designer adds items + flips public.
export function LookbookCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create look-book.");
        return;
      }
      router.push(`/designer/lookbooks/${data.collection.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Aso Ebi Spring 2026"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input min-h-[80px]"
          placeholder="A short tagline that introduces the collection."
          maxLength={500}
        />
      </div>
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={busy || title.length < 2}>
        {busy ? "Creating…" : "Create look-book"}
      </button>
    </form>
  );
}
