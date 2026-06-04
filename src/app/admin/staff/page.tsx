import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
} from "@/lib/staffPermissions";
import { StaffEditor, type StaffRow } from "./StaffEditor";

export default async function AdminStaffPage() {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_STAFF);

  const rawRows = await prisma.user.findMany({
    where: { OR: [{ isAdmin: true }, { isStaff: true }] },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      isStaff: true,
      staffPermissionsJson: true,
    },
  });
  const staff: StaffRow[] = rawRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    isStaff: u.isStaff,
    permissions: parseJsonArray(u.staffPermissionsJson) as AdminPermission[],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Staff & permissions</h1>
        <p className="text-sm text-ink-600">
          Promote existing users to staff and pick which admin areas they can
          touch. Super-admins (you) have every permission implicitly.
        </p>
      </div>
      <StaffEditor initialStaff={staff} />
    </div>
  );
}
