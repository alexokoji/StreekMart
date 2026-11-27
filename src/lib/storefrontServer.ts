import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { STORE_COOKIE } from "./storefront";

export type StoreLock = {
  sellerId: string;
  handle: string; // what to put in /shop/<handle>
  name: string;
  avatarUrl: string | null;
};

/**
 * The seller this visitor is locked to, if they arrived through a storefront
 * link. Null for normal marketplace visits. Resolved from the cookie on every
 * call so a renamed slug or a removed seller never leaves a stale lock.
 */
export async function getStoreLock(): Promise<StoreLock | null> {
  const raw = cookies().get(STORE_COOKIE)?.value;
  if (!raw) return null;
  const seller = await prisma.user.findFirst({
    where: { OR: [{ slug: raw }, { id: raw }], isSeller: true, suspendedAt: null },
    select: { id: true, slug: true, name: true, businessName: true, avatarUrl: true },
  });
  if (!seller) return null;
  return {
    sellerId: seller.id,
    handle: seller.slug ?? seller.id,
    name: seller.businessName?.trim() || seller.name,
    avatarUrl: seller.avatarUrl,
  };
}
