export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

          <p className="text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              UpClo ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
            <p className="text-gray-700">
              Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2.1 Information You Provide Directly</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Account registration information (name, email, phone number, location)</li>
              <li>Profile information (business name, bio, profile picture)</li>
              <li>Payment and billing information</li>
              <li>Shipping and delivery addresses</li>
              <li>Product listings and descriptions</li>
              <li>Customer reviews and ratings</li>
              <li>Communications with sellers/buyers</li>
              <li>Customer support inquiries</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Usage data (pages visited, time spent, clicks, searches)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Location information (with your consent)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>To provide and improve our services</li>
              <li>To process transactions and send related information</li>
              <li>To create and manage your account</li>
              <li>To send promotional emails (with your consent)</li>
              <li>To respond to your inquiries and requests</li>
              <li>To monitor and analyze usage patterns and trends</li>
              <li>To detect and prevent fraudulent transactions</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Sharing Your Information</h2>
            <p className="text-gray-700 mb-4">
              We may share your information in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>With sellers/buyers to complete transactions</li>
              <li>With payment processors and logistics providers</li>
              <li>With service providers who assist in our operations</li>
              <li>When required by law or legal process</li>
              <li>To protect our rights and the safety of our users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Data Security</h2>
            <p className="text-gray-700">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Your Rights and Choices</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Control cookie preferences</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise any of these rights, please contact us at the information provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Cookies</h2>
            <p className="text-gray-700">
              We use cookies and similar tracking technologies to enhance your browsing experience and analyze site usage. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Third-Party Links</h2>
            <p className="text-gray-700">
              Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. Please review their privacy policies before providing any personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Children's Privacy</h2>
            <p className="text-gray-700">
              Our Services are not directed to children under 13 years of age. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Changes to This Privacy Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of the Services following any changes constitutes your acceptance of the new Privacy Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Contact Us</h2>
            <p className="text-gray-700">
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg mt-4">
              <p className="text-gray-700 font-semibold mb-2">StreekMart</p>
              <p className="text-gray-700">Email: privacy@streekmart.com</p>
              <p className="text-gray-700">Website: www.streekmart.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
