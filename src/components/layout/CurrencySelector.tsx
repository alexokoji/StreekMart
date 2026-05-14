"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";

// Tiny dropdown for the top nav. Defaults to whatever the server detected,
// lets the user override per-device. Selection persists via the
// `upclo_currency` cookie set by /api/currency.
export function CurrencySelector() {
  const router = useRouter();
  const ctx = useCurrency();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function pick(code: string) {
    if (code === ctx.code) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:border-violet-400 hover:text-violet-700"
      >
        <span aria-hidden="true">{ctx.flag}</span>
        <span>{ctx.code}</span>
        <svg viewBox="0 0 24 24" className="h-3 w-3 text-ink-400" fill="currentColor">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-40 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-ink-100 bg-white py-1 shadow-soft"
        >
          {CURRENCIES.map((c) => {
            const active = c.code === ctx.code;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={busy}
                  onClick={() => pick(c.code)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-violet-50 text-violet-700"
                      : "text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{c.flag}</span>
                    <span className="font-medium">{c.code}</span>
                    <span className="text-[11px] text-ink-500">{c.name}</span>
                  </span>
                  {active && <span className="text-[10px] font-bold text-violet-700">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
