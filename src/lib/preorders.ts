// Preorder status machine + small format helpers.
//
//   PENDING_PAYMENT    → AWAITING_READY (webhook flips on design paid)
//   AWAITING_READY     → READY          (designer marks ready)
//   READY              → AWAITING_SHIPMENT (webhook flips on delivery paid)
//   AWAITING_SHIPMENT  → SHIPPED        (designer ships via existing flow)
//   SHIPPED            → COMPLETED      (buyer confirms with delivery code)
//   ANY state          → CANCELLED      (either party, with reason)
//
// Each transition has an actor and the allowed next states. Anything else
// is a 400. The state machine is intentionally simple — no quote step
// like commissions, because the post's `preorderPriceCents` is the
// agreement.

export const PreorderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  AWAITING_READY: "AWAITING_READY",
  READY: "READY",
  AWAITING_SHIPMENT: "AWAITING_SHIPMENT",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type PreorderStatusValue =
  (typeof PreorderStatus)[keyof typeof PreorderStatus];

export type PreorderActor = "buyer" | "designer";

// Allowed transitions per actor. Payment-driven transitions (PENDING_PAYMENT
// → AWAITING_READY, READY → AWAITING_SHIPMENT) aren't in this map — they
// happen via the webhook, not a manual PATCH.
const TRANSITIONS: Record<
  PreorderStatusValue,
  Partial<Record<PreorderActor, PreorderStatusValue[]>>
> = {
  PENDING_PAYMENT: {
    buyer: ["CANCELLED"],
    designer: ["CANCELLED"],
  },
  AWAITING_READY: {
    designer: ["READY", "CANCELLED"],
    buyer: ["CANCELLED"],
  },
  READY: {
    designer: ["CANCELLED"],
    buyer: ["CANCELLED"],
  },
  AWAITING_SHIPMENT: {
    designer: ["SHIPPED", "CANCELLED"],
    buyer: ["CANCELLED"],
  },
  SHIPPED: {
    buyer: ["COMPLETED"],
  },
  COMPLETED: {},
  CANCELLED: {},
};

export function canTransition(
  current: PreorderStatusValue | string,
  actor: PreorderActor,
  next: PreorderStatusValue,
): boolean {
  return !!TRANSITIONS[current as PreorderStatusValue]?.[actor]?.includes(next);
}

// Friendly status label used by the dashboard, emails, and chips.
export function preorderStatusLabel(status: string): string {
  switch (status) {
    case PreorderStatus.PENDING_PAYMENT:
      return "Awaiting payment";
    case PreorderStatus.AWAITING_READY:
      return "In production";
    case PreorderStatus.READY:
      return "Ready — pay delivery";
    case PreorderStatus.AWAITING_SHIPMENT:
      return "Awaiting shipment";
    case PreorderStatus.SHIPPED:
      return "Shipped";
    case PreorderStatus.COMPLETED:
      return "Completed";
    case PreorderStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
}

export function preorderStatusChipClass(status: string): string {
  switch (status) {
    case PreorderStatus.PENDING_PAYMENT:
      return "bg-amber-100 text-amber-800";
    case PreorderStatus.AWAITING_READY:
      return "bg-violet-100 text-violet-800";
    case PreorderStatus.READY:
      return "bg-sky-100 text-sky-800";
    case PreorderStatus.AWAITING_SHIPMENT:
      return "bg-violet-100 text-violet-800";
    case PreorderStatus.SHIPPED:
      return "bg-emerald-100 text-emerald-800";
    case PreorderStatus.COMPLETED:
      return "bg-gold-100 text-gold-800";
    case PreorderStatus.CANCELLED:
      return "bg-ink-100 text-ink-600";
    default:
      return "bg-ink-100 text-ink-600";
  }
}

// 6-digit numeric delivery code. Same format as the regular Order flow
// and the commission flow.
export function generatePreorderDeliveryCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Verified Tier 2/3 designers skip escrow on the design payment — the net
// lands straight in their withdrawable wallet so they can buy materials.
// Tier 1 (unverified) designers' funds are held until completion to
// protect buyers.
export function shouldSkipDesignerHold(args: {
  designerVerified: boolean;
  designerTier: number;
}): boolean {
  return args.designerVerified && args.designerTier >= 2;
}
