"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Rate-the-seller card shown on the buyer's order detail page once the
// order is COMPLETED. Editable within 30 days of completion; afterwards
// the form locks itself and shows a read-only summary. Mirrors the server-
// side check in POST /api/seller-reviews so users see the same expiry the
// API enforces.

const RATING_EDIT_WINDOW_DAYS = 30;
const STARS = [1, 2, 3, 4, 5] as const;

type Existing = {
  rating: number;
  body: string | null;
  edited: boolean;
};

export function SellerRatingForm({
  orderId,
  sellerName,
  completedAt,
  existing,
}: {
  orderId: string;
  sellerName: string;
  completedAt: string;
  existing: Existing | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [body, setBody] = useState<string>(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const expired = useMemo(() => {
    const ageMs = Date.now() - new Date(completedAt).getTime();
    return ageMs > RATING_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  }, [completedAt]);

  // If the buyer already submitted and the window is gone, render a frozen
  // read-only card instead of an editable form.
  if (expired && existing) {
    return (
      <section className="card p-5">
        <h3 className="text-sm font-semibold">Your rating for {sellerName}</h3>
        <p className="mt-2 flex items-center gap-1 text-amber-500">
          {STARS.map((n) => (
            <span key={n} className={n <= existing.rating ? "" : "text-ink-200"}>
              ★
            </span>
          ))}
        </p>
        {existing.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">
            {existing.body}
          </p>
        )}
        <p className="mt-2 text-[11px] text-ink-400">
          {existing.edited ? "Edited · " : ""}Rating locked after{" "}
          {RATING_EDIT_WINDOW_DAYS} days.
        </p>
      </section>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (rating < 1 || rating > 5) {
      setErr("Pick a star rating first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/seller-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, rating, body: body || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save your rating.");
        return;
      }
      setSavedAt(new Date());
      // Refresh server data so the form reflects the new edited state.
      router.refresh();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const display = hover || rating;
  const heading = existing ? "Edit your rating" : `Rate ${sellerName}`;

  return (
    <section className="card p-5">
      <h3 className="text-sm font-semibold">{heading}</h3>
      <p className="text-xs text-ink-500">
        Your rating helps other buyers and influences how this seller&apos;s
        products are ranked. You can revise it for the next 30 days.
      </p>

      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div
          role="radiogroup"
          aria-label="Star rating"
          className="flex items-center gap-1 text-2xl"
          onMouseLeave={() => setHover(0)}
        >
          {STARS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              className={
                n <= display
                  ? "text-amber-400 transition"
                  : "text-ink-200 transition hover:text-amber-300"
              }
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-xs font-medium text-ink-500">
              {rating}/5
            </span>
          )}
        </div>

        <textarea
          className="input min-h-[72px]"
          placeholder="Optional: how was the experience?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />

        {err && <p className="text-sm text-red-600">{err}</p>}
        {savedAt && !err && (
          <p className="text-xs text-emerald-600">
            Saved {savedAt.toLocaleTimeString()}.{" "}
            {existing ? "Your previous rating has been updated." : ""}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || rating < 1}
          >
            {busy ? "Saving…" : existing ? "Update rating" : "Submit rating"}
          </button>
          {existing?.edited && (
            <span className="text-[11px] text-ink-400">Previously edited</span>
          )}
        </div>
      </form>
    </section>
  );
}
