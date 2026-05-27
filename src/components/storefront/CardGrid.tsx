import { ProductCard, type ProductCardData } from "./ProductCard";

// Shared responsive grid used by home rails and the new flash-sales /
// featured / new-arrivals landing pages.
export function CardGrid({
  items,
  savedSet,
  cols,
}: {
  items: ProductCardData[];
  savedSet: Set<string>;
  cols: 4 | 6;
}) {
  const colsClass =
    cols === 6
      ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 3xl:grid-cols-7"
      : "grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5";
  return (
    <div className={colsClass}>
      {items.map((p) => (
        <ProductCard key={p.id} p={p} saved={savedSet.has(p.id)} />
      ))}
    </div>
  );
}
