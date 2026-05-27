"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn, timeAgo } from "@/lib/utils";

type Sender = { id: string; name: string; isSeller?: boolean; isDesigner?: boolean };

type Msg = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string | Date;
  sender: Sender;
  clientMessageId?: string | null;
  // Local-only fields. Pending = optimistically inserted, awaiting server
  // confirmation. Failed = server replied non-OK or fetch errored. Sent =
  // confirmed by the server. Absent on messages that pre-date the
  // idempotency feature, which are always treated as confirmed.
  status?: "pending" | "sent" | "failed";
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
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep a live ref of messages so the polling effect can read the latest
  // without re-binding the interval on every state change.
  const messagesRef = useRef<Msg[]>(initialMessages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // Merge incoming messages from the server, deduplicating by id and by
  // clientMessageId. Optimistic rows get upgraded in place when their
  // server-confirmed twin shows up — so the swap is invisible to the user.
  const mergeIncoming = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      const byCmid = new Map(
        prev
          .filter((m) => m.clientMessageId)
          .map((m) => [m.clientMessageId as string, m]),
      );
      const next = [...prev];
      let mutated = false;
      for (const inc of incoming) {
        if (byId.has(inc.id)) continue;
        if (inc.clientMessageId && byCmid.has(inc.clientMessageId)) {
          const idx = next.findIndex(
            (m) => m.clientMessageId === inc.clientMessageId,
          );
          if (idx >= 0) {
            next[idx] = { ...inc, status: "sent" };
            mutated = true;
          }
          continue;
        }
        next.push({ ...inc, status: "sent" });
        mutated = true;
      }
      return mutated ? next : prev;
    });
  }, []);

  // Poll for new messages. We anchor the "after" timestamp on the latest
  // server-confirmed message so optimistic-pending rows don't shift the
  // window forward and accidentally exclude their real counterpart.
  useEffect(() => {
    let cancelled = false;
    const t = setInterval(async () => {
      const all = messagesRef.current;
      let anchor: Msg | undefined;
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].status !== "pending" && all[i].status !== "failed") {
          anchor = all[i];
          break;
        }
      }
      const after = anchor ? new Date(anchor.createdAt).toISOString() : "";
      try {
        const res = await fetch(
          `/api/chats/${chatId}/messages?after=${encodeURIComponent(after)}`,
        );
        if (!res.ok) {
          console.warn("[chat] poll failed:", res.status);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.messages)) {
          mergeIncoming(data.messages);
        }
      } catch (err) {
        console.warn("[chat] poll error:", err);
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [chatId, mergeIncoming]);

  // Generate a stable id-per-attempt. Used for both the optimistic row id
  // and the server-side idempotency key — so retries collapse cleanly.
  function newClientMessageId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    // Older browsers — random-enough for an idempotency key.
    return `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const submitMessage = useCallback(
    async (text: string, clientMessageId: string) => {
      try {
        const res = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text, clientMessageId }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === clientMessageId
                ? { ...data.message, status: "sent" as const }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === clientMessageId
                ? { ...m, status: "failed" as const }
                : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId
              ? { ...m, status: "failed" as const }
              : m,
          ),
        );
      }
    },
    [chatId],
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const text = body.trim();
    if (!text) return;

    const clientMessageId = newClientMessageId();
    const optimistic: Msg = {
      id: `pending-${clientMessageId}`,
      body: text,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      sender: { id: currentUserId, name: "" },
      clientMessageId,
      status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setSending(true);
    try {
      await submitMessage(text, clientMessageId);
    } finally {
      setSending(false);
      // Return focus to the input so the next message can be typed without
      // a click.
      inputRef.current?.focus();
    }
  }

  function retry(m: Msg) {
    if (!m.clientMessageId) return;
    setMessages((prev) =>
      prev.map((x) =>
        x.clientMessageId === m.clientMessageId
          ? { ...x, status: "pending" as const }
          : x,
      ),
    );
    void submitMessage(m.body, m.clientMessageId);
  }

  return (
    <div className="card flex h-[calc(100vh-220px)] flex-col">
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            Say hi to start the conversation.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const pending = m.status === "pending";
          const failed = m.status === "failed";
          return (
            <div
              key={m.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  mine ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900",
                  pending && "opacity-70",
                  failed && "ring-2 ring-red-400",
                )}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-[10px]",
                    mine ? "text-brand-100" : "text-gray-500",
                  )}
                >
                  {failed ? (
                    <>
                      <span className="text-red-200">Failed to send</span>
                      <button
                        type="button"
                        onClick={() => retry(m)}
                        className="underline underline-offset-2 hover:text-white"
                      >
                        Retry
                      </button>
                    </>
                  ) : pending ? (
                    <span>Sending…</span>
                  ) : (
                    <span>{timeAgo(m.createdAt)}</span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <label htmlFor="chat-input" className="sr-only">
          Type a message
        </label>
        <input
          id="chat-input"
          ref={inputRef}
          className="input flex-1"
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Type a message"
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={sending || !body.trim()}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}
