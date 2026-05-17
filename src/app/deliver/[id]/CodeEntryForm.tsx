"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Four single-character inputs that auto-advance, paste a full code if you
// paste 4 chars into the first, and submit on enter.
export function CodeEntryForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const [chars, setChars] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function setAt(i: number, v: string) {
    const cleaned = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length === 0) {
      setChars((prev) => {
        const next = [...prev];
        next[i] = "";
        return next;
      });
      return;
    }
    if (cleaned.length === 1) {
      setChars((prev) => {
        const next = [...prev];
        next[i] = cleaned;
        return next;
      });
      if (i < 3) refs[i + 1].current?.focus();
    } else {
      // Paste of multiple chars — distribute across boxes.
      setChars((prev) => {
        const next = [...prev];
        for (let k = 0; k < cleaned.length && i + k < 4; k++) next[i + k] = cleaned[k];
        return next;
      });
      const nextIdx = Math.min(3, i + cleaned.length);
      refs[nextIdx].current?.focus();
    }
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs[i - 1].current?.focus();
    } else if (e.key === "Enter") {
      void submit();
    }
  }

  async function submit() {
    const code = chars.join("");
    if (code.length !== 4) {
      setErr("Enter all 4 characters.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-by-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't confirm — check the code with the buyer.");
        return;
      }
      setOk(true);
      // Hard refresh so the page re-renders the "already completed" branch.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-accent">
        ✓ Delivery confirmed. Funds released to the seller.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        {chars.map((c, i) => (
          <input
            key={i}
            ref={refs[i]}
            value={c}
            inputMode="text"
            autoCapitalize="characters"
            maxLength={4}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            className="h-14 w-14 rounded-xl border-2 border-ink-200 bg-white text-center font-mono text-2xl font-bold uppercase focus:border-violet-500 focus:outline-none"
          />
        ))}
      </div>
      {err && <p className="text-sm text-burgundy-700">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="btn-primary w-full"
      >
        {busy ? "Confirming…" : "Confirm delivery"}
      </button>
    </div>
  );
}
