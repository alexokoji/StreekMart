import { Sidebar } from "@/components/layout/Sidebar";
import { requireUser } from "@/lib/auth";
import { Permission } from "@/lib/enums";

const NAV = [
  { href: "/designer", label: "Dashboard", matchExact: true },
  { href: "/designer/posts", label: "Portfolio Posts", matchExact: true },
  { href: "/designer/posts/new", label: "New Post" },
  { href: "/sketch", label: "Sketch Studio", disabled: true, badge: "Coming soon" },
  { href: "/designer/products", label: "My Products", matchExact: true },
  { href: "/designer/products/new", label: "List Product" },
  { href: "/designer/wallet", label: "Wallet" },
  { href: "/designer/managers", label: "Account managers" },
  { href: "/designer/verification", label: "Verification" },
  { href: "/messages", label: "Messages" },
  { href: "/designer/settings", label: "Account settings" },
];

export default async function DesignerLayout({ children }: { children: React.ReactNode }) {
  await requireUser(Permission.DESIGNER);
  // Stack on mobile (sidebar collapses into a drawer + trigger bar);
  // side-by-side on md+ where the sidebar is an inline column.
  return (
    <div className="md:flex md:gap-6">
      <Sidebar title="Designer" items={NAV} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
