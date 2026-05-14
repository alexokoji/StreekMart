import { requireUser } from "@/lib/auth";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
