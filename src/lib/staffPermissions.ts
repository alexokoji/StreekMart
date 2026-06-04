// Canonical list of admin-area permissions a staff member can be granted.
//
// A super-admin (`User.isAdmin: true`) implicitly has every permission and
// the staff perm list is ignored on their account. A staffer
// (`User.isStaff: true`) only gets the operations listed in their
// `staffPermissionsJson` JSON array.
//
// When adding a new admin route, pick the closest existing permission
// instead of inventing a new one — keep the list small enough that an
// admin can sanely tick the right boxes from memory.

import { parseJsonArray } from "./utils";

export const ADMIN_PERMISSIONS = {
  // Verification requests (Tier 2/3) + role-change requests. Both are
  // user-state decisions and the same person usually triages both queues.
  MANAGE_VERIFICATIONS: "manage-verifications",
  // Direct user moderation: suspend, set tier, flip roles, mark
  // affiliated, delete.
  MANAGE_USERS: "manage-users",
  // Business-name change requests.
  MANAGE_BUSINESS_NAMES: "manage-business-names",
  // Promotion approvals + rejections.
  MANAGE_PROMOTIONS: "manage-promotions",
  // Product moderation (hide / unhide listings).
  MANAGE_PRODUCTS: "manage-products",
  // Delivery cities + per-zone fees.
  MANAGE_DELIVERY: "manage-delivery",
  // Email broadcasts to user cohorts.
  MANAGE_EMAIL: "manage-email",
  // Platform-wide settings (commission %, escrow defaults, etc.).
  MANAGE_SETTINGS: "manage-settings",
  // Adding / removing other staff (gated tighter than the rest — only
  // super-admins should have this, but we expose it so a trusted senior
  // staffer can be delegated to onboard new staff).
  MANAGE_STAFF: "manage-staff",
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] =
  Object.values(ADMIN_PERMISSIONS);

// Human labels used by the staff editor's permission checkboxes.
export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, { title: string; desc: string }> = {
  "manage-verifications": {
    title: "Verifications & role changes",
    desc: "Approve or reject Tier 2/3 verification requests and role-change requests.",
  },
  "manage-users": {
    title: "User moderation",
    desc: "Suspend, set tier, flip roles, mark affiliated, delete users.",
  },
  "manage-business-names": {
    title: "Business name changes",
    desc: "Decide on business-name change requests.",
  },
  "manage-promotions": {
    title: "Promotions",
    desc: "Approve or reject paid product promotions.",
  },
  "manage-products": {
    title: "Product moderation",
    desc: "Hide listings reported as off-policy.",
  },
  "manage-delivery": {
    title: "Delivery",
    desc: "Edit delivery cities and platform-wide delivery fees.",
  },
  "manage-email": {
    title: "Email broadcasts",
    desc: "Send announcement emails to user cohorts.",
  },
  "manage-settings": {
    title: "Platform settings",
    desc: "Commission, escrow, and other platform-level toggles.",
  },
  "manage-staff": {
    title: "Staff management",
    desc: "Add or remove other staff and edit their permissions.",
  },
};

/**
 * Returns true if the given user (admin or staff) is authorised for the
 * given permission. When `permission` is undefined we require full
 * super-admin status — used by the staff-management endpoints to refuse
 * a non-admin from giving themselves more permissions.
 */
export function hasAdminAccess(
  user: { isAdmin?: boolean; isStaff?: boolean; staffPermissionsJson?: string } | null | undefined,
  permission?: AdminPermission,
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!user.isStaff) return false;
  if (!permission) return false;
  const perms = parseJsonArray(user.staffPermissionsJson ?? "[]") as string[];
  return perms.includes(permission);
}

/**
 * Normalise + validate an incoming permissions list (e.g. from a PATCH
 * body). Drops anything that isn't one of our canonical strings and
 * de-dupes, so the stored value stays canonical.
 */
export function sanitisePermissions(input: unknown): AdminPermission[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<AdminPermission>();
  for (const v of input) {
    if (typeof v === "string" && (ALL_ADMIN_PERMISSIONS as string[]).includes(v)) {
      out.add(v as AdminPermission);
    }
  }
  return Array.from(out);
}
