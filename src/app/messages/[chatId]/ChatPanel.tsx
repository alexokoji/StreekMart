"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, timeAgo } from "@/lib/utils";

type Sender = { id: string; name: string; isSeller?: boolean; isDesigner?: boolean };

type Reaction = { id: string; emoji: string; userId: string };

type ReplyParent = {
  id: string;
  body: string;
  senderId: string;
  deletedAt: string | Date | null;
  attachmentUrl: string | null;
  attachmentMime: string | null;
  sender: { id: string; name: string };
} | null;

type Msg = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string | Date;
  sender: Sender;
  reactions?: Reaction[];
  replyTo?: ReplyParent;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  clientMessageId?: string | null;
  status?: "pending" | "sent" | "failed";
};

type PeerRead = { userId: string; lastReadAt: string | null };

const POLL_MS = 3000;
const TYPING_HEARTBEAT_MS = 2000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"] as const;
const MAX_VOICE_NOTE_MS = 2 * 60 * 1000; // 2-minute auto-stop

export function ChatPanel({
  chatId,
  currentUserId,
  initialMessages,
  peerName,
}: {
  chatId: string;
  currentUserId: string;
  initialMessages: Msg[];
  peerName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState<string[]>([]);
  const [peerReads, setPeerReads] = useState<PeerRead[]>([]);
  const [peerOnline, setPeerOnline] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recording, setRecording] = useState<null | { startedAt: number; elapsedMs: number }>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Msg[]>(initialMessages);
  const lastUpdatedRef = useRef<string | null>(null);
  // MediaRecorder state lives outside React because the API is mutable.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingCancelledRef = useRef(false);
  const recordingTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll on length change.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // Mark read on mount + when new messages arrive.
  useEffect(() => {
    void fetch(`/api/chats/${chatId}/read`, { method: "POST" });
  }, [chatId, messages.length]);

  // Close popovers on outside pointerdown.
  useEffect(() => {
    function onDown() {
      setActionFor(null);
      setReactPickerFor(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const mergeIncoming = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      const byCmid = new Map(
        prev.filter((m) => m.clientMessageId).map((m) => [m.clientMessageId as string, m]),
      );
      const next = [...prev];
      let mutated = false;
      for (const inc of incoming) {
        if (byId.has(inc.id)) {
          const idx = next.findIndex((m) => m.id === inc.id);
          if (idx >= 0) {
            next[idx] = { ...inc, status: "sent" };
            mutated = true;
          }
          continue;
        }
        if (inc.clientMessageId && byCmid.has(inc.clientMessageId)) {
          const idx = next.findIndex((m) => m.clientMessageId === inc.clientMessageId);
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

  // Polling: messages + updates + typing + reads + presence.
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
      const updatedAfter = lastUpdatedRef.current ?? after;
      try {
        const res = await fetch(
          `/api/chats/${chatId}/messages?after=${encodeURIComponent(after)}&updatedAfter=${encodeURIComponent(updatedAfter)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.messages)) mergeIncoming(data.messages);
        if (Array.isArray(data.updates)) mergeIncoming(data.updates);
        if (Array.isArray(data.peerTyping)) setPeerTyping(data.peerTyping);
        if (Array.isArray(data.peerReads)) setPeerReads(data.peerReads);
        if (Array.isArray(data.peerOnline)) setPeerOnline(data.peerOnline);
        if (data.serverNow) lastUpdatedRef.current = data.serverNow;
      } catch {
        // silent
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [chatId, mergeIncoming]);

  // Typing heartbeat — only while composing text.
  useEffect(() => {
    if (!body.trim() || editing) return;
    const send = () => {
      void fetch(`/api/chats/${chatId}/typing`, { method: "POST" });
    };
    send();
    const t = setInterval(send, TYPING_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [chatId, body, editing]);

  function newClientMessageId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const submitMessage = useCallback(
    async (
      text: string,
      clientMessageId: string,
      opts?: {
        replyToId?: string;
        attachmentUrl?: string;
        attachmentMime?: string;
        attachmentName?: string;
        attachmentSize?: number;
      },
    ) => {
      try {
        const res = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: text,
            clientMessageId,
            replyToId: opts?.replyToId,
            attachmentUrl: opts?.attachmentUrl,
            attachmentMime: opts?.attachmentMime,
            attachmentName: opts?.attachmentName,
            attachmentSize: opts?.attachmentSize,
          }),
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

  // ---------- Send / Edit ----------

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (editing) {
      const text = body.trim();
      if (!text || text === editing.original) {
        setEditing(null);
        setBody("");
        return;
      }
      setSending(true);
      try {
        const res = await fetch(`/api/chats/${chatId}/messages/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
        if (res.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === editing.id ? { ...m, body: text, editedAt: new Date().toISOString() } : m,
            ),
          );
          setEditing(null);
          setBody("");
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? "Edit failed.");
        }
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
      return;
    }

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
      replyTo: replyTo
        ? {
            id: replyTo.id,
            body: replyTo.body,
            senderId: replyTo.senderId,
            deletedAt: replyTo.deletedAt ?? null,
            attachmentUrl: replyTo.attachmentUrl ?? null,
            attachmentMime: replyTo.attachmentMime ?? null,
            sender: { id: replyTo.sender.id, name: replyTo.sender.name },
          }
        : null,
    };
    const replyToId = replyTo?.id;
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setReplyTo(null);
    setSending(true);
    try {
      await submitMessage(text, clientMessageId, { replyToId });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  // ---------- File picker (any type) ----------

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("File too large — keep it under 8 MB.");
      return;
    }
    await uploadAndSend(file, file.type, file.name, body.trim());
    setBody("");
  }

  async function uploadAndSend(
    file: Blob,
    mime: string,
    name: string,
    caption: string,
  ) {
    setUploadError(null);
    setUploading(true);
    const clientMessageId = newClientMessageId();
    const optimistic: Msg = {
      id: `pending-${clientMessageId}`,
      body: caption,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      sender: { id: currentUserId, name: "" },
      clientMessageId,
      status: "pending",
      attachmentUrl: typeof URL !== "undefined" ? URL.createObjectURL(file) : null,
      attachmentMime: mime,
      attachmentName: name,
      attachmentSize: file.size,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const fd = new FormData();
      fd.append("file", new File([file], name, { type: mime }));
      const up = await fetch(`/api/chats/${chatId}/attachment`, {
        method: "POST",
        body: fd,
      });
      if (!up.ok) {
        const data = await up.json().catch(() => ({}));
        setUploadError(data.error ?? "Upload failed.");
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId ? { ...m, status: "failed" as const } : m,
          ),
        );
        return;
      }
      const { url, size, mime: serverMime } = await up.json();
      void submitMessage(caption, clientMessageId, {
        attachmentUrl: url,
        attachmentMime: serverMime ?? mime,
        attachmentName: name,
        attachmentSize: size ?? file.size,
      });
    } finally {
      setUploading(false);
    }
  }

  // ---------- Voice recording ----------

  function pickAudioMime(): string | null {
    if (typeof MediaRecorder === "undefined") return null;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
    ];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch {
        // ignore — some browsers throw on unsupported strings
      }
    }
    return "";
  }

  async function startRecording() {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setUploadError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      if (mime === null) {
        setUploadError("Voice recording isn't supported in this browser.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      recordingCancelledRef.current = false;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        // Stop the mic.
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const ticking = recordingTickRef.current;
        if (ticking) clearInterval(ticking);
        recordingTickRef.current = null;
        setRecording(null);

        if (recordingCancelledRef.current) {
          mediaChunksRef.current = [];
          return;
        }
        if (mediaChunksRef.current.length === 0) return;

        const finalMime = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(mediaChunksRef.current, { type: finalMime });
        mediaChunksRef.current = [];
        const ext = finalMime.includes("mp4") ? "m4a" : finalMime.includes("ogg") ? "ogg" : "webm";
        await uploadAndSend(blob, finalMime, `Voice note.${ext}`, "");
      };
      mr.start();
      const startedAt = Date.now();
      setRecording({ startedAt, elapsedMs: 0 });
      recordingTickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= MAX_VOICE_NOTE_MS) {
          stopRecording(false);
          return;
        }
        setRecording({ startedAt, elapsedMs: elapsed });
      }, 250);
    } catch (err) {
      console.warn("[chat] mic access denied:", err);
      setUploadError(
        "Couldn't access your microphone. Allow mic access for this site to send voice notes.",
      );
    }
  }

  function stopRecording(cancelled: boolean) {
    recordingCancelledRef.current = cancelled;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        // already stopped
      }
    } else {
      // Defensive: if there's no active recorder somehow, just clear state.
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      const ticking = recordingTickRef.current;
      if (ticking) clearInterval(ticking);
      recordingTickRef.current = null;
      setRecording(null);
    }
  }

  // ---------- Reactions / Delete / Edit ----------

  async function deleteMessage(m: Msg) {
    if (!confirm("Delete this message? This can't be undone.")) return;
    setActionFor(null);
    const res = await fetch(`/api/chats/${chatId}/messages/${m.id}`, { method: "DELETE" });
    if (res.ok) {
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id
            ? {
                ...x,
                body: "",
                attachmentUrl: null,
                attachmentMime: null,
                attachmentName: null,
                attachmentSize: null,
                deletedAt: new Date().toISOString(),
              }
            : x,
        ),
      );
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed.");
    }
  }

  async function toggleReaction(m: Msg, emoji: string) {
    setReactPickerFor(null);
    setMessages((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const reactions = x.reactions ?? [];
        const mine = reactions.find((r) => r.userId === currentUserId && r.emoji === emoji);
        if (mine) return { ...x, reactions: reactions.filter((r) => r.id !== mine.id) };
        return {
          ...x,
          reactions: [
            ...reactions,
            { id: `pending-${Date.now()}`, emoji, userId: currentUserId },
          ],
        };
      }),
    );
    const res = await fetch(`/api/chats/${chatId}/messages/${m.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Reaction failed.");
    }
  }

  function startEdit(m: Msg) {
    setActionFor(null);
    setEditing({ id: m.id, original: m.body });
    setBody(m.body);
    inputRef.current?.focus();
  }
  function cancelEdit() {
    setEditing(null);
    setBody("");
  }
  function startReply(m: Msg) {
    setActionFor(null);
    setReplyTo(m);
    inputRef.current?.focus();
  }

  const peerLastReadMs = useMemo(() => {
    if (peerReads.length === 0) return 0;
    let min = Number.POSITIVE_INFINITY;
    for (const p of peerReads) {
      if (!p.lastReadAt) return 0;
      const t = new Date(p.lastReadAt).getTime();
      if (t < min) min = t;
    }
    return Number.isFinite(min) ? min : 0;
  }, [peerReads]);

  function canEdit(m: Msg): boolean {
    if (m.senderId !== currentUserId) return false;
    if (m.deletedAt) return false;
    if (m.attachmentUrl && !m.body) return false;
    return Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
  }

  const peerIsOnline = peerOnline.length > 0;

  return (
    <div className="card flex h-[calc(100vh-220px)] flex-col">
      {/* Presence pill — sits above the message list so it's always visible. */}
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2 text-xs">
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            peerIsOnline ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" : "bg-ink-300",
          )}
          aria-hidden="true"
        />
        <span className={peerIsOnline ? "font-medium text-emerald-700" : "text-ink-500"}>
          {peerIsOnline ? `${peerName || "Online"} online` : `${peerName || "Offline"} offline`}
        </span>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500">Say hi to start the conversation.</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const pending = m.status === "pending";
          const failed = m.status === "failed";
          const deleted = !!m.deletedAt;
          const showRead =
            mine &&
            !pending &&
            !failed &&
            peerLastReadMs > 0 &&
            new Date(m.createdAt).getTime() <= peerLastReadMs;
          const reactionRollup = rollupReactions(m.reactions ?? [], currentUserId);
          return (
            <div key={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("relative max-w-[75%]", mine ? "items-end" : "items-start")}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionFor((id) => (id === m.id ? null : m.id));
                    setReactPickerFor(null);
                  }}
                  className={cn(
                    "cursor-pointer rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900",
                    pending && "opacity-70",
                    failed && "ring-2 ring-red-400",
                  )}
                >
                  {m.replyTo && (
                    <div
                      className={cn(
                        "mb-1.5 rounded-md border-l-4 px-2 py-1 text-xs",
                        mine
                          ? "border-brand-200 bg-brand-700/40"
                          : "border-violet-400 bg-white/70",
                      )}
                    >
                      <p className={cn("font-semibold", mine ? "text-brand-100" : "text-violet-700")}>
                        {m.replyTo.sender.name || "Message"}
                      </p>
                      <p className="line-clamp-2 opacity-90">
                        {m.replyTo.deletedAt ? (
                          <em>Original message deleted</em>
                        ) : m.replyTo.attachmentUrl && !m.replyTo.body ? (
                          <em>
                            {m.replyTo.attachmentMime?.startsWith("audio/")
                              ? "🎤 Voice note"
                              : m.replyTo.attachmentMime?.startsWith("video/")
                              ? "🎬 Video"
                              : m.replyTo.attachmentMime?.startsWith("image/")
                              ? "📷 Image"
                              : "📎 File"}
                          </em>
                        ) : (
                          m.replyTo.body
                        )}
                      </p>
                    </div>
                  )}

                  {!deleted && m.attachmentUrl && (
                    <AttachmentView
                      url={m.attachmentUrl}
                      mime={m.attachmentMime ?? ""}
                      name={m.attachmentName ?? ""}
                      size={m.attachmentSize ?? 0}
                      mine={mine}
                    />
                  )}

                  {deleted ? (
                    <p className="italic opacity-70">This message was deleted</p>
                  ) : m.body ? (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  ) : null}

                  <p
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px]",
                      mine ? "text-brand-100" : "text-gray-500",
                    )}
                  >
                    {failed ? (
                      <span className="text-red-200">Failed</span>
                    ) : pending ? (
                      <span>Sending…</span>
                    ) : (
                      <>
                        {m.editedAt && !deleted && <span className="italic opacity-80">edited</span>}
                        <span>{timeAgo(m.createdAt)}</span>
                        {mine && !deleted && (
                          <span aria-label={showRead ? "Read" : "Delivered"} title={showRead ? "Read" : "Delivered"}>
                            {showRead ? <DoubleCheck color="#7dd3fc" /> : <DoubleCheck color="rgba(255,255,255,0.6)" />}
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>

                {reactionRollup.length > 0 && (
                  <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
                    {reactionRollup.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReaction(m, r.emoji);
                        }}
                        className={cn(
                          "rounded-full border bg-white px-1.5 py-0.5 text-[11px] shadow-sm",
                          r.mine ? "border-violet-400" : "border-ink-200",
                        )}
                      >
                        <span>{r.emoji}</span>
                        <span className="ml-1 text-[10px] text-ink-600">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {actionFor === m.id && !pending && !failed && !deleted && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute z-20 mt-1 flex flex-col rounded-lg border border-ink-200 bg-white py-1 text-xs shadow-lg",
                      mine ? "right-0 top-full" : "left-0 top-full",
                    )}
                  >
                    <button
                      type="button"
                      className="px-3 py-1.5 text-left text-ink-700 hover:bg-ink-50"
                      onClick={() => {
                        setReactPickerFor(m.id);
                        setActionFor(null);
                      }}
                    >
                      React
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-left text-ink-700 hover:bg-ink-50"
                      onClick={() => startReply(m)}
                    >
                      Reply
                    </button>
                    {canEdit(m) && (
                      <button
                        type="button"
                        className="px-3 py-1.5 text-left text-ink-700 hover:bg-ink-50"
                        onClick={() => startEdit(m)}
                      >
                        Edit
                      </button>
                    )}
                    {mine && (
                      <button
                        type="button"
                        className="px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
                        onClick={() => deleteMessage(m)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}

                {reactPickerFor === m.id && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute z-20 mt-1 flex gap-1 rounded-full border border-ink-200 bg-white px-2 py-1 shadow-lg",
                      mine ? "right-0 top-full" : "left-0 top-full",
                    )}
                  >
                    {REACTION_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="text-lg transition hover:scale-125"
                        onClick={() => toggleReaction(m, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t px-4 py-1 text-xs text-ink-500" aria-live="polite">
        {peerTyping.length > 0 ? <span className="italic">Typing…</span> : <span>&nbsp;</span>}
      </div>

      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-t bg-violet-50/60 px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            {editing ? (
              <>
                <p className="font-semibold text-violet-700">Editing</p>
                <p className="line-clamp-1 text-ink-700">{editing.original}</p>
              </>
            ) : replyTo ? (
              <>
                <p className="font-semibold text-violet-700">
                  Replying to {replyTo.sender.name || "message"}
                </p>
                <p className="line-clamp-1 text-ink-700">
                  {replyTo.attachmentUrl && !replyTo.body
                    ? replyTo.attachmentMime?.startsWith("audio/")
                      ? "🎤 Voice note"
                      : replyTo.attachmentMime?.startsWith("video/")
                      ? "🎬 Video"
                      : replyTo.attachmentMime?.startsWith("image/")
                      ? "📷 Image"
                      : "📎 File"
                    : replyTo.body}
                </p>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (editing) cancelEdit();
              else setReplyTo(null);
            }}
            className="rounded-full px-2 py-1 text-ink-500 hover:bg-ink-100"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {uploadError && (
        <p className="border-t bg-red-50 px-3 py-1 text-xs text-red-700">{uploadError}</p>
      )}

      {/* Recording overlay sits in place of the normal composer. */}
      {recording ? (
        <div className="flex items-center gap-3 border-t bg-red-50 p-3">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm text-red-700">
            {formatDuration(recording.elapsedMs)}
          </span>
          <span className="flex-1 text-xs text-red-600">Recording voice note…</span>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="btn-primary text-xs"
          >
            Send
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
          <label htmlFor="chat-input" className="sr-only">
            Type a message
          </label>
          {!editing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFilePick}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-full p-2 text-ink-500 hover:bg-ink-100 disabled:opacity-50"
                aria-label="Attach file"
                title="Attach file"
              >
                {uploading ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                ) : (
                  "📎"
                )}
              </button>
              <button
                type="button"
                onClick={startRecording}
                disabled={uploading}
                className="rounded-full p-2 text-ink-500 hover:bg-ink-100 disabled:opacity-50"
                aria-label="Record voice note"
                title="Record voice note"
              >
                🎤
              </button>
            </>
          )}
          <input
            id="chat-input"
            ref={inputRef}
            className="input flex-1"
            placeholder={editing ? "Edit your message…" : "Type a message…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Type a message"
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={sending || !body.trim()}
            aria-label={editing ? "Save edit" : "Send message"}
          >
            {editing ? "Save" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}

function AttachmentView({
  url,
  mime,
  name,
  size,
  mine,
}: {
  url: string;
  mime: string;
  name: string;
  size: number;
  mine: boolean;
}) {
  if (mime.startsWith("image/")) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url} alt="" className="mb-1 max-h-72 rounded-lg object-cover" />
    );
  }
  if (mime.startsWith("audio/")) {
    return (
      <audio
        controls
        src={url}
        preload="metadata"
        className="mb-1 w-full min-w-[180px] max-w-[260px]"
      />
    );
  }
  if (mime.startsWith("video/")) {
    return (
      <video
        controls
        src={url}
        preload="metadata"
        className="mb-1 max-h-64 w-full max-w-[280px] rounded-lg"
      />
    );
  }
  // Generic file card.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "mb-1 flex max-w-[280px] items-center gap-3 rounded-lg px-3 py-2 text-sm",
        mine ? "bg-brand-700/40 hover:bg-brand-700/60" : "bg-white/80 hover:bg-white",
      )}
    >
      <span className="text-2xl">{iconFor(mime, name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name || "Attachment"}</span>
        <span className={cn("block text-[11px]", mine ? "text-brand-100" : "text-ink-500")}>
          {formatBytes(size)}
        </span>
      </span>
    </a>
  );
}

function DoubleCheck({ color }: { color: string }) {
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" aria-hidden="true" className="inline-block align-middle">
      <path d="M0.5 5.5L4 9L11.5 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M4 5.5L7.5 9L15 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function rollupReactions(reactions: Reaction[], currentUserId: string) {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.userId === currentUserId) cur.mine = true;
    byEmoji.set(r.emoji, cur);
  }
  return Array.from(byEmoji.entries()).map(([emoji, v]) => ({ emoji, ...v }));
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(n: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(mime: string, name: string): string {
  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) return "📄";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z")) return "🗜️";
  if (mime.includes("spreadsheet") || mime.includes("excel") || /\.xls/.test(name)) return "📊";
  if (mime.includes("word") || mime.includes("document") || /\.docx?$/.test(name)) return "📝";
  if (mime.includes("presentation") || /\.pptx?$/.test(name)) return "📽️";
  return "📎";
}
