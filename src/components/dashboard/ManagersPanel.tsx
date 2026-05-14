"use client";

import { useEffect, useState } from "react";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@/lib/managers";
import { timeAgo } from "@/lib/utils";

type Manager = {
  id: string;
  manager: { id: string; name: string; email: string; createdAt: string };
  permissions: PermissionKey[];
  createdAt: string;
};

export function ManagersPanel({ scope }: { scope: "seller" | "designer" }) {
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Show only the permission keys that make sense for this dashboard.
  // (Designer dashboard hides "manage_orders", seller dashboard hides "post" etc.)
  const RELEVANT: Record<typeof scope, PermissionKey[]> = {
    seller: ["edit_products", "manage_orders", "manage_promotions", "reply_messages", "view_wallet"],
    designer: ["post", "edit_post", "use_sketch_studio", "edit_products", "reply_messages", "view_wallet"],
  };
  const relevant = RELEVANT[scope];

  async function refresh() {
    const res = await fetch("/api/managers");
    if (res.ok) {
      const data = await res.json();
      setManagers(data.managers);
    }
  }
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card animate-pulse p-10 text-sm text-ink-500">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">
          Add a {scope === "seller" ? "shop manager" : "account manager"} so they can help
          you run your {scope === "seller" ? "store" : "portfolio"}. They&apos;ll get their
          own login and only the actions you check below.
        </p>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New manager"}
        </button>
      </div>

      {showForm && <CreateForm relevant={relevant} onDone={() => { setShowForm(false); refresh(); }} />}

      {managers && managers.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">No managers yet.</div>
      ) : (
        <ul className="space-y-3">
          {managers?.map((m) => (
            <ManagerRow key={m.id} m={m} relevant={relevant} onChange={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateForm({
  relevant,
  onDone,
}: {
  relevant: PermissionKey[];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<PermissionKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(key: PermissionKey) {
    setPerms((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create manager.");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h3 className="font-display text-base font-semibold">New manager</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Temporary password</label>
          <input
            type="text"
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Share with them in person — they can change it later"
          />
        </div>
      </div>
      <div>
        <p className="label">Permissions</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {relevant.map((key) => {
            const checked = perms.includes(key);
            return (
              <li key={key}>
                <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs ${checked ? "border-violet-500 bg-violet-50/40" : "border-ink-200"}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => toggle(key)}
                  />
                  <span>
                    <span className="block font-semibold">{PERMISSION_LABELS[key]}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      {err && <p className="text-sm text-burgundy-700">{err}</p>}
      <button type="submit" className="btn-primary" disabled={busy || perms.length === 0}>
        {busy ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}

function ManagerRow({
  m,
  relevant,
  onChange,
}: {
  m: Manager;
  relevant: PermissionKey[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [perms, setPerms] = useState<PermissionKey[]>(m.permissions);
  const [busy, setBusy] = useState(false);

  function toggle(k: PermissionKey) {
    setPerms((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }
  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/managers/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      if (res.ok) {
        setEditing(false);
        onChange();
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm(`Revoke ${m.manager.name}'s manager access?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/managers/${m.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{m.manager.name}</p>
          <p className="text-xs text-ink-500">
            {m.manager.email} · added {timeAgo(m.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost text-xs" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <button type="button" className="btn-danger text-xs" onClick={remove} disabled={busy}>
            Revoke
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(editing ? relevant : m.permissions).map((k) => {
          if (editing) {
            const on = perms.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                className={on ? "chip-active text-[11px]" : "chip text-[11px]"}
              >
                {PERMISSION_LABELS[k]}
              </button>
            );
          }
          return (
            <span key={k} className="badge bg-violet-50 text-violet-700">
              {PERMISSION_LABELS[k]}
            </span>
          );
        })}
        {!editing && m.permissions.length === 0 && (
          <span className="text-xs italic text-ink-400">No permissions granted.</span>
        )}
      </div>
      {editing && (
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn-primary text-xs" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </li>
  );
}
