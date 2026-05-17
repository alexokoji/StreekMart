"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Update = {
  id: string;
  kind: string;
  message: string;
  etaAt: string | null;
  createdAt: string;
};

type Kind = "STATUS" | "DISPATCHED" | "ARRIVING" | "NOTE";

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "STATUS", label: "Status update" },
  { value: "DISPATCHED", label: "Out for delivery" },
  { value: "ARRIVING", label: "Arriving soon" },
  { value: "NOTE", label: "Note for the buyer" },
];

// Seller-side tracking control. Posts to /api/orders/[id]/updates, then
// re-fetches the list. The buyer sees the result on /account/orders/[id].
export function TrackingUpdater({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [kind, setKind] = useState<Kind>("STATUS");
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/orders/${orderId}/updates`);
    if (res.ok) {
      const data = await res.json();
      setUpdates(data.updates ?? []);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const needsEta = kind === "DISPATCHED" || kind === "ARRIVING";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (message.trim().length < 2) {
      setErr("Add a message.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          etaAt: needsEta && eta ? new Date(eta).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't post the update.");
        return;
      }
      setMessage("");
      setEta("");
      refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-base font-semibold">Buyer tracking</h2>
      <p className="text-xs text-ink-500">
        Updates show on the buyer&apos;s order page so they know where you are in the
        delivery process.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Update type</label>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {needsEta && (
            <div>
              <label className="label">ETA</label>
              <input
                type="datetime-local"
                className="input"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
              />
            </div>
          )}
        </div>
        <div>
          <label className="label">Message</label>
          <input
            className="input"
            value={message}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Rider Bayo picked up your package — heading to Ikeja now."
          />
        </div>
        {err && <p className="text-sm text-burgundy-700">{err}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Posting…" : "Post update"}
          </button>
        </div>
      </form>

      {updates.length > 0 && (
        <ol className="mt-5 space-y-3 border-t border-ink-100 pt-4 text-sm">
          {updates.map((u) => (
            <li key={u.id} className="flex gap-3">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-violet-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.message}</p>
                <p className="text-[11px] text-ink-500">
                  {u.kind.toLowerCase()} · {new Date(u.createdAt).toLocaleString()}
                  {u.etaAt && ` · ETA ${new Date(u.etaAt).toLocaleString()}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
