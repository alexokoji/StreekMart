import { cn } from "@/lib/utils";

// Verification-tier badge. Tier 1 renders nothing; Tier 2 shows the blue
// check; Tier 3 the gold check. Two presentations: `inline` (small tick
// glued next to a username) and `pill` (chip with a "Verified" / "Gold"
// label for profile headers).

export type TierBadgeProps = {
  tier: number | null | undefined;
  variant?: "inline" | "pill";
  className?: string;
};

export function TierBadge({ tier, variant = "inline", className }: TierBadgeProps) {
  if (!tier || tier < 2) return null;
  const isGold = tier >= 3;

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          isGold
            ? "bg-gold-100 text-gold-700 ring-1 ring-gold-300"
            : "bg-sky-100 text-sky-700 ring-1 ring-sky-300",
          className,
        )}
        aria-label={isGold ? "Gold verified" : "Verified"}
        title={isGold ? "Gold verified" : "Verified"}
      >
        <CheckMark gold={isGold} />
        {isGold ? "Gold" : "Verified"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center align-middle",
        isGold ? "text-gold-500" : "text-sky-500",
        className,
      )}
      aria-label={isGold ? "Gold verified" : "Verified"}
      title={isGold ? "Gold verified" : "Verified"}
    >
      <CheckMark gold={isGold} />
    </span>
  );
}

function CheckMark({ gold }: { gold: boolean }) {
  // Solid circular tick like Instagram's verified badge. Single inline SVG
  // so a tier badge never causes a layout shift waiting for an icon font.
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
      fill="currentColor"
      className={cn(gold ? "drop-shadow-sm" : undefined)}
    >
      <path d="M12 2l2.4 1.8 3 .3 1.5 2.6 2.5 1.7-.6 3 .6 3-2.5 1.7-1.5 2.6-3 .3L12 22l-2.4-1.8-3-.3L5.1 17.3 2.6 15.6l.6-3-.6-3L5.1 6.9 6.6 4.3l3-.3L12 2zm-1.4 13.2l5.7-5.7-1.4-1.4-4.3 4.3-1.9-1.9-1.4 1.4 3.3 3.3z" />
    </svg>
  );
}
