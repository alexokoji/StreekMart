import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { MarkAllReadButton } from "./MarkAllReadButton";

// /account/notifications -- inbox showing every push notification we've
// sent the user. Rows tagged as unread render with a small dot; tapping
// a row clears the dot (handled by the MarkAllReadButton + per-row link
// hitting /api/notifications PATCH).
export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-ink-600">
            {unread === 0 ? "All caught up." : `${unread} unread`}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </div>
      {rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-500">
          Nothing yet. We&rsquo;ll log order updates, messages, and verification decisions here.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span
                  className={
                    n.readAt
                      ? "mt-2 inline-block h-2 w-2 rounded-full bg-ink-200"
                      : "mt-2 inline-block h-2 w-2 rounded-full bg-violet-500"
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-ink-400">{timeAgo(n.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{n.body}</p>
                  {n.link && (
                    <Link href={n.link} className="mt-2 inline-block text-sm text-violet-700 hover:underline">
                      Open
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}