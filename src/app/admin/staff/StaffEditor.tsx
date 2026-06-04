"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_PERMISSION_LABELS,
  ALL_ADMIN_PERMISSIONS,
  type AdminPermission,
} from "@/lib/staffPermissions";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isStaff: boolean;
  permissions: AdminPermission[];
};

// Single page that:
//   - lists current staff (and super-admins, read-only)
//   - lets an admin add a new staffer by email + permission checkboxes
//   - lets an admin edit each staffer's permissions inline
//   - lets an admin demote (clear staff flag) inline
export function StaffEditor({ initialStaff }: { initialStaff: StaffRow[] }) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Add-form state
  const [addEmail, setAddEmail] = useState("");
  const [addPerms, setAddPerms] = useState<Set<AdminPermission>>(new Set());

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusyId("add");
    setErr(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addEmail.trim().toLowerCase(),
          permissions: Array.from(addPerms),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't add staff.");
        return;
      }
      setAddEmail("");
      setAddPerms(new Set());
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function savePerms(row: StaffRow, perms: AdminPermission[]) {
    setBusyId(row.id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save.");
        return;
      }
      setStaff((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, permissions: perms } : s)),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function demote(row: StaffRow) {
    if (!window.confirm(`Demote ${row.name} from staff?`)) return;
    setBusyId(row.id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Couldn't demote.");
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== row.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add */}
      <form onSubmit={add} className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Add a staffer</h2>
        <p className="text-sm text-ink-500">
          The user must already have a StreekMart account. Enter their email
          and tick the permissions they need.
        </p>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className="input"
            placeholder="staffer@example.com"
            required
          />
        </div>
        <PermissionGrid
          value={addPerms}
          onChange={(next) => setAddPerms(next)}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={busyId !== null || addEmail.length === 0}
        >
          {busyId === "add" ? "Adding…" : "Promote to staff"}
        </button>
      </form>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Existing staff */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
          Current staff ({staff.length})
        </h2>
        {staff.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-500">
            No staff yet. Add the first one above.
          </div>
        ) : (
          <ul className="space-y-3">
            {staff.map((row) => (
              <li key={row.id}>
                <StaffCard
                  row={row}
                  busy={busyId === row.id}
                  onSave={(perms) => savePerms(row, perms)}
                  onDemote={() => demote(row)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StaffCard({
  row,
  busy,
  onSave,
  onDemote,
}: {
  row: StaffRow;
  busy: boolean;
  onSave: (perms: AdminPermission[]) => void;
  onDemote: () => void;
}) {
  const [perms, setPerms] = useState<Set<AdminPermission>>(new Set(row.permissions));
  const dirty =
    perms.size !== row.permissions.length ||
    row.permissions.some((p) => !perms.has(p));

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">
            {row.name}
            {row.isAdmin && (
              <span className="ml-2 badge bg-burgundy-50 text-burgundy-700">Super-admin</span>
            )}
            {row.isStaff && !row.isAdmin && (
              <span className="ml-2 badge bg-violet-50 text-violet-700">Staff</span>
            )}
          </p>
          <p className="text-xs text-ink-500">{row.email}</p>
        </div>
        {!row.isAdmin && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary text-xs text-amber-700 hover:bg-amber-50"
              onClick={onDemote}
              disabled={busy}
            >
              Demote
            </button>
          </div>
        )}
      </div>

      {row.isAdmin ? (
        <p className="mt-3 text-xs italic text-ink-500">
          Super-admins have every permission implicitly.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <PermissionGrid value={perms} onChange={(next) => setPerms(next)} />
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => onSave(Array.from(perms))}
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : dirty ? "Save permissions" : "Saved"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionGrid({
  value,
  onChange,
}: {
  value: Set<AdminPermission>;
  onChange: (next: Set<AdminPermission>) => void;
}) {
  function toggle(p: AdminPermission) {
    const next = new Set(value);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange(next);
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ALL_ADMIN_PERMISSIONS.map((p) => {
        const meta = ADMIN_PERMISSION_LABELS[p];
        const on = value.has(p);
        return (
          <label
            key={p}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm ${
              on
                ? "border-violet-500 bg-violet-50/40"
                : "border-ink-200 bg-white hover:border-violet-300"
            }`}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => toggle(p)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="min-w-0">
              <p className="font-medium">{meta.title}</p>
              <p className="text-xs text-ink-500">{meta.desc}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
