"use client";

import { useEffect, useRef, useState } from "react";
import { cn, timeAgo } from "@/lib/utils";

type Msg = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string | Date;
  sender: { id: string; name: string; isSeller?: boolean; isDesigner?: boolean };
};

const POLL_MS = 4000;

export function ChatPanel({
  chatId,
  currentUserId,
  initialMessages,
}: {
  chatId: string;
  currentUserId: string;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Poll for new messages every few seconds (near-real-time without sockets).
  useEffect(() => {
    const t = setInterval(async () => {
      const last = messages[messages.length - 1];
      const after = last ? new Date(last.createdAt).toISOString() : "";
      const res = await fetch(`/api/chats/${chatId}/messages?after=${encodeURIComponent(after)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => [...prev, ...data.messages]);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [chatId, messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setBody("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[calc(100vh-220px)] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500">Say hi to start the conversation.</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                mine ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900",
              )}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-brand-100" : "text-gray-500")}>
                  {timeAgo(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
