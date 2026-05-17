"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettingDefinition } from "@/lib/settings";

type Row = {
  def: SettingDefinition;
  source: "db" | "env" | "unset";
  value: string;
  hasValue: boolean;
};

export function SettingsEditor({
  initial,
  groups,
}: {
  initial: Row[];
  groups: string[];
}) {
  const router = useRouter();
  // `dirty` holds pending edits keyed by setting key. Secrets are tracked
  // separately so we don't accidentally re-submit the "•••" masked value
  // back to the server.
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function set(key: string, value: string) {
    setDirty((cur) => ({ ...cur, [key]: value }));
  }
  function reset(key: string) {
    setDirty((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });
  }

  async function save() {
    const updates = Object.entries(dirty).map(([key, value]) => ({ key, value }));
    if (updates.length === 0) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Couldn't save." });
        return;
      }
      const ok = data.results.filter((r: { ok: boolean }) => r.ok).length;
      const failed = data.results.length - ok;
      setMsg({
        kind: failed > 0 ? "err" : "ok",
        text:
          failed > 0
            ? `${ok} saved, ${failed} failed.`
            : `${ok} setting${ok === 1 ? "" : "s"} updated.`,
      });
      setDirty({});
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const rows = initial.filter((r) => r.def.group === group);
        return (
          <section key={group} className="card overflow-hidden">
            <header className="border-b border-ink-100 px-5 py-3">
              <h2 className="font-display text-base font-semibold">{group}</h2>
            </header>
            <ul className="divide-y divide-ink-100">
              {rows.map((row) => (
                <li key={row.def.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`s-${row.def.key}`} className="text-sm font-medium">
                        {row.def.label}
                      </label>
                      <p className="font-mono text-[10px] text-ink-400">{row.def.key}</p>
                      {row.def.help && (
                        <p className="mt-1 max-w-xl text-xs text-ink-500">{row.def.help}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SourcePill source={row.source} hasValue={row.hasValue} />
                    </div>
                  </div>
                  <Field row={row} dirty={dirty[row.def.key]} onChange={(v) => set(row.def.key, v)} onReset={() => reset(row.def.key)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border border-ink-200 bg-white/95 p-3 backdrop-blur">
        {msg && (
          <p
            className={`text-sm ${
              msg.kind === "ok" ? "text-emerald-accent" : "text-burgundy-700"
            }`}
          >
            {msg.text}
          </p>
        )}
        <p className="text-xs text-ink-500">
          {Object.keys(dirty).length === 0
            ? "No pending changes."
            : `${Object.keys(dirty).length} pending change${
                Object.keys(dirty).length === 1 ? "" : "s"
              }.`}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={busy || Object.keys(dirty).length === 0}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({
  row,
  dirty,
  onChange,
  onReset,
}: {
  row: Row;
  dirty: string | undefined;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const kind = row.def.kind;
  const value = dirty ?? row.value;

  if (kind === "boolean") {
    const on = value === "1" || value === "true";
    return (
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-pressed={on}
          onClick={() => onChange(on ? "0" : "1")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            on ? "bg-violet-600" : "bg-ink-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-xs text-ink-500">{on ? "Enabled" : "Disabled"}</span>
        {dirty !== undefined && (
          <button type="button" className="text-xs text-violet-700" onClick={onReset}>Revert</button>
        )}
      </div>
    );
  }

  const inputType = kind === "secret" ? "password" : kind === "number" || kind === "percent" ? "number" : "text";
  const placeholder =
    kind === "secret" && !dirty && row.hasValue ? "(secret set — paste new value to change)" : undefined;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        id={`s-${row.def.key}`}
        type={inputType}
        className="input flex-1 min-w-[200px] font-mono text-sm"
        value={dirty ?? (kind === "secret" ? "" : value)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {kind === "percent" && (
        <span className="text-xs text-ink-500">
          bps · {Number(value || "0") / 100}%
        </span>
      )}
      {dirty !== undefined && (
        <button type="button" className="text-xs text-violet-700" onClick={onReset}>Revert</button>
      )}
    </div>
  );
}

function SourcePill({ source, hasValue }: { source: "db" | "env" | "unset"; hasValue: boolean }) {
  if (source === "db") return <span className="badge bg-violet-50 text-violet-700">DB override</span>;
  if (source === "env" && hasValue) return <span className="badge bg-ink-50 text-ink-700">env fallback</span>;
  return <span className="badge bg-amber-50 text-amber-700">Unset</span>;
}
