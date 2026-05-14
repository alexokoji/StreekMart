"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerificationDecisionRow({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(decision === "APPROVE" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/admin/verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <textarea
        className="input min-h-[40px] w-64 text-xs"
        placeholder="Optional decision note"
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
          {busy === "approve" ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
