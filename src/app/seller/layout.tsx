import { Sidebar } from "@/components/layout/Sidebar";
import { requireUser } from "@/lib/auth";
import { Permission } from "@/lib/enums";

// Shopify-inspired layout for sellers — every route under /seller is gated.
const NAV = [
  { href: "/seller", label: "Dashboard", matchExact: true },
  { href: "/seller/products", label: "Products", matchExact: true },
  { href: "/seller/products/new", label: "Add Product" },
  { href: "/seller/orders/active", label: "Active Orders" },
  { href: "/seller/orders/completed", label: "Completed Orders" },
  { href: "/seller/wallet", label: "Wallet" },
  { href: "/seller/managers", label: "Shop managers" },
  { href: "/seller/verification", label: "Verification" },
  { href: "/messages", label: "Messages" },
  { href: "/seller/settings", label: "Account settings" },
];

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  await requireUser(Permission.SELLER);
  // Stack on mobile (sidebar collapses into a drawer + trigger bar);
  // side-by-side on md+ where the sidebar is an inline column.
  return (
    <div className="md:flex md:gap-6">
      <Sidebar title="Seller" items={NAV} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
