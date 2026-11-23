"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Small shared fetch helper for the supplier admin panels: tracks busy/error
// state and refreshes the server-rendered page after every successful call.
export function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(op: string, method: string, url: string, body?: unknown) {
    setBusy(op);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong.");
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setErr("Network error — try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }
  return { busy, err, msg, setMsg, setErr, call };
}
