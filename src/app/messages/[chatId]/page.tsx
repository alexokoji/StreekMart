import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { displaySellerName } from "@/lib/businessName";
import { ChatPanel } from "./ChatPanel";

export default async function ChatPage({ params }: { params: { chatId: string } }) {
  const user = await requireUser();

  const chat = await prisma.chat.findUnique({
    where: { id: params.chatId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              // Shown in the chat header — sellers see their shop name from buyers,
              // and the displaySellerName helper falls back to personal name otherwise.
              businessName: true,
              isSeller: true,
              isDesigner: true,
            },
          },
        },
      },
    },
  });
  if (!chat || !chat.participants.some((p) => p.userId === user.id)) notFound();

  const other = chat.participants.find((p) => p.userId !== user.id)?.user;

  const initialMessages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
    // Prisma returns all scalar columns by default, so attachmentName/size
    // already arrive without an explicit select. The include below is for
    // the joined relations only.
    include: {
      sender: { select: { id: true, name: true, isSeller: true, isDesigner: true } },
      reactions: { select: { id: true, emoji: true, userId: true } },
      replyTo: {
        select: {
          id: true,
          body: true,
          senderId: true,
          deletedAt: true,
          attachmentUrl: true,
          attachmentMime: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/messages" className="text-sm text-brand-700 hover:underline">← All conversations</Link>
        {other && (
          <p className="font-medium">
            {displaySellerName(other)}{" "}
            <span className="text-xs text-gray-500">
              ({[other.isSeller && "seller", other.isDesigner && "designer", "buyer"].filter(Boolean).join(" · ")})
            </span>
          </p>
        )}
      </div>
      <ChatPanel
        chatId={chat.id}
        currentUserId={user.id}
        initialMessages={initialMessages}
        peerName={other ? displaySellerName(other) : ""}
      />
    </div>
  );
}
