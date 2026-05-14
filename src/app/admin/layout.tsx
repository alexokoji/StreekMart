import { Sidebar } from "@/components/layout/Sidebar";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", matchExact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/fees", label: "Platform fees" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Hard gate — requireAdmin redirects non-admins to /unauthorized.
  await requireAdmin();
  return (
    <div className="md:flex md:gap-6">
      <Sidebar title="Admin" items={NAV} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
