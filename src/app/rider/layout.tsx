import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { requireUser } from "@/lib/auth";
import { listRiderOwnerIds } from "@/lib/managers";

const NAV = [
  { href: "/rider", label: "Active deliveries", matchExact: true },
  { href: "/rider/completed", label: "Completed" },
];

// Layout for the delivery-rider surface. Any logged-in user can technically
// hit the URL, but if they aren't a rider for at least one seller we bounce
// them to the home page — saves them from a "no deliveries" empty state on
// a page that doesn't belong to them.
export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const owners = await listRiderOwnerIds(user.id);
  if (owners.length === 0) redirect("/");
  return (
    <div className="md:flex md:gap-6">
      <Sidebar title="Rider" items={NAV} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
