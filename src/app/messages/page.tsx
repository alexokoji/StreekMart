import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { StartChatRedirect } from "./StartChatRedirect";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { with?: string };
}) {
  const user = await requireUser();

  // If ?with=<userId>, get-or-create a chat then redirect.
  if (searchParams.with) {
    return <StartChatRedirect withUserId={searchParams.with} />;
  }

  const chats = await prisma.chat.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, isSeller: true, isDesigner: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      {chats.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No conversations yet. Start one by messaging a seller, buyer, or designer from their profile or a product page.
        </div>
      ) : (
        <ul className="card divide-y">
          {chats.map((c) => {
            const other = c.participants.find((p) => p.userId !== user.id)?.user;
            const last = c.messages[0];
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{other?.name ?? "Unknown"}</p>
                    <p className="line-clamp-1 text-sm text-gray-600">
                      {last?.body ?? <span className="italic text-gray-400">No messages yet</span>}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{timeAgo(c.updatedAt)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
