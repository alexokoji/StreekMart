import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
  hasAdminAccess,
} from "@/lib/staffPermissions";
import { Permission } from "@/lib/enums";

// Top-level sidebar items. Each carries the `perm` it gates on so the
// layout can filter the nav based on the viewer's permissions — staffers
// only see the queues they can actually act on.
const NAV: Array<{
  href: string;
  label: string;
  matchExact?: boolean;
  perm?: AdminPermission;
}> = [
  { href: "/admin", label: "Overview", matchExact: true },
  { href: "/admin/users", label: "Users", perm: ADMIN_PERMISSIONS.MANAGE_USERS },
  { href: "/admin/verifications", label: "Verifications", perm: ADMIN_PERMISSIONS.MANAGE_VERIFICATIONS },
  { href: "/admin/role-changes", label: "Role changes", perm: ADMIN_PERMISSIONS.MANAGE_VERIFICATIONS },
  { href: "/admin/products", label: "Products", perm: ADMIN_PERMISSIONS.MANAGE_PRODUCTS },
  { href: "/admin/orders", label: "Orders", perm: ADMIN_PERMISSIONS.MANAGE_USERS },
  { href: "/admin/refunds", label: "Refunds", perm: ADMIN_PERMISSIONS.MANAGE_USERS },
  { href: "/admin/promotions", label: "Promotions", perm: ADMIN_PERMISSIONS.MANAGE_PROMOTIONS },
  { href: "/admin/business-names", label: "Business names", perm: ADMIN_PERMISSIONS.MANAGE_BUSINESS_NAMES },
  { href: "/admin/delivery", label: "Delivery rates", perm: ADMIN_PERMISSIONS.MANAGE_DELIVERY },
  { href: "/admin/delivery-cities", label: "Delivery cities", perm: ADMIN_PERMISSIONS.MANAGE_DELIVERY },
  { href: "/admin/locations", label: "Locations", perm: ADMIN_PERMISSIONS.MANAGE_DELIVERY },
  { href: "/admin/payouts", label: "Payouts", perm: ADMIN_PERMISSIONS.MANAGE_USERS },
  { href: "/admin/email", label: "Email broadcasts", perm: ADMIN_PERMISSIONS.MANAGE_EMAIL },
  { href: "/admin/email-marketing", label: "Email marketing", perm: ADMIN_PERMISSIONS.MANAGE_EMAIL },
  { href: "/admin/fees", label: "Platform fees", perm: ADMIN_PERMISSIONS.MANAGE_DELIVERY },
  { href: "/admin/settings", label: "Site settings", perm: ADMIN_PERMISSIONS.MANAGE_SETTINGS },
  { href: "/admin/staff", label: "Staff", perm: ADMIN_PERMISSIONS.MANAGE_STAFF },
];

// Strip the `perm` field before passing to <Sidebar /> (which doesn't know
// about admin permissions and only needs href/label/matchExact).
function stripPerm(items: typeof NAV) {
  return items.map(({ perm: _drop, ...rest }) => rest);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Anyone who's either a super-admin OR holds at least one scoped admin
  // permission can enter /admin. Pages they don't have specific access for
  // still redirect them out via their own `requireAdmin(perm)` call.
  const isAdmin = user.isAdmin === true;
  const isStaff = user.isStaff === true;
  if (!isAdmin && !isStaff) redirect("/unauthorized");
  const staffPerms = isStaff
    ? (parseJsonArray(user.staffPermissionsJson ?? "[]") as AdminPermission[])
    : [];
  if (!isAdmin && staffPerms.length === 0) {
    // Staff flag set but no permissions granted — render the layout shell
    // with just the overview link so the staffer sees a friendly "no
    // queues yet" state instead of a redirect loop.
  }

  const visible = NAV.filter((item) => {
    if (!item.perm) return true;
    return hasAdminAccess(
      { isAdmin, isStaff, staffPermissionsJson: JSON.stringify(staffPerms) },
      item.perm,
    );
  });

  return (
    <div className="md:flex md:gap-6">
      <Sidebar title="Admin" items={stripPerm(visible)} isAdmin showAdminLink={false} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Silence the unused-import lint for Permission — kept available for
// future buyer/seller cross-references in the sidebar.
void Permission;
