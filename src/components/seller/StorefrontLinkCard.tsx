"use client";

import { useEffect, useState } from "react";

// "Your storefront link" card for the seller dashboard. Anyone who opens this
// link sees only this seller's products and can only buy from them.
export function StorefrontLinkCard({ handle }: { handle: string }) {
  const [url, setUrl] = useState(`/shop/${handle}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}/shop/${handle}`);
  }, [handle]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is still selectable */
    }
  }

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Your storefront link</p>
      <p className="mt-1 text-sm text-ink-600">
        Share this link anywhere. People who open it see only your products and buy straight from you.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="input min-w-0 flex-1 text-sm"
          aria-label="Your storefront link"
        />
        <button type="button" onClick={copy} className="btn-primary text-sm">
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={`/shop/${handle}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
          Open
        </a>
      </div>
    </div>
  );
}
