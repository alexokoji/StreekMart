import { SmartSearchClient } from "./SmartSearchClient";
import { Band, PageCanvas, PageHead } from "@/components/storefront/Band";

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return (
    <PageCanvas>
      <PageHead
        eyebrow="Find anything"
        title="Smart search"
        subtitle="Describe what you're looking for in plain English — “a relaxed white button-down for summer” or “something I can wear to a wedding”."
        backHref="/"
        backLabel="Back home"
      />
      <Band tone="base">
        <SmartSearchClient initialQuery={searchParams.q ?? ""} />
      </Band>
    </PageCanvas>
  );
}
