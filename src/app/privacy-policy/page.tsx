import { LegalDocument } from "@/components/legal/LegalDocument";
import { LEGAL_DOCS } from "@/lib/legalContent";

export const metadata = { title: "Privacy Policy · StreekMart" };

// The text lives in src/lib/legalContent.ts so the website and the app show
// exactly the same document.
export default function PrivacyPolicyPage() {
  return <LegalDocument doc={LEGAL_DOCS.privacy} />;
}
