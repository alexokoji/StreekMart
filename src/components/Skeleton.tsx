import { type CSSProperties, type ReactNode } from "react";

// Tiny CSS-shimmer skeleton primitive. Drop into any spot a spinner used
// to live so the layout settles immediately on first paint. The shimmer
// animation lives globally in app/globals.css to avoid styled-jsx churn.
export function Skeleton({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-md bg-ink-100 ${className}`}
      style={style}
      aria-hidden
    >
      {children}
    </div>
  );
}

// Pre-shaped variants for the recurring layouts.
export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden p-0">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}