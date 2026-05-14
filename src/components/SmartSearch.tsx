"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractDominantColors } from "@/lib/extractColors";
import { Price } from "@/components/Price";

// Smart search widget. Two surfaces:
//   - Desktop: floating launcher in the bottom-right; clicking expands a panel.
//   - Mobile: opened externally via the BottomNav center FAB (see BottomNav.tsx).
//     The component exposes a window event "upclo:open-search" to let the
//     FAB trigger the same panel.
//
// The search engine is the deterministic bot in src/lib/searchBot.ts —
// not an LLM. Image search extracts dominant colors client-side via canvas
// k-means and POSTs hex codes to /api/search/image.

type ProductHit = {
  id: string;
  name: string;
  category: string;
  price: number;
  salePrice: number | null;
  image: string | null;
  seller: { id: string; name: string; verified: boolean };
  reasons: string[];
};

type DesignerSuggestion = {
  id: string;
  name: string;
  bio: string | null;
  matchingTags: string[];
  postCount: number;
};

type Mode = "text" | "image";

export function SmartSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<ProductHit[]>([]);
  const [designerFallback, setDesignerFallback] = useState<DesignerSuggestion[]>([]);
  const [parsedSummary, setParsedSummary] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageColors, setImageColors] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [lastQuery, setLastQuery] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Open from anywhere (BottomNav FAB).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("upclo:open-search", onOpen);
    return () => window.removeEventListener("upclo:open-search", onOpen);
  }, []);

  // Live suggestions while typing.
  useEffect(() => {
    if (mode !== "text") return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        }
      } catch {
        /* aborted */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, mode]);

  async function runTextSearch(q: string) {
    if (!q.trim()) return;
    setBusy(true);
    setMode("text");
    setLastQuery(q);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, source: "text" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setDesignerFallback([]);
        setParsedSummary(data.error ?? "Search failed");
        return;
      }
      setResults(data.results ?? []);
      setDesignerFallback(data.designerFallback ?? []);
      setParsedSummary(formatParsed(data.parsed));
    } finally {
      setBusy(false);
    }
  }

  async function runImageSearch(file: File, hintText: string) {
    setBusy(true);
    setMode("image");
    setLastQuery(`image:${hintText}`);
    try {
      const colors = await extractDominantColors(file, 5);
      setImageColors(colors);
      const res = await fetch("/api/search/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hexColors: colors, hint: hintText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setDesignerFallback([]);
        setParsedSummary(data.error ?? "Image search failed");
        return;
      }
      setResults(data.results ?? []);
      setDesignerFallback(data.designerFallback ?? []);
      setParsedSummary(
        `Matched palette: ${(data.parsedColors ?? []).join(", ") || "—"}`,
      );
    } catch {
      setParsedSummary("Couldn't read that image. Try a different photo.");
    } finally {
      setBusy(false);
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImagePreview(URL.createObjectURL(f));
    runImageSearch(f, hint);
  }

  function recordClick(productId: string) {
    if (!lastQuery) return;
    fetch("/api/search/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: lastQuery.replace(/^image:/, ""),
        productId,
        source: mode,
      }),
    }).catch(() => {});
  }

  function reset() {
    setQuery("");
    setHint("");
    setResults([]);
    setDesignerFallback([]);
    setParsedSummary("");
    setImagePreview(null);
    setImageColors([]);
    setMode("text");
  }

  return (
    <>
      {/* Desktop launcher — bottom-right floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 hidden items-center gap-2 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-glow hover:from-violet-700 hover:to-fuchsia-600 md:inline-flex"
        aria-label="Open smart search"
      >
        <SearchSVG className="h-4 w-4" />
        Smart Search
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm md:items-end md:justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex h-[88vh] w-full flex-col rounded-t-3xl border border-ink-100 bg-white shadow-2xl md:m-5 md:h-[min(640px,80vh)] md:w-[min(440px,calc(100vw-2.5rem))] md:rounded-3xl">
            {/* Header */}
            <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <div>
                <p className="font-display text-lg font-bold leading-tight">
                  Smart <span className="aurora-text">Search</span>
                </p>
                <p className="text-[11px] text-ink-500">
                  Type, snap, or upload — the bot finds your match.
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(query || results.length > 0 || imagePreview) && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-ink-500 hover:text-burgundy-700"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-50"
                  aria-label="Close"
                >
                  <CloseSVG className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Mode tabs */}
            <div className="flex gap-1 border-b border-ink-100 px-3 pt-2">
              <ModeTab active={mode === "text"} onClick={() => setMode("text")}>
                Type
              </ModeTab>
              <ModeTab active={mode === "image"} onClick={() => setMode("image")}>
                Camera / Upload
              </ModeTab>
            </div>

            {/* Mode-specific input area */}
            <div className="border-b border-ink-100 p-3">
              {mode === "text" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runTextSearch(query);
                  }}
                >
                  <div className="relative">
                    <input
                      autoFocus
                      placeholder='e.g. "linen shirt under $80"'
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="input pl-10 text-sm"
                    />
                    <SearchSVG className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  </div>
                  {/* Suggestions */}
                  {suggestions.length > 0 && results.length === 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setQuery(s);
                            runTextSearch(s);
                          }}
                          className="rounded-full border border-ink-200 px-3 py-1 text-[11px] text-ink-600 hover:border-violet-400 hover:text-violet-700"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-2">
                  <input
                    placeholder='Optional hint: "linen shirt", "bag", "shoes"…'
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onPickImage}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="btn-primary w-full"
                  >
                    📷 Take a photo / Upload
                  </button>
                  {imagePreview && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-ink-100 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Your upload"
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-ink-500">Detected palette</p>
                        <div className="mt-1 flex gap-1">
                          {imageColors.map((c) => (
                            <span
                              key={c}
                              className="h-5 w-5 rounded-full border border-white shadow-sm"
                              style={{ background: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {parsedSummary && (
                <p className="mt-2 text-[11px] italic text-ink-500">{parsedSummary}</p>
              )}
            </div>

            {/* Results scroll */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {busy && (
                <p className="px-1 text-sm text-ink-500">Searching…</p>
              )}

              {!busy && results.length === 0 && designerFallback.length === 0 && (
                <div className="px-1 py-6 text-center text-xs text-ink-500">
                  Search the marketplace by typing what you want, or snap a
                  photo and let the bot match by color + category.
                </div>
              )}

              {results.length > 0 && (
                <ul className="grid grid-cols-2 gap-3">
                  {results.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/products/${r.id}`}
                        onClick={() => {
                          recordClick(r.id);
                          setOpen(false);
                        }}
                        className="block rounded-xl border border-ink-100 transition hover:border-violet-400 hover:shadow-soft"
                      >
                        <div className="aspect-square overflow-hidden rounded-t-xl bg-ink-50">
                          {r.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image} alt={r.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="p-2">
                          <p className="line-clamp-1 text-xs font-medium">{r.name}</p>
                          <p className="text-xs text-ink-500">
                            <Price amount={r.salePrice ?? r.price} />
                          </p>
                          {r.reasons[0] && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] italic text-violet-700">
                              {r.reasons[0]}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* Designer fallback */}
              {designerFallback.length > 0 && (
                <section className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                    Can&apos;t find it? Have it made.
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Designers whose past work matches what you described:
                  </p>
                  <ul className="mt-3 space-y-2">
                    {designerFallback.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/messages?with=${d.id}`}
                          onClick={() => {
                            router.push(`/messages?with=${d.id}`);
                            setOpen(false);
                          }}
                          className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3 hover:border-violet-400"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
                            {d.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="line-clamp-1 text-[11px] text-ink-500">
                              {d.bio ?? "Independent designer"} ·{" "}
                              {d.matchingTags.slice(0, 3).join(", ")}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-violet-700">
                            Message →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-violet-600 text-violet-700"
          : "border-transparent text-ink-500 hover:text-ink-800"
      }`}
    >
      {children}
    </button>
  );
}

type ParsedSummary = {
  categories?: string[];
  colors?: string[];
  materials?: string[];
  maxPrice?: number;
  occasion?: string;
  keywords?: string[];
};

function formatParsed(p: ParsedSummary | undefined): string {
  if (!p) return "";
  const bits: string[] = [];
  if (p.categories?.length) bits.push(p.categories.join(", "));
  if (p.colors?.length) bits.push(`colors: ${p.colors.join(", ")}`);
  if (p.materials?.length) bits.push(`material: ${p.materials.join(", ")}`);
  if (p.maxPrice) bits.push(`under $${p.maxPrice}`);
  if (p.occasion) bits.push(`occasion: ${p.occasion}`);
  return bits.join(" · ");
}

function SearchSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function CloseSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}
