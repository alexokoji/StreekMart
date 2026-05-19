"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Inline approve / reject control. Matches the shape of
// VerificationDecisionRow and PromotionDecisionRow so admins navigate the
// queues with the same muscle memory.
export function BusinessNameDecisionRow({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(decision === "APPROVE" ? "approve" : "reject");
    setErr(null);
    try {
      const res = await fetch(`/api/admin/business-name-changes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Couldn't save the decision.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <textarea
        className="input min-h-[40px] w-64 text-xs"
        placeholder="Optional decision note (shown to user)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-danger text-xs"
          onClick={() => decide("REJECT")}
          disabled={busy !== null}
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={() => decide("APPROVE")}
          disabled={busy !== null}
        >
          {busy === "approve" ? "…" : "Approve change"}
        </button>
      </div>
      {err && <p className="text-[11px] text-burgundy-700">{err}</p>}
    </div>
  );
}
