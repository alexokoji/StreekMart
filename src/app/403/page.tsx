import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">403 — Forbidden</h1>
      <p className="mt-2 text-gray-600">You don&apos;t have access to that page.</p>
      <Link href="/" className="btn-primary mt-6 inline-flex">Go home</Link>
    </div>
  );
}
