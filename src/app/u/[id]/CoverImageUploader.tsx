"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Minimal owner-only control overlaid on the profile cover.
//
// Tapping the chip opens the file picker. The selected image is uploaded
// to /api/upload (same endpoint as avatars / product photos), then the
// returned URL is PATCHed onto the user's profile as `coverImageUrl`.
// On success the page refreshes server-side so the new banner renders.
export function CoverImageUploader({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || typeof upData.url !== "string") {
        setErr(upData.error ?? "Couldn't upload that image.");
        return;
      }

      const patchRes = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImageUrl: upData.url }),
      });
      const patchData = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) {
        setErr(patchData.error ?? "Saved the upload but couldn't update your profile.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-ink-800 shadow-sm backdrop-blur hover:bg-white disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 16l5-5 5 5 3-3 5 5" />
          <circle cx="9" cy="9" r="1.5" fill="currentColor" />
        </svg>
        {busy
          ? "Uploading…"
          : initialUrl
            ? "Change cover"
            : "Add cover image"}
      </button>
      {err && (
        <p className="rounded-md bg-burgundy-900/80 px-2 py-0.5 text-[10px] text-white">
          {err}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
