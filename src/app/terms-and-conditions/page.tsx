import { LegalDocument } from "@/components/legal/LegalDocument";
import { LEGAL_DOCS } from "@/lib/legalContent";

export const metadata = { title: "Terms and Conditions · StreekMart" };

// The text lives in src/lib/legalContent.ts so the website and the app show
// exactly the same document.
export default function TermsPage() {
  return <LegalDocument doc={LEGAL_DOCS.terms} />;
}
