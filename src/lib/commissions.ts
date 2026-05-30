// Commission status machine + small format helpers.
//
// A commission's life-cycle:
//
//   REQUESTED → buyer submitted a brief; waiting for the designer.
//   QUOTED    → designer named a price + ETA.
//   ACCEPTED  → buyer accepted the quote. (V1: payment happens off-platform.
//               Buyer arranges payment via chat / bank transfer; designer
//               can flip to IN_PROGRESS once they've seen the funds.)
//   IN_PROGRESS → designer started work.
//   DELIVERED → designer marked delivery + gave the buyer a code.
//   COMPLETED → buyer confirmed delivery using the code.
//   DECLINED  → designer / buyer walked away during negotiation.
//   CANCELLED → either party cancelled after the buyer had accepted.
//
// Each transition has an actor (buyer or designer) and the allowed
// next-state set. Anything outside that is a 400. Putting the machine in
// one place keeps the API routes thin.

export const CommissionStatus = {
  REQUESTED: "REQUESTED",
  QUOTED: "QUOTED",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
} as const;
export type CommissionStatusValue = (typeof CommissionStatus)[keyof typeof CommissionStatus];

export type CommissionActor = "buyer" | "designer";

// Allowed transitions per actor. The right-hand side is the destination
// state. Anything not listed is forbidden — keeps the rules in one place
// so an extra "Cancel" button somewhere can't sneak past the API.
const TRANSITIONS: Record<
  CommissionStatusValue,
  Partial<Record<CommissionActor, CommissionStatusValue[]>>
> = {
  REQUESTED: {
    designer: ["QUOTED", "DECLINED"],
    buyer: ["CANCELLED"],
  },
  QUOTED: {
    buyer: ["ACCEPTED", "DECLINED"],
    designer: ["CANCELLED"], // designer can pull back a quote
  },
  ACCEPTED: {
    designer: ["IN_PROGRESS", "CANCELLED"],
    buyer: ["CANCELLED"],
  },
  IN_PROGRESS: {
    designer: ["DELIVERED", "CANCELLED"],
    buyer: ["CANCELLED"],
  },
  DELIVERED: {
    buyer: ["COMPLETED", "CANCELLED"],
  },
  COMPLETED: {},
  DECLINED: {},
  CANCELLED: {},
};

export function canTransition(
  current: CommissionStatusValue | string,
  actor: CommissionActor,
  next: CommissionStatusValue,
): boolean {
  return !!TRANSITIONS[current as CommissionStatusValue]?.[actor]?.includes(next);
}

export function nextStatesFor(
  current: CommissionStatusValue | string,
  actor: CommissionActor,
): CommissionStatusValue[] {
  return TRANSITIONS[current as CommissionStatusValue]?.[actor] ?? [];
}

// Friendly status label used by the dashboard and emails. Keeps the wire
// format in shouty-uppercase but the UI in title-case sentences.
export function commissionStatusLabel(status: string): string {
  switch (status) {
    case CommissionStatus.REQUESTED:
      return "Awaiting designer";
    case CommissionStatus.QUOTED:
      return "Quote received";
    case CommissionStatus.ACCEPTED:
      return "Accepted — pending start";
    case CommissionStatus.IN_PROGRESS:
      return "In progress";
    case CommissionStatus.DELIVERED:
      return "Delivered — awaiting confirmation";
    case CommissionStatus.COMPLETED:
      return "Completed";
    case CommissionStatus.DECLINED:
      return "Declined";
    case CommissionStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
}

// Tailwind chip classes per status — keeps the UI lists consistent.
export function commissionStatusChipClass(status: string): string {
  switch (status) {
    case CommissionStatus.REQUESTED:
      return "bg-amber-100 text-amber-800";
    case CommissionStatus.QUOTED:
      return "bg-sky-100 text-sky-800";
    case CommissionStatus.ACCEPTED:
    case CommissionStatus.IN_PROGRESS:
      return "bg-violet-100 text-violet-800";
    case CommissionStatus.DELIVERED:
      return "bg-emerald-100 text-emerald-800";
    case CommissionStatus.COMPLETED:
      return "bg-gold-100 text-gold-800";
    case CommissionStatus.DECLINED:
    case CommissionStatus.CANCELLED:
      return "bg-ink-100 text-ink-600";
    default:
      return "bg-ink-100 text-ink-600";
  }
}

// 6-digit numeric delivery code. Same format as the regular Order flow so
// buyers don't have to learn two patterns.
export function generateCommissionDeliveryCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
