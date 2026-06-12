"use client";

import { useCallback, useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string | null };
};

type MyReview = { rating: number; body: string | null } | null;

type Resp = {
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
  myReview: MyReview;
};

// Lazy-loaded reviews block on the product page. Renders the average +
// total + each review, plus a write/edit form for the calling user if
// they actually purchased the product (server enforces the gate).
export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/reviews`);
      const d = (await res.json()) as Resp;
      setData(d);
      if (d.myReview) {
        setRating(d.myReview.rating);
        setBody(d.myReview.body ?? "");
      }
    } catch {
      setData({ reviews: [], ratingAvg: 0, ratingCount: 0, myReview: null });
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: body || undefined }),
      });
      const r = await res.json();
      if (!res.ok) {
        setErr(r.error ?? "Could not save review.");
        return;
      }
      setEditing(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <div className="card p-6 text-sm text-ink-500">Loading reviews...</div>;
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-xl font-semibold">Reviews</h2>
        <span className="text-sm text-ink-600">
          {data.ratingCount === 0 ? "No reviews yet" : `${data.ratingAvg.toFixed(1)} / 5 (${data.ratingCount})`}
        </span>
      </div>

      {/* Write / edit form */}
      <div className="card p-5">
        {editing ? (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <p className="label mb-1">Rating</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setRating(n)}
                    className={`text-2xl ${n <= rating ? "text-gold-400" : "text-ink-200"}`}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    *
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Tell other buyers what you think (optional)</label>
              <textarea
                className="input"
                rows={4}
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What did you love, what could be better?"
              />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving..." : data.myReview ? "Update review" : "Post review"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : data.myReview ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Your review</p>
              <p className="text-sm text-ink-600">{data.myReview.rating} / 5</p>
              {data.myReview.body && <p className="mt-1 text-sm text-ink-700">{data.myReview.body}</p>}
            </div>
            <button onClick={() => setEditing(true)} className="text-sm text-violet-700 hover:underline">
              Edit
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-600">
              Bought this? Share your honest take.
            </p>
            <button onClick={() => setEditing(true)} className="btn-primary text-sm">
              Write a review
            </button>
          </div>
        )}
      </div>

      {/* Existing reviews */}
      {data.reviews.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-500">
          No reviews yet. Be the first.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.reviews.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.author.name}</p>
                <p className="text-xs text-ink-400">
                  {new Date(r.createdAt).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
              <p className="mt-1 text-sm text-gold-700">{"*".repeat(r.rating)}{"-".repeat(5 - r.rating)}</p>
              {r.body && <p className="mt-2 text-sm text-ink-700 whitespace-pre-wrap">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}