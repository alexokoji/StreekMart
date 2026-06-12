"use client";

import { useEffect, useState } from "react";

type State = {
  canClaimToday: boolean;
  streak: number;
  pointsBalance: number;
  todayPoints: number;
  weeklyBonus: number;
};

// Big claim button + streak meter shown on /account. Hits
// /api/points/check-in for both the read and the write so the streak +
// balance stay in sync with whatever the user's last claim said.
export function DailyCheckIn() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState<{ awarded: number; bonus: boolean } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/points/check-in");
      if (!res.ok) return;
      setState((await res.json()) as State);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function claim() {
    setBusy(true);
    try {
      const res = await fetch("/api/points/check-in", { method: "POST" });
      const data = await res.json();
      if (!res.ok) return;
      setJustClaimed({ awarded: data.awarded, bonus: data.bonusEarned });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  return (
    <section className="card bg-gradient-to-br from-violet-600 via-fuchsia-500 to-gold-400 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
        Daily rewards
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <span className="font-display text-3xl font-bold">{state.pointsBalance.toLocaleString()}</span>
        <span className="text-sm text-white/85">points balance</span>
      </div>
      <p className="mt-1 text-xs text-white/85">
        {state.streak > 0 ? `${state.streak}-day streak` : "Start a streak today"}
        {state.streak >= 7 && " - 50pt weekly bonus on every 7th day"}
      </p>
      <div className="mt-4">
        {justClaimed ? (
          <div className="rounded-md bg-white/15 p-3 text-sm">
            +{justClaimed.awarded} points claimed!{justClaimed.bonus && " - weekly bonus unlocked"}
          </div>
        ) : state.canClaimToday ? (
          <button onClick={claim} disabled={busy} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-violet-700">
            {busy ? "Claiming..." : `Claim today's ${state.todayPoints} points`}
          </button>
        ) : (
          <p className="text-sm text-white/85">Already claimed today &mdash; come back tomorrow.</p>
        )}
      </div>
    </section>
  );
}