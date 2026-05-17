// Client-safe pieces of the manager / rider permission system.
//
// PERMISSION_KEYS + PERMISSION_LABELS + the PermissionKey type + the pure
// `parsePermissions` helper. No prisma here — keeping it pure lets client
// components like ManagersPanel + the rider dashboard render without
// dragging the libsql driver into the browser bundle.
//
// The DB-touching helpers (listManagedAccounts, listRiderOwnerIds,
// hasManagerPermission, resolveActingOwner) live in src/lib/managersServer.ts.

// The full vocabulary of permissions. Add to this list to expand what
// managers can do; UI checkboxes generate from PERMISSION_KEYS.
export const PERMISSION_KEYS = [
  // Seller-side
  "edit_products",
  "manage_orders",
  "manage_promotions",
  // Designer-side
  "post",
  "edit_post",
  "use_sketch_studio",
  // Shared
  "reply_messages",
  "view_wallet",
  // Delivery rider — pick up + drop off orders, post tracking updates.
  // Granted automatically when a manager is created with role="rider".
  "manage_deliveries",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  edit_products: "Add / edit products",
  manage_orders: "Manage orders",
  manage_promotions: "Run promotions",
  post: "Publish portfolio posts",
  edit_post: "Edit / delete posts",
  use_sketch_studio: "Use the Sketch Studio",
  reply_messages: "Reply to messages",
  view_wallet: "View the wallet (read-only)",
  manage_deliveries: "Pick up & confirm deliveries",
};

// Parse the JSON column on Manager.permissionsJson into a typed array.
// Pure — usable from client + server.
export function parsePermissions(json: string): PermissionKey[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is PermissionKey =>
      (PERMISSION_KEYS as readonly string[]).includes(k),
    );
  } catch {
    return [];
  }
}
