"use client";

import { useEffect, useRef, useState } from "react";

// Share popover for shareable surfaces (profile pages, products, posts).
//
// Behaviour:
//   - Tries `navigator.share()` first on mobile (native share sheet).
//   - Otherwise opens a small popover with: copy link, WhatsApp, X (Twitter),
//     Facebook, LinkedIn, email, and a QR code for in-person sharing.
//
// Pass `path` as a server-relative URL ("/u/seoul-threads"); the component
// resolves the absolute origin client-side so links carry the correct host.

type Props = {
  path: string;
  title: string;
  text?: string;
};

export function ShareButton({ path, title, text }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Compute the absolute URL on the client so it always reflects the
  // current origin (works on localhost dev, preview deploys, prod, etc.).
  const [absoluteUrl, setAbsoluteUrl] = useState(path);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAbsoluteUrl(window.location.origin + path);
    }
  }, [path]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers without async clipboard — no-op fallback.
    }
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      setOpen(true);
      return;
    }
    try {
      await navigator.share({ url: absoluteUrl, title, text });
    } catch {
      // user cancelled — open the popover so they can still pick a channel
      setOpen(true);
    }
  }

  const enc = encodeURIComponent;
  const targets = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${enc(`${title}\n${absoluteUrl}`)}`,
      icon: WaIcon,
    },
    {
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(absoluteUrl)}`,
      icon: XIcon,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(absoluteUrl)}`,
      icon: FbIcon,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(absoluteUrl)}`,
      icon: LiIcon,
    },
    {
      label: "Email",
      href: `mailto:?subject=${enc(title)}&body=${enc((text ? text + "\n\n" : "") + absoluteUrl)}`,
      icon: MailIcon,
    },
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={nativeShare}
        className="btn-secondary text-sm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ShareGlyph className="h-4 w-4" />
        Share
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-ink-100 bg-white p-3 shadow-soft"
        >
          {/* URL row */}
          <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1.5">
            <span className="line-clamp-1 flex-1 px-1.5 text-xs text-ink-600">
              {absoluteUrl.replace(/^https?:\/\//, "")}
            </span>
            <button
              type="button"
              onClick={copy}
              className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Social targets */}
          <ul className="mt-2 grid grid-cols-5 gap-1">
            {targets.map((t) => {
              const Icon = t.icon;
              return (
                <li key={t.label}>
                  <a
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 rounded-lg p-2 text-[10px] text-ink-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    title={`Share to ${t.label}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{t.label.split(" ")[0]}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          {/* QR toggle */}
          <button
            type="button"
            onClick={() => setShowQR((v) => !v)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white py-1.5 text-xs font-semibold text-ink-700 hover:border-violet-400 hover:text-violet-700"
          >
            {showQR ? "Hide QR code" : "Show QR code"}
          </button>
          {showQR && (
            <div className="mt-2 rounded-lg border border-ink-100 bg-white p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=12&data=${enc(absoluteUrl)}`}
                alt="QR code linking to the profile"
                width={180}
                height={180}
                className="mx-auto"
              />
              <p className="mt-1 text-[10px] text-ink-500">
                Scan to open the profile.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- icons (small inline SVGs so we don't ship an icon package) ---

function ShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#25D366">
      <path d="M20.5 3.5A11.6 11.6 0 0 0 12.1 0C5.7 0 .6 5.1.6 11.5c0 2 .5 4 1.5 5.7L0 24l7-1.8a11.5 11.5 0 0 0 5.1 1.2h.01c6.4 0 11.6-5.1 11.6-11.5 0-3-1.2-5.9-3.2-8.4zM12.1 21.4h-.01a9.6 9.6 0 0 1-4.9-1.3l-.4-.2-4.1 1.1 1.1-4-.3-.4a9.6 9.6 0 0 1-1.5-5.1c0-5.3 4.3-9.6 9.6-9.6a9.6 9.6 0 0 1 9.6 9.6c0 5.3-4.3 9.6-9.6 9.6z" />
      <path d="M17.4 14c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2 0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.7 4.1.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z" fill="#fff" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function FbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073" />
    </svg>
  );
}

function LiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0A66C2">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.91 1.65-1.86 3.39-1.86 3.62 0 4.29 2.39 4.29 5.49v6.26zM5.34 7.43a2.06 2.06 0 0 1-2.06-2.07c0-1.14.92-2.07 2.06-2.07a2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.55v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
