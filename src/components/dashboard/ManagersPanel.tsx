"use client";

import { useEffect, useState } from "react";
import { PERMISSION_LABELS, type PermissionKey } from "@/lib/managers";
import { timeAgo } from "@/lib/utils";

type Manager = {
  id: string;
  role: "manager" | "rider";
  phone: string | null;
  manager: { id: string; name: string; email: string; createdAt: string };
  permissions: PermissionKey[];
  createdAt: string;
};

export function ManagersPanel({ scope }: { scope: "seller" | "designer" }) {
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Show only the permission keys that make sense for this dashboard.
  // Riders use a separate flow — `manage_deliveries` is added automatically
  // by the API regardless of what's checked, so we keep it out of the list.
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

  const regular = managers?.filter((m) => m.role !== "rider") ?? [];
  const riders = managers?.filter((m) => m.role === "rider") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">
          Add a {scope === "seller" ? "shop manager or delivery rider" : "account manager or rider"}.
          They get their own login and only the actions you grant.
        </p>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New account"}
        </button>
      </div>

      {showForm && (
        <CreateForm
          relevant={relevant}
          onDone={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      <Section
        title="Managers"
        rows={regular}
        relevant={relevant}
        onChange={refresh}
        emptyLabel="No managers yet."
      />
      <Section
        title="Delivery riders"
        rows={riders}
        relevant={["manage_deliveries"]}
        onChange={refresh}
        emptyLabel="No riders yet. Verified sellers + designers can add a rider above."
      />
    </div>
  );
}

function Section({
  title,
  rows,
  relevant,
  onChange,
  emptyLabel,
}: {
  title: string;
  rows: Manager[];
  relevant: PermissionKey[];
  onChange: () => void;
  emptyLabel: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-500">
        {title} <span className="font-normal text-ink-400">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <div className="card p-6 text-center text-xs text-ink-500">{emptyLabel}</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <ManagerRow key={m.id} m={m} relevant={relevant} onChange={onChange} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateForm({
  relevant,
  onDone,
}: {
  relevant: PermissionKey[];
  onDone: () => void;
}) {
  const [role, setRole] = useState<"manager" | "rider">("manager");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          phone: role === "rider" ? phone || undefined : undefined,
          permissions: role === "rider" ? [] : perms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create account.");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h3 className="font-display text-base font-semibold">New account</h3>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${
            role === "manager" ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
          }`}
        >
          <input
            type="radio"
            className="mt-0.5"
            checked={role === "manager"}
            onChange={() => setRole("manager")}
          />
          <div>
            <p className="text-sm font-medium">Shop / account manager</p>
            <p className="text-xs text-ink-500">Pick exactly which actions they can take.</p>
          </div>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${
            role === "rider" ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
          }`}
        >
          <input
            type="radio"
            className="mt-0.5"
            checked={role === "rider"}
            onChange={() => setRole("rider")}
          />
          <div>
            <p className="text-sm font-medium">Delivery rider</p>
            <p className="text-xs text-ink-500">
              Logs into <code className="rounded bg-ink-50 px-1">/rider</code> to pick up,
              update tracking, and confirm with the buyer&apos;s 4-character code. Requires
              your account to be verified.
            </p>
          </div>
        </label>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
        {role === "rider" && (
          <div className="sm:col-span-2">
            <label className="label">Phone <span className="text-xs text-ink-400">(optional)</span></label>
            <input
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="So buyers can call when the rider's at the door"
              maxLength={40}
            />
          </div>
        )}
      </div>

      {role === "manager" ? (
        <div>
          <p className="label">Permissions</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {relevant.map((key) => {
              const checked = perms.includes(key);
              return (
                <li key={key}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs ${
                      checked ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
                    }`}
                  >
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
      ) : (
        <p className="rounded-lg border border-ink-200 bg-ink-50/60 p-3 text-xs text-ink-600">
          Riders get <strong>{PERMISSION_LABELS.manage_deliveries}</strong> automatically
          and nothing else — they can&apos;t see your wallet or edit products.
        </p>
      )}

      {err && <p className="text-sm text-burgundy-700">{err}</p>}
      <button
        type="submit"
        className="btn-primary"
        disabled={busy || (role === "manager" && perms.length === 0)}
      >
        {busy ? "Creating…" : role === "rider" ? "Create rider login" : "Create login"}
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
  const isRider = m.role === "rider";

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
    if (!confirm(`Revoke ${m.manager.name}'s ${isRider ? "rider" : "manager"} access?`)) return;
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
          <p className="font-semibold">
            {m.manager.name}
            {isRider && (
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-accent">
                Rider
              </span>
            )}
          </p>
          <p className="text-xs text-ink-500">
            {m.manager.email}
            {m.phone && ` · ☎ ${m.phone}`} · added {timeAgo(m.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isRider && (
            <button type="button" className="btn-ghost text-xs" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
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
