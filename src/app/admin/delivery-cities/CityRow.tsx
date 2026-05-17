"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CityRow({
  id,
  feeCents,
  active,
}: {
  id: string;
  feeCents: number;
  active: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState((feeCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/admin/delivery-cities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Delete this city from the platform delivery whitelist?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/delivery-cities/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          className="input w-24 text-right text-sm"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy}
          onClick={() => patch({ feeCents: Math.round(Number(fee) * 100) }).then(() => setEditing(false))}
        >
          Save
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(true)}>
        Edit fee
      </button>
      <button
        type="button"
        className="btn-ghost text-xs"
        disabled={busy}
        onClick={() => patch({ active: !active })}
      >
        {active ? "Pause" : "Resume"}
      </button>
      <button type="button" className="btn-danger text-xs" disabled={busy} onClick={remove}>
        Delete
      </button>
    </div>
  );
}
