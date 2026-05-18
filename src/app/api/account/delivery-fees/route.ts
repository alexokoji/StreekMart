import { NextResponse } from "next/server";

// Delivery rates are now admin-controlled — see /admin/delivery and
// /api/admin/delivery-fees/[userId]. This route used to let sellers edit
// their own rates; left in place as a 403 so old client code surfaces the
// change instead of silently 404-ing.
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "Delivery rates are managed by StreekMart admins. Contact support if your rates need to change.",
    },
    { status: 403 },
  );
}
