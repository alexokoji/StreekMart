"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RoleChangeDecisionRow({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function decide(kind: "APPROVE" | "REJECT") {
    let note: string | undefined;
    if (kind === "REJECT") {
      const entered = window.prompt(
        "Optional reason for rejection (sent to the user):",
        "",
      );
      if (entered === null) return; // cancelled
      note = entered.trim() || undefined;
    }
    setBusy(kind === "APPROVE" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/admin/role-changes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: kind, note }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Decision failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
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
  );
}
