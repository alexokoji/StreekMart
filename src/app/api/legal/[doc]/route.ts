import { NextResponse } from "next/server";
import { LEGAL_DOCS, SUPPORT_EMAIL, SUPPORT_FAQS } from "@/lib/legalContent";

// GET /api/legal/privacy | terms | support — public. The same text the website
// pages show, as data, so the app can draw it natively instead of opening a
// web page.
export async function GET(_req: Request, { params }: { params: { doc: string } }) {
  const headers = { "Cache-Control": "public, max-age=300, s-maxage=3600" };
  if (params.doc === "privacy" || params.doc === "terms") {
    return NextResponse.json(LEGAL_DOCS[params.doc], { headers });
  }
  if (params.doc === "support") {
    return NextResponse.json({ email: SUPPORT_EMAIL, faqs: SUPPORT_FAQS }, { headers });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
