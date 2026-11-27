"use client";

import { useEffect, useRef, useState } from "react";

type BankOption = { value: string; label: string };
type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "verified"; name: string }
  | { kind: "failed"; message: string }
  | { kind: "manual"; message: string };

export type BankFieldsValue = {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  // True when the form can be submitted: the bank confirmed the account, or
  // verification isn't available and a name was typed.
  ready: boolean;
};

// Bank + account number + account name, with the name looked up from the bank.
// The seller picks a bank and types the 10-digit number; we ask the bank who
// owns it and show that name, so a mistake in the bank or number is caught
// before any money moves. If lookups aren't available (test mode) a name can be
// typed instead.
export function BankAccountFields({
  initial,
  onChange,
}: {
  initial?: { bankCode?: string; accountNumber?: string; accountName?: string };
  onChange: (v: BankFieldsValue) => void;
}) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankCode, setBankCode] = useState(initial?.bankCode ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [typedName, setTypedName] = useState(initial?.accountName ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const seq = useRef(0);

  useEffect(() => {
    fetch("/api/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.banks && setBanks(d.banks))
      .catch(() => {});
  }, []);

  // Look the account up whenever bank + a full 10-digit number are in.
  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      setStatus({ kind: "idle" });
      return;
    }
    const mine = ++seq.current;
    setStatus({ kind: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/banks/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankCode, accountNumber }),
        });
        const d = await res.json();
        if (mine !== seq.current) return;
        if (d.ok) setStatus({ kind: "verified", name: d.accountName });
        else if (d.unavailable) setStatus({ kind: "manual", message: d.error });
        else setStatus({ kind: "failed", message: d.error ?? "Couldn't verify this account." });
      } catch {
        if (mine === seq.current) setStatus({ kind: "manual", message: "Couldn't reach the bank. Try again." });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [bankCode, accountNumber]);

  const accountName = status.kind === "verified" ? status.name : status.kind === "manual" ? typedName : "";
  const ready =
    status.kind === "verified" || (status.kind === "manual" && typedName.trim().length >= 2 && !status.message.includes("reach"));

  useEffect(() => {
    onChange({ bankCode, accountNumber, accountName, ready });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, accountNumber, accountName, ready]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="ba-bank">Bank</label>
        <select id="ba-bank" className="input" value={bankCode} onChange={(e) => setBankCode(e.target.value)} required>
          <option value="">Choose your bank</option>
          {banks.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ba-acct">Account number</label>
        <input
          id="ba-acct"
          className="input"
          inputMode="numeric"
          maxLength={10}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          required
        />
      </div>
      <div className="sm:col-span-2" aria-live="polite">
        {status.kind === "idle" && (
          <p className="text-xs text-ink-500">Pick your bank and enter the 10-digit number. We'll show the name on the account.</p>
        )}
        {status.kind === "checking" && <p className="text-sm text-ink-600">Checking with your bank…</p>}
        {status.kind === "verified" && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Account name: <strong>{status.name}</strong>. Check this is you before you save.
          </p>
        )}
        {status.kind === "failed" && (
          <p className="rounded-lg bg-burgundy-50 px-3 py-2 text-sm text-burgundy-700">{status.message}</p>
        )}
        {status.kind === "manual" && (
          <div className="space-y-2">
            <p className="text-xs text-amber-700">{status.message} Enter the account name exactly as the bank has it.</p>
            <input
              className="input"
              placeholder="Account name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              aria-label="Account name"
            />
          </div>
        )}
      </div>
    </div>
  );
}
