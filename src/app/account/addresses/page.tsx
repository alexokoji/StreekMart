import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AddressEditor } from "./AddressEditor";

// /account/addresses - manage delivery addresses for the buyer flow.
// Backed by /api/account/addresses (already exists). The kind filter
// limits the page to DELIVERY rows; sellers still configure PICKUP
// addresses from the seller dashboard.
export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await prisma.address.findMany({
    where: { userId: user.id, kind: "DELIVERY" },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Delivery addresses</h1>
        <p className="text-sm text-ink-600">
          Add the addresses you ship to. The default address is preselected at checkout.
        </p>
      </div>
      <AddressEditor
        initial={addresses.map((a) => ({
          id: a.id,
          label: a.label ?? "",
          phone: a.phone ?? "",
          formattedAddress: a.formattedAddress,
          city: a.city ?? "",
          region: a.region ?? "",
          country: a.country ?? "",
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}