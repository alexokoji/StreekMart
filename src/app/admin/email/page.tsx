import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isEmailEnabled } from "@/lib/email";
import { timeAgo } from "@/lib/utils";
import { BroadcastForm } from "./BroadcastForm";

// /admin/email — compose a broadcast + see recent send history.
export default async function AdminEmailPage() {
  await requireAdmin();
  const live = isEmailEnabled();
  const recent = await prisma.emailBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Email broadcasts</h1>
        <p className="text-sm text-ink-600">
          Send announcements, policy updates, or marketing to a chosen audience. Every
          send is logged below.
        </p>
        {!live && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Stub mode.</strong> RESEND_API_KEY isn&apos;t set — sends will log
            to the server console instead of going out. Drop the key into env to go live.
          </p>
        )}
      </div>

      <BroadcastForm />

      <section className="card overflow-hidden">
        <header className="border-b border-ink-100 p-4">
          <h2 className="font-display text-base font-semibold">Recent broadcasts</h2>
        </header>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No broadcasts sent yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2 text-right">Sent / Total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {recent.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium">{b.subject}</td>
                  <td className="px-4 py-2 text-xs">{b.audience}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {b.sentCount} / {b.recipientCount}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`badge ${
                        b.status === "SENT"
                          ? "bg-emerald-50 text-emerald-accent"
                          : b.status === "PARTIAL"
                          ? "bg-amber-50 text-amber-700"
                          : b.status === "FAILED"
                          ? "bg-burgundy-50 text-burgundy-700"
                          : "bg-ink-50 text-ink-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-500">{timeAgo(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
