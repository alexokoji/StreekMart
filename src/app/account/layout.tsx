import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileCompletionBanner } from "@/components/layout/ProfileCompletionBanner";
import { requireUser } from "@/lib/auth";

// Buyer dashboard layout. Mirrors the seller/designer layouts: a sidebar on
// the left (drawer on mobile) and a single content column on the right.
//
// Note: middleware already gates /account/* on auth, but `requireUser()` is
// the canonical guard for server components — keeping it here means anyone
// who lands inside this layout is guaranteed to have a session.
const NAV = [
  { href: "/account", label: "Dashboard", matchExact: true },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wallet", label: "Refund wallet" },
  { href: "/cart", label: "Cart" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/favorites", label: "Saved posts" },
  { href: "/messages", label: "Messages" },
  { href: "/account/settings", label: "Account settings" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="md:flex md:gap-6">
      <Sidebar title="Account" items={NAV} isAdmin={user.isAdmin} />
      <div className="min-w-0 flex-1">
        <ProfileCompletionBanner
          isSeller={user.isSeller}
          phone={user.phone}
          businessName={user.businessName}
          settingsHref="/account/settings"
        />
        {children}
      </div>
    </div>
  );
}
