import { Sidebar } from "@/components/layout/Sidebar";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", matchExact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/business-names", label: "Business names" },
  { href: "/admin/delivery", label: "Delivery rates" },
  { href: "/admin/delivery-cities", label: "Delivery cities" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/email", label: "Email broadcasts" },
  { href: "/admin/fees", label: "Platform fees" },
  { href: "/admin/settings", label: "Site settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Hard gate — requireAdmin redirects non-admins to /unauthorized.
  await requireAdmin();
  return (
    <div className="md:flex md:gap-6">
      {/* Already in /admin, so the drawer's Admin shortcut would be redundant —
          we still want the mobile logout button though. */}
      <Sidebar title="Admin" items={NAV} isAdmin showAdminLink={false} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
