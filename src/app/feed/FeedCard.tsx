"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";

type ProductItem = {
  kind: "product";
  id: string;
  promoted: boolean;
  data: {
    id: string;
    name: string;
    price: number;
    description: string;
    imagesJson: string;
    createdAt: Date;
    likeCount: number;
    saveCount: number;
    seller: { id: string; name: string };
  };
};
type PostItem = {
  kind: "post";
  id: string;
  promoted: boolean;
  data: {
    id: string;
    title: string;
    body: string;
    imagesJson: string;
    createdAt: Date;
    likeCount: number;
    saveCount: number;
    author: { id: string; name: string };
  };
};
type Item = ProductItem | PostItem;

export function FeedCard({ item, authed, isSaved }: { item: Item; authed: boolean; isSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(isSaved);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const images = parseJsonArray(
    item.kind === "product" ? item.data.imagesJson : item.data.imagesJson,
  );
  const title = item.kind === "product" ? item.data.name : item.data.title;
  const subtitle =
    item.kind === "product" ? <Price amount={item.data.price} /> : item.data.body;
  const author = item.kind === "product" ? item.data.seller.name : item.data.author.name;
  const href = item.kind === "product" ? `/products/${item.data.id}` : `/posts/${item.data.id}`;

  async function toggle(action: "like" | "save") {
    if (!authed) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const url = action === "like" ? "/api/likes" : "/api/favorites";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
      const data = await res.json();
      if (action === "like") setLiked(!!data.liked);
      else setSaved(!!data.saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card overflow-hidden">
      <Link href={href} className="block">
        <div className="aspect-square bg-gray-100">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0]} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              {item.kind === "post" ? "Post" : "No image"}
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="font-medium hover:underline">{title}</Link>
          {item.promoted && <span className="badge bg-brand-50 text-brand-700">Promoted</span>}
        </div>
        <p className="line-clamp-2 text-sm text-gray-600">{subtitle}</p>
        <p className="mt-1 text-xs text-gray-500">
          {item.kind === "product" ? "Sold by" : "Posted by"} {author} · {timeAgo(item.data.createdAt)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggle("like")}
            disabled={busy}
            className={`btn-secondary text-xs ${liked ? "text-red-600" : ""}`}
            aria-pressed={liked}
          >
            ♥ {liked ? "Liked" : "Like"}
          </button>
          <button
            type="button"
            onClick={() => toggle("save")}
            disabled={busy}
            className={`btn-secondary text-xs ${saved ? "text-brand-700" : ""}`}
            aria-pressed={saved}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </button>
        </div>
      </div>
    </article>
  );
}
