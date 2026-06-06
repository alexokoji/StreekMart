"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/forms/ImageUploader";

type Props = {
  initial?: {
    id?: string;
    title?: string;
    body?: string;
    images?: string[];
    tags?: string[];
    preorderEnabled?: boolean;
    preorderPriceCents?: number | null;
    preorderLeadDays?: number | null;
  };
  mode: "create" | "edit";
};

export function PostForm({ initial, mode }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  // Preorder config — when enabled with both price + lead set, buyers can
  // request the piece from the feed / homepage.
  const [preorderEnabled, setPreorderEnabled] = useState<boolean>(
    initial?.preorderEnabled ?? false,
  );
  const [preorderPriceNgn, setPreorderPriceNgn] = useState<number | "">(
    initial?.preorderPriceCents ? Math.round(initial.preorderPriceCents / 100) : "",
  );
  const [preorderLeadDays, setPreorderLeadDays] = useState<number | "">(
    initial?.preorderLeadDays ?? "",
  );
  const [aiNotes, setAiNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function draftWithAI() {
    if (aiNotes.trim().length < 5) {
      setErr("Jot down a few notes (5+ chars) for the AI to expand on.");
      return;
    }
    setErr(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/draft-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: aiNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Couldn't draft a post");
        return;
      }
      setTitle(data.draft.title);
      setBody(data.draft.body);
      setTagsText((data.draft.tags ?? []).join(", "));
    } finally {
      setAiBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const payload = {
        title,
        body,
        images,
        tags: tagsText.split(",").map((s) => s.trim()).filter(Boolean),
        // Only send preorder fields when the toggle is on AND both
        // numeric inputs are filled. The API treats undefined as "leave
        // unchanged" / "disabled" depending on mode.
        preorderEnabled,
        preorderPriceCents:
          preorderEnabled && typeof preorderPriceNgn === "number"
            ? Math.round(preorderPriceNgn * 100)
            : null,
        preorderLeadDays:
          preorderEnabled && typeof preorderLeadDays === "number"
            ? preorderLeadDays
            : null,
      };
      const res = await fetch(
        mode === "create" ? "/api/posts" : `/api/posts/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Save failed");
        return;
      }
      router.push(`/designer/posts/${data.post.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm("Delete this post?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${initial.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/designer/posts");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
        <p className="text-xs font-medium text-brand-700">✨ AI post drafter</p>
        <p className="mt-1 text-xs text-gray-600">
          Type a few rough notes and the AI will expand them into a polished post (title, body, tags).
        </p>
        <textarea
          className="input mt-2 min-h-[60px] text-xs"
          placeholder="e.g. 'this season I'm into ash & clay; muted earth tones; pairs with raw denim'"
          value={aiNotes}
          onChange={(e) => setAiNotes(e.target.value)}
        />
        <button
          type="button"
          onClick={draftWithAI}
          className="btn-primary mt-2 text-xs"
          disabled={aiBusy}
        >
          {aiBusy ? "Drafting…" : "Draft with AI"}
        </button>
      </div>

      <div>
        <label className="label">Title</label>
        <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label">Body</label>
        <textarea className="input min-h-[200px]" required value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div>
        <label className="label">Images</label>
        <ImageUploader value={images} onChange={setImages} multi max={6} />
      </div>
      <div>
        <label className="label">Tags (comma-separated)</label>
        <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="streetwear, vintage, denim" />
      </div>
      {/* Preorder configuration — when enabled, the post shows a
          "Preorder design" CTA on the feed + homepage that lets buyers
          request the piece directly. Buyer pays the design fee upfront;
          when verified (Tier 2+), the designer's wallet is credited
          immediately so they can buy materials. */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
              Preorder
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Let buyers request this piece directly. They pay the design
              fee upfront; you make the piece within the lead time, then
              they pay delivery separately and you ship.
            </p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2">
            <input
              type="checkbox"
              checked={preorderEnabled}
              onChange={(e) => setPreorderEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">Enable</span>
          </label>
        </div>
        {preorderEnabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Design price (NGN)</label>
              <input
                type="number"
                className="input"
                min={500}
                step={500}
                value={preorderPriceNgn}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreorderPriceNgn(v === "" ? "" : Number(v));
                }}
                placeholder="e.g. 35000"
                required={preorderEnabled}
              />
            </div>
            <div>
              <label className="label">Lead time (days)</label>
              <input
                type="number"
                className="input"
                min={1}
                max={120}
                value={preorderLeadDays}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreorderLeadDays(v === "" ? "" : Number(v));
                }}
                placeholder="e.g. 14"
                required={preorderEnabled}
              />
            </div>
          </div>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-between">
        {mode === "edit" ? (
          <button type="button" className="btn-danger" onClick={onDelete} disabled={busy}>Delete</button>
        ) : <span />}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Publish post" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
