"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";
import { TierBadge } from "@/components/TierBadge";

type PostData = {
  id: string;
  title: string;
  body: string;
  images: string[];
  tags: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  promoted: boolean;
  // Preorder fields — when `preorderEnabled` is true the card renders a
  // "Preorder design" CTA right under the actions row.
  preorderEnabled?: boolean;
  preorderPriceCents?: number | null;
  preorderLeadDays?: number | null;
  author: {
    id: string;
    name: string;
    bio: string | null;
    designerVerified: boolean;
    designerTier?: number | null;
  };
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    isDesigner: boolean;
    designerVerified: boolean;
    designerTier?: number | null;
  };
};

export function PostCard({
  post,
  authed,
  initialSaved,
  initialFollowing,
  isOwn,
}: {
  post: PostData;
  authed: boolean;
  initialSaved: boolean;
  initialFollowing: boolean;
  isOwn: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [following, setFollowing] = useState(initialFollowing);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Lazy-load comments only when the section is opened.
  useEffect(() => {
    if (!showComments || comments.length > 0) return;
    setCommentsLoading(true);
    fetch(`/api/posts/${post.id}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data.comments) ? data.comments : []))
      .finally(() => setCommentsLoading(false));
  }, [showComments, comments.length, post.id]);

  function requireAuth() {
    if (!authed) {
      router.push("/login");
      return false;
    }
    return true;
  }

  async function toggleLike() {
    if (!requireAuth()) return;
    setBusyAction("like");
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post", id: post.id }),
      });
      const data = await res.json();
      const next = !!data.liked;
      setLiked(next);
      setLikeCount((c) => c + (next ? 1 : -1));
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleSave() {
    if (!requireAuth()) return;
    setBusyAction("save");
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post", id: post.id }),
      });
      const data = await res.json();
      setSaved(!!data.saved);
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleFollow() {
    if (!requireAuth()) return;
    setBusyAction("follow");
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId: post.author.id }),
      });
      const data = await res.json();
      setFollowing(!!data.following);
    } finally {
      setBusyAction(null);
    }
  }

  async function shareLink() {
    const url = typeof window !== "undefined" ? `${window.location.origin}/posts/${post.id}` : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth()) return;
    const body = commentDraft.trim();
    if (!body) return;
    setBusyAction("comment");
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setCommentDraft("");
        setCommentCount((c) => c + 1);
      }
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <article className="card overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-gold-300">
          {post.author.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {post.author.name}
            <TierBadge
              tier={post.author.designerTier ?? (post.author.designerVerified ? 2 : 1)}
              className="ml-1"
            />
            {post.promoted && <span className="ml-2 badge bg-gold-50 text-gold-700">Promoted</span>}
          </p>
          <p className="text-[11px] text-ink-500">
            {post.author.bio ?? "Independent designer"} · {timeAgo(post.createdAt)}
          </p>
        </div>
        {!isOwn && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={busyAction === "follow"}
            className={following ? "btn-secondary text-xs" : "btn-primary text-xs"}
          >
            {following ? "Following" : "+ Follow"}
          </button>
        )}
      </header>

      {/* Title + body */}
      <div className="px-4 pb-3">
        <Link href={`/posts/${post.id}`}>
          <h3 className="font-display text-lg font-semibold hover:underline">{post.title}</h3>
        </Link>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-700">{post.body}</p>
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.tags.map((t) => (
              <span key={t} className="badge bg-ink-50 text-ink-600">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Image(s) */}
      {post.images[0] && (
        <Link href={`/posts/${post.id}`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.images[0]} alt={post.title} className="w-full max-h-[36rem] object-cover" />
        </Link>
      )}
      {post.images.length > 1 && (
        <div className="grid grid-cols-3 gap-1 p-1">
          {post.images.slice(1, 4).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="aspect-square w-full object-cover" />
          ))}
        </div>
      )}

      {/* Counts */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-ink-500">
        <span>{likeCount} likes</span>
        <button type="button" onClick={() => setShowComments((v) => !v)} className="hover:underline">
          {commentCount} comment{commentCount === 1 ? "" : "s"}
        </button>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-4 gap-1 border-t border-ink-100 p-1 text-sm">
        <ActionButton onClick={toggleLike} active={liked} disabled={busyAction === "like"}>
          ♥ <span className="hidden sm:inline">Like</span>
        </ActionButton>
        <ActionButton onClick={() => setShowComments((v) => !v)}>
          💬 <span className="hidden sm:inline">Comment</span>
        </ActionButton>
        <ActionButton onClick={shareLink}>
          ↗ <span className="hidden sm:inline">Share</span>
        </ActionButton>
        <ActionButton onClick={toggleSave} active={saved} disabled={busyAction === "save"}>
          {saved ? "★" : "☆"} <span className="hidden sm:inline">Save</span>
        </ActionButton>
      </div>

      {/* Preorder CTA — when the post is preorderable, buyers see a
          prominent banner under the action bar. Designer's own post +
          unauthenticated visitors don't get the button: own-post would
          let them buy from themselves, and unauth users need to log in
          to start a preorder. */}
      {post.preorderEnabled &&
        typeof post.preorderPriceCents === "number" &&
        typeof post.preorderLeadDays === "number" &&
        !isOwn && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 bg-violet-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                Preorder design
              </p>
              <p className="text-sm font-semibold text-ink-800">
                ₦{(post.preorderPriceCents / 100).toLocaleString("en-NG")}
                <span className="ml-1.5 text-xs font-normal text-ink-500">
                  · ready in {post.preorderLeadDays} day
                  {post.preorderLeadDays === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            <Link
              href={
                authed
                  ? `/preorder/${post.id}`
                  : `/login?redirect=${encodeURIComponent(`/preorder/${post.id}`)}`
              }
              className="btn-primary text-xs"
            >
              Preorder this piece
            </Link>
          </div>
        )}

      {/* Comments */}
      {showComments && (
        <div className="space-y-3 border-t border-ink-100 p-4">
          {commentsLoading ? (
            <p className="text-xs text-ink-500">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-ink-500">Be the first to comment.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-ink-50 px-3 py-2">
                  <p className="text-xs font-semibold">
                    {c.author.name}
                    <TierBadge
                      tier={c.author.designerTier ?? (c.author.designerVerified ? 2 : 1)}
                      className="ml-1"
                    />
                  </p>
                  <p className="text-sm text-ink-800">{c.body}</p>
                  <p className="text-[10px] text-ink-400">{timeAgo(c.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={postComment} className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder={authed ? "Write a comment…" : "Log in to comment"}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              disabled={busyAction === "comment"}
            />
            <button type="submit" className="btn-primary text-xs" disabled={busyAction === "comment" || !commentDraft.trim()}>
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function ActionButton({
  onClick,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-md py-2 transition-colors ${
        active ? "bg-gold-50 text-gold-700" : "text-ink-700 hover:bg-ink-50"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
