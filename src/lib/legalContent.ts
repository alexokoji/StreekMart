// Legal and help content, shared by the website pages and the app (served by
// /api/legal/[doc]). One source of truth, so the two can never disagree.
// Block types: h2 / h3 headings, p paragraph, li list item.

export type LegalBlock = { t: "h2" | "h3" | "p" | "li"; x: string };
export type LegalDoc = { title: string; updated: string; blocks: LegalBlock[] };
export type Faq = { q: string; a: string };

export const LEGAL_UPDATED = "27 November 2026";
export const SUPPORT_EMAIL = "support@streekmart.com";

export const LEGAL_DOCS: Record<"privacy" | "terms", LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    updated: LEGAL_UPDATED,
    blocks: [
      {
        "t": "h2",
        "x": "1. Introduction"
      },
      {
        "t": "p",
        "x": "StreekMart (\"we,\" \"us,\" \"our,\" or \"Company\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services."
      },
      {
        "t": "p",
        "x": "Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Services."
      },
      {
        "t": "h2",
        "x": "2. Information We Collect"
      },
      {
        "t": "h3",
        "x": "2.1 Information You Provide Directly"
      },
      {
        "t": "li",
        "x": "Account registration information (name, email, phone number, location)"
      },
      {
        "t": "li",
        "x": "Profile information (business name, bio, profile picture)"
      },
      {
        "t": "li",
        "x": "Payment and billing information"
      },
      {
        "t": "li",
        "x": "Shipping and delivery addresses"
      },
      {
        "t": "li",
        "x": "Product listings and descriptions"
      },
      {
        "t": "li",
        "x": "Customer reviews and ratings"
      },
      {
        "t": "li",
        "x": "Communications with sellers/buyers"
      },
      {
        "t": "li",
        "x": "Customer support inquiries"
      },
      {
        "t": "h3",
        "x": "2.2 Information Collected Automatically"
      },
      {
        "t": "li",
        "x": "Device information (IP address, browser type, operating system)"
      },
      {
        "t": "li",
        "x": "Usage data (pages visited, time spent, clicks, searches)"
      },
      {
        "t": "li",
        "x": "Cookies and similar tracking technologies"
      },
      {
        "t": "li",
        "x": "Location information (with your consent)"
      },
      {
        "t": "h2",
        "x": "3. How We Use Your Information"
      },
      {
        "t": "li",
        "x": "To provide and improve our services"
      },
      {
        "t": "li",
        "x": "To process transactions and send related information"
      },
      {
        "t": "li",
        "x": "To create and manage your account"
      },
      {
        "t": "li",
        "x": "To send promotional emails (with your consent)"
      },
      {
        "t": "li",
        "x": "To respond to your inquiries and requests"
      },
      {
        "t": "li",
        "x": "To monitor and analyze usage patterns and trends"
      },
      {
        "t": "li",
        "x": "To detect and prevent fraudulent transactions"
      },
      {
        "t": "li",
        "x": "To comply with legal obligations"
      },
      {
        "t": "h2",
        "x": "4. Sharing Your Information"
      },
      {
        "t": "p",
        "x": "We may share your information in the following circumstances:"
      },
      {
        "t": "li",
        "x": "With sellers/buyers to complete transactions"
      },
      {
        "t": "li",
        "x": "With payment processors and logistics providers"
      },
      {
        "t": "li",
        "x": "With service providers who assist in our operations"
      },
      {
        "t": "li",
        "x": "When required by law or legal process"
      },
      {
        "t": "li",
        "x": "To protect our rights and the safety of our users"
      },
      {
        "t": "h2",
        "x": "5. Data Security"
      },
      {
        "t": "p",
        "x": "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your information."
      },
      {
        "t": "h2",
        "x": "6. Your Rights and Choices"
      },
      {
        "t": "li",
        "x": "Access your personal data"
      },
      {
        "t": "li",
        "x": "Correct inaccurate information"
      },
      {
        "t": "li",
        "x": "Request deletion of your data"
      },
      {
        "t": "li",
        "x": "Opt-out of marketing communications"
      },
      {
        "t": "li",
        "x": "Control cookie preferences"
      },
      {
        "t": "p",
        "x": "To exercise any of these rights, please contact us at the information provided below."
      },
      {
        "t": "h2",
        "x": "7. Cookies"
      },
      {
        "t": "p",
        "x": "We use cookies and similar tracking technologies to enhance your browsing experience and analyze site usage. You can control cookie preferences through your browser settings."
      },
      {
        "t": "h2",
        "x": "8. Third-Party Links"
      },
      {
        "t": "p",
        "x": "Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. Please review their privacy policies before providing any personal information."
      },
      {
        "t": "h2",
        "x": "9. Children's Privacy"
      },
      {
        "t": "p",
        "x": "Our Services are not directed to children under 13 years of age. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will take steps to delete such information."
      },
      {
        "t": "h2",
        "x": "10. Changes to This Privacy Policy"
      },
      {
        "t": "p",
        "x": "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the \"Last updated\" date. Your continued use of the Services following any changes constitutes your acceptance of the new Privacy Policy."
      },
      {
        "t": "h2",
        "x": "11. Contact Us"
      },
      {
        "t": "p",
        "x": "If you have questions about this Privacy Policy or our privacy practices, please contact us at:"
      },
      {
        "t": "p",
        "x": "StreekMart"
      },
      {
        "t": "p",
        "x": "Email: privacy@streekmart.com"
      },
      {
        "t": "p",
        "x": "Website: www.streekmart.com"
      }
    ],
  },
  terms: {
    title: "Terms and Conditions",
    updated: LEGAL_UPDATED,
    blocks: [
      {
        "t": "h2",
        "x": "1. Agreement to Terms"
      },
      {
        "t": "p",
        "x": "By accessing and using StreekMart (\"the Platform\"), you accept and agree to be bound by and abide by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service."
      },
      {
        "t": "h2",
        "x": "2. Use License"
      },
      {
        "t": "p",
        "x": "Permission is granted to temporarily download one copy of the materials (information or software) on StreekMart for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:"
      },
      {
        "t": "li",
        "x": "Modifying or copying the materials"
      },
      {
        "t": "li",
        "x": "Using the materials for any commercial purpose or for any public display"
      },
      {
        "t": "li",
        "x": "Attempting to decompile or reverse engineer any software contained on the Platform"
      },
      {
        "t": "li",
        "x": "Removing any copyright or other proprietary notations from the materials"
      },
      {
        "t": "li",
        "x": "Transferring the materials to another person or \"mirroring\" the materials on any other server"
      },
      {
        "t": "li",
        "x": "Violating any applicable laws or regulations"
      },
      {
        "t": "li",
        "x": "Engaging in any conduct that restricts or inhibits anyone's use or enjoyment of the Platform"
      },
      {
        "t": "h2",
        "x": "3. Disclaimer of Warranties"
      },
      {
        "t": "p",
        "x": "The materials on StreekMart are provided on an \"as is\" basis. StreekMart makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights."
      },
      {
        "t": "h2",
        "x": "4. Limitations of Liability"
      },
      {
        "t": "p",
        "x": "In no event shall StreekMart or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on StreekMart, even if StreekMart or an authorized representative has been notified orally or in writing of the possibility of such damage."
      },
      {
        "t": "h2",
        "x": "5. Accuracy of Materials"
      },
      {
        "t": "p",
        "x": "The materials appearing on StreekMart could include technical, typographical, or photographic errors. StreekMart does not warrant that any of the materials on the Platform are accurate, complete, or current. StreekMart may make changes to the materials contained on the Platform at any time without notice."
      },
      {
        "t": "h2",
        "x": "6. Links"
      },
      {
        "t": "p",
        "x": "StreekMart has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by StreekMart of the site. Use of any such linked website is at the user's own risk."
      },
      {
        "t": "h2",
        "x": "7. Modifications to Terms"
      },
      {
        "t": "p",
        "x": "StreekMart may revise these terms of service for the Platform at any time without notice. By using the Platform, you are agreeing to be bound by the then current version of these terms of service."
      },
      {
        "t": "h2",
        "x": "8. Governing Law"
      },
      {
        "t": "p",
        "x": "These terms and conditions are governed by and construed in accordance with the laws of applicable jurisdiction, and you irrevocably submit to the exclusive jurisdiction of the courts in that location."
      },
      {
        "t": "h2",
        "x": "9. User Accounts"
      },
      {
        "t": "p",
        "x": "When you create an account on StreekMart, you must provide accurate, complete, and current information. You are responsible for:"
      },
      {
        "t": "li",
        "x": "Maintaining the confidentiality of your password"
      },
      {
        "t": "li",
        "x": "All activities that occur under your account"
      },
      {
        "t": "li",
        "x": "Notifying StreekMart immediately of any unauthorized use of your account"
      },
      {
        "t": "h2",
        "x": "10. User Conduct"
      },
      {
        "t": "p",
        "x": "You agree not to engage in any conduct that:"
      },
      {
        "t": "li",
        "x": "Is illegal or promotes illegal activity"
      },
      {
        "t": "li",
        "x": "Is abusive, harassing, threatening, or defamatory"
      },
      {
        "t": "li",
        "x": "Infringes on intellectual property rights"
      },
      {
        "t": "li",
        "x": "Attempts to gain unauthorized access to the Platform"
      },
      {
        "t": "li",
        "x": "Interferes with or disrupts the normal functioning of the Platform"
      },
      {
        "t": "li",
        "x": "Involves the transmission of spam or malicious code"
      },
      {
        "t": "li",
        "x": "Involves fraudulent or deceptive practices"
      },
      {
        "t": "h2",
        "x": "11. Content and Intellectual Property"
      },
      {
        "t": "p",
        "x": "By posting content on StreekMart, you grant StreekMart a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content. You represent and warrant that:"
      },
      {
        "t": "li",
        "x": "You own or have the right to license the content you post"
      },
      {
        "t": "li",
        "x": "The content does not violate any third-party rights"
      },
      {
        "t": "li",
        "x": "The content is accurate and not misleading"
      },
      {
        "t": "h2",
        "x": "12. Product Listings and Transactions"
      },
      {
        "t": "p",
        "x": "Sellers are responsible for:"
      },
      {
        "t": "li",
        "x": "Accurate and complete product descriptions"
      },
      {
        "t": "li",
        "x": "Compliance with all applicable laws and regulations"
      },
      {
        "t": "li",
        "x": "Timely fulfillment of orders"
      },
      {
        "t": "li",
        "x": "Quality and condition of products shipped"
      },
      {
        "t": "p",
        "x": "Buyers are responsible for:"
      },
      {
        "t": "li",
        "x": "Providing accurate shipping information"
      },
      {
        "t": "li",
        "x": "Reviewing product descriptions carefully before purchase"
      },
      {
        "t": "li",
        "x": "Communicating any issues with sellers promptly"
      },
      {
        "t": "h2",
        "x": "13. Payment and Refunds"
      },
      {
        "t": "p",
        "x": "Payment processing is handled by third-party payment providers. StreekMart is not responsible for payment processing errors or unauthorized charges. Refund policies are determined by sellers, but all refunds must comply with applicable consumer protection laws."
      },
      {
        "t": "h2",
        "x": "14. Dispute Resolution"
      },
      {
        "t": "p",
        "x": "Any disputes arising from your use of the Platform shall be resolved through mutual agreement or arbitration as determined by StreekMart. StreekMart shall make reasonable efforts to mediate disputes between buyers and sellers."
      },
      {
        "t": "h2",
        "x": "15. Termination"
      },
      {
        "t": "p",
        "x": "StreekMart reserves the right to terminate or suspend your account at any time for violation of these terms, fraudulent activity, or any other reason deemed appropriate at StreekMart's sole discretion."
      },
      {
        "t": "h2",
        "x": "16. Limitation of Liability"
      },
      {
        "t": "p",
        "x": "To the fullest extent permitted by law, StreekMart shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data, arising from your use of the Platform."
      },
      {
        "t": "h2",
        "x": "17. Contact Information"
      },
      {
        "t": "p",
        "x": "If you have any questions about these Terms and Conditions, please contact us at:"
      },
      {
        "t": "p",
        "x": "StreekMart"
      },
      {
        "t": "p",
        "x": "Email: support@streekmart.com"
      },
      {
        "t": "p",
        "x": "Website: www.streekmart.com"
      }
    ],
  },
};

export const SUPPORT_FAQS: Faq[] = [
  {
    "q": "Where’s my order?",
    "a": "Open My orders, tap the order, and you'll see live delivery updates from the seller. Every order also has a delivery code you'll share with the rider on arrival. If the code is blank, payment hasn't cleared yet."
  },
  {
    "q": "A buyer paid but I (the seller) haven’t been credited.",
    "a": "Wallet credit clears once the buyer confirms delivery with the delivery code OR after the delivery window elapses (14 days from payment). Until then, your share sits in escrow on the order row."
  },
  {
    "q": "How do I get the blue check / gold check?",
    "a": "Submit Tier 2 verification (NIN, Passport, or Driver's License) from your seller or designer dashboard for the blue check. Tier 3 (gold) adds CAC documents and lifts your listing cap to 100 and your withdrawal fee to 1.5%."
  },
  {
    "q": "My buyer wants a colour / size I didn’t list.",
    "a": "Add it to the product's Variants panel from the edit page — the picker shows up on the product page and on the order, so you know exactly what to pack."
  },
  {
    "q": "I downloaded the Android APK but it won’t install.",
    "a": "On Android, allow installs from unknown sources for your browser (Settings → Apps → Browser → Install unknown apps). Once installed, future updates push themselves over-the-air automatically."
  },
  {
    "q": "Can I delete my account?",
    "a": "Yes. In the app, open Account and tap Delete my data; on the website use the Data deletion page. You confirm with your email and your account and data are removed. Settle any open orders first. Admin accounts can\'t be deleted this way."
  }
];
