import { SmartSearchClient } from "./SmartSearchClient";

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart search</h1>
        <p className="text-sm text-gray-600">
          Describe what you&apos;re looking for in plain English — &ldquo;a relaxed white button-down for summer&rdquo; or &ldquo;something I can wear to a wedding under $200&rdquo;.
        </p>
      </div>
      <SmartSearchClient initialQuery={searchParams.q ?? ""} />
    </div>
  );
}
