"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tiny inline editor for a single seller's delivery rates. Renders the
// three current values; clicking Edit reveals number inputs; Save PATCHes
// /api/admin/delivery-fees/[userId] then refreshes the page.
export function AdminDeliveryRateEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: { within: number; outside: number; international: number };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [within, setWithin] = useState((initial.within / 100).toFixed(2));
  const [outside, setOutside] = useState((initial.outside / 100).toFixed(2));
  const [intl, setIntl] = useState((initial.international / 100).toFixed(2));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/delivery-fees/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withinCity: Math.round(Number(within) * 100),
          outsideCity: Math.round(Number(outside) * 100),
          outsideCountry: Math.round(Number(intl) * 100),
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs font-medium text-violet-700 hover:underline"
      >
        Edit rates
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NumInput value={within} onChange={setWithin} placeholder="within" />
      <NumInput value={outside} onChange={setOutside} placeholder="outside" />
      <NumInput value={intl} onChange={setIntl} placeholder="intl" />
      <button
        type="button"
        className="rounded-md bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        onClick={save}
        disabled={busy}
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="text-xs text-ink-500 hover:text-ink-800"
        onClick={() => setEditing(false)}
      >
        Cancel
      </button>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      className="w-20 rounded-md border border-ink-200 px-2 py-1 text-right text-xs"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
