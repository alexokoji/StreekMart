// Time helpers safe to import from both server components and "use client"
// modules. Keep this file dependency-free so it stays cheap to include.

// Epoch ms for the next UTC midnight. Used by the flash-sales rail to
// drive a per-day urgency countdown without a per-product end column.
export function endOfTodayMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}