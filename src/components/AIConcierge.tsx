"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Price } from "@/components/Price";

type ProductCard = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  sellerName: string;
  href: string;
};

type Turn = {
  role: "user" | "assistant";
  content: string;
  products?: ProductCard[];
};

const STORAGE_KEY = "upclo_concierge_v1";

const SUGGESTIONS = [
  "I need a date-night outfit under $150",
  "Show me oversized streetwear",
  "Who are the top trending designers?",
  "Linen pieces for warm weather",
];

export function AIConcierge() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore conversation from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTurns(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
    } catch {
      /* ignore (quota / safari private) */
    }
  }, [turns]);

  // Auto-scroll on new turns.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurns([
          ...next,
          {
            role: "assistant",
            content: data.error || "Something went wrong reaching the concierge.",
          },
        ]);
        return;
      }
      setTurns([
        ...next,
        {
          role: "assistant",
          content: data.reply,
          products: Array.isArray(data.products) ? data.products : [],
        },
      ]);
    } catch {
      setTurns([
        ...next,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTurns([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return (
    <>
      {/* Floating button. Lifted above the mobile bottom nav (~64px high +
          safe-area inset) so it doesn't collide; on desktop it sits low-right. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-[5.5rem] right-4 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-glow transition-all sm:bottom-5 sm:right-5 sm:px-5 sm:py-3",
          open
            ? "bg-gray-900 text-white"
            : "bg-brand-600 text-white hover:bg-brand-700",
        )}
        aria-label={open ? "Close concierge" : "Open AI Concierge"}
      >
        {open ? "Close" : "✨ Ask the Concierge"}
      </button>

      {/* Panel — lifted on mobile to clear the bottom nav, regular bottom-right on desktop. */}
      {open && (
        <div className="fixed bottom-[9rem] right-4 z-40 flex h-[min(560px,70vh)] w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border border-ink-200 bg-white shadow-2xl sm:bottom-20 sm:right-5 sm:h-[min(640px,80vh)] sm:w-[min(420px,calc(100vw-2.5rem))]">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="font-semibold">StreekMart Concierge</p>
              <p className="text-xs text-gray-500">Your AI fashion guide</p>
            </div>
            <div className="flex items-center gap-2">
              {turns.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  Reset
                </button>
              )}
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  Hi! I can help you find clothing, suggest outfits, and recommend designers. Try one of these:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:border-brand-500 hover:bg-brand-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    t.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-900",
                  )}
                >
                  {t.content}
                  {t.products && t.products.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {t.products.slice(0, 4).map((p) => (
                        <Link
                          key={p.id}
                          href={p.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-lg border border-gray-200 bg-white p-2 text-gray-900 hover:border-brand-500"
                        >
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="aspect-square w-full rounded object-cover"
                            />
                          ) : (
                            <div className="aspect-square w-full rounded bg-gray-100" />
                          )}
                          <p className="mt-1 line-clamp-1 text-xs font-medium">{p.name}</p>
                          <p className="text-xs text-gray-600"><Price amount={p.price} /></p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
                  thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t p-3"
          >
            <input
              className="input flex-1 text-sm"
              placeholder="Ask anything fashion-related…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={busy || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
