"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StartChatRedirect({ withUserId }: { withUserId: string }) {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withUserId }),
      });
      const data = await res.json();
      if (data.chat?.id) {
        router.replace(`/messages/${data.chat.id}`);
      } else {
        router.replace("/messages");
      }
    })();
  }, [withUserId, router]);

  return <div className="card mt-10 p-8 text-center text-gray-500">Opening chat…</div>;
}
