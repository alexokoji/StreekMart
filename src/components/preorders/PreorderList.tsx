import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import {
  preorderStatusChipClass,
  preorderStatusLabel,
} from "@/lib/preorders";

export type PreorderRow = {
  id: string;
  title: string;
  counterpartyName: string;
  priceCents: number;
  status: string;
  updatedAt: Date;
};

export function PreorderList({
  rows,
  detailHref,
  emptyTitle,
  emptyBody,
}: {
  rows: PreorderRow[];
  detailHref: (id: string) => string;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="font-semibold">{emptyTitle}</p>
        <p className="mt-1 text-sm text-ink-500">{emptyBody}</p>
      </div>
    );
  }
  return (
    <ul className="card divide-y">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Link
              href={detailHref(r.id)}
              className="block break-words font-medium hover:underline"
            >
              {r.title}
            </Link>
            <p className="mt-0.5 text-xs text-ink-500">
              with {r.counterpartyName} · updated {timeAgo(r.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <p className="hidden text-sm font-semibold sm:block">
              ₦{(r.priceCents / 100).toLocaleString("en-NG")}
            </p>
            <span className={`badge ${preorderStatusChipClass(r.status)} whitespace-nowrap`}>
              {preorderStatusLabel(r.status)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
