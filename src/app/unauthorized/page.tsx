import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function UnauthorizedPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto mt-16 max-w-lg card p-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Permission required
      </p>
      <h1 className="mt-2 text-3xl font-bold">You don&apos;t have access to that area.</h1>
      <p className="mt-3 text-gray-600">
        That page is reserved for users with a specific permission (Seller or Designer).
        You can enable additional permissions any time from your account settings.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="btn-secondary">Back to storefront</Link>
        {user && (
          <Link href="/account" className="btn-primary">Manage permissions</Link>
        )}
      </div>
    </div>
  );
}
