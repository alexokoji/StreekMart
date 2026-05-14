"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Reusable image input.
//
// Three input methods:
//   1. Drop image files onto the surface.
//   2. Click "Choose files" to pick from disk (multi-select if `multi`).
//   3. Paste an image URL into the URL field and press "Add".
//
// The component is fully controlled: pass `value` (the current list of URLs)
// and `onChange` to receive updates. For single-image use cases (avatars),
// pass `multi={false}` and the array will hold at most one URL.

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  // Cap how many images the field allows (defaults to 8 for multi, 1 for single).
  max?: number;
  // Override the dropzone label (e.g. "Drop your avatar here").
  label?: string;
};

const DEFAULT_MULTI_MAX = 8;

export function ImageUploader({
  value,
  onChange,
  multi = true,
  max,
  label,
}: Props) {
  const limit = max ?? (multi ? DEFAULT_MULTI_MAX : 1);
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function add(urls: string[]) {
    const trimmed = urls.map((u) => u.trim()).filter(Boolean);
    if (trimmed.length === 0) return;
    const next = multi
      ? [...value, ...trimmed].slice(0, limit)
      : [trimmed[0]]; // single-image overwrites
    onChange(next);
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (!multi && files.length > 1) {
      // Single-image: keep just the first file the user picked.
      files.splice(1);
    }
    setErr(null);
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const f of files) {
        if (value.length + uploaded.length >= limit) break;
        const url = await uploadOne(f);
        if (url) uploaded.push(url);
      }
      if (uploaded.length > 0) add(uploaded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadOne(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? `Upload failed (${res.status})`);
    }
    return typeof data.url === "string" ? data.url : null;
  }

  function onUrlAdd() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/uploads/")) {
      setErr("URL must start with http:// or https://");
      return;
    }
    setErr(null);
    add([trimmed]);
    setUrlDraft("");
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  const atLimit = value.length >= limit;

  return (
    <div className="space-y-3">
      {/* Existing images grid */}
      {value.length > 0 && (
        <ul
          className={cn(
            "grid gap-2",
            multi ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1 max-w-[160px]",
          )}
        >
          {value.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-ink-100 bg-ink-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove image"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-burgundy-700 focus:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
              {i === 0 && multi && (
                <span className="absolute left-1.5 bottom-1.5 rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  cover
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Dropzone + file picker */}
      {!atLimit && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-white px-4 py-6 text-center text-xs transition-colors",
            dragOver
              ? "border-violet-500 bg-violet-50 text-violet-700"
              : "border-ink-200 text-ink-500 hover:border-violet-400 hover:text-violet-700",
            busy && "opacity-60",
          )}
          role="button"
          aria-disabled={busy}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M3 16l5-5 5 5 3-3 5 5" />
            <circle cx="9" cy="9" r="1.5" fill="currentColor" />
          </svg>
          <p>
            <span className="font-semibold">{busy ? "Uploading…" : "Drop images here"}</span>
            <span className="hidden sm:inline"> or click to choose</span>
          </p>
          <p className="text-[10px] text-ink-400">
            JPEG · PNG · WebP · GIF · AVIF — up to 8&nbsp;MB each
            {multi && limit > 1 && ` · max ${limit} images`}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple={multi}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              // Reset so re-picking the same file fires onChange again.
              e.target.value = "";
            }}
          />
        </div>
      )}

      {atLimit && (
        <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-500">
          Image limit reached ({limit}). Remove one to add another.
        </p>
      )}

      {/* URL input — alternative to file upload */}
      {!atLimit && (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="…or paste an image URL"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onUrlAdd();
              }
            }}
            className="input text-xs"
          />
          <button
            type="button"
            onClick={onUrlAdd}
            disabled={!urlDraft.trim()}
            className="btn-secondary text-xs"
          >
            Add
          </button>
        </div>
      )}

      {err && <p className="text-xs text-burgundy-700">{err}</p>}

      {label && <p className="text-[11px] text-ink-500">{label}</p>}
    </div>
  );
}
