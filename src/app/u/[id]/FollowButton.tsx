"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Toggle follow/unfollow for a designer profile. Posts to /api/follows
// (which round-trips the existing follow toggle endpoint).
export function FollowButton({
  designerId,
  initialFollowing,
}: {
  designerId: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setFollowing(!!data.following);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={following ? "btn-secondary text-sm" : "btn-primary text-sm"}
    >
      {following ? "Following" : "+ Follow"}
    </button>
  );
}
