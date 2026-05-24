export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms and Conditions</h1>

          <p className="text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700">
              By accessing and using StreekMart ("the Platform"), you accept and agree to be bound by and abide by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Use License</h2>
            <p className="text-gray-700 mb-4">
              Permission is granted to temporarily download one copy of the materials (information or software) on StreekMart for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to decompile or reverse engineer any software contained on the Platform</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              <li>Violating any applicable laws or regulations</li>
              <li>Engaging in any conduct that restricts or inhibits anyone's use or enjoyment of the Platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Disclaimer of Warranties</h2>
            <p className="text-gray-700">
              The materials on StreekMart are provided on an "as is" basis. StreekMart makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Limitations of Liability</h2>
            <p className="text-gray-700">
              In no event shall StreekMart or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on StreekMart, even if StreekMart or an authorized representative has been notified orally or in writing of the possibility of such damage.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Accuracy of Materials</h2>
            <p className="text-gray-700">
              The materials appearing on StreekMart could include technical, typographical, or photographic errors. StreekMart does not warrant that any of the materials on the Platform are accurate, complete, or current. StreekMart may make changes to the materials contained on the Platform at any time without notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Links</h2>
            <p className="text-gray-700">
              StreekMart has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by StreekMart of the site. Use of any such linked website is at the user's own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Modifications to Terms</h2>
            <p className="text-gray-700">
              StreekMart may revise these terms of service for the Platform at any time without notice. By using the Platform, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Governing Law</h2>
            <p className="text-gray-700">
              These terms and conditions are governed by and construed in accordance with the laws of applicable jurisdiction, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. User Accounts</h2>
            <p className="text-gray-700 mb-4">
              When you create an account on StreekMart, you must provide accurate, complete, and current information. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Maintaining the confidentiality of your password</li>
              <li>All activities that occur under your account</li>
              <li>Notifying StreekMart immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. User Conduct</h2>
            <p className="text-gray-700 mb-4">
              You agree not to engage in any conduct that:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Is illegal or promotes illegal activity</li>
              <li>Is abusive, harassing, threatening, or defamatory</li>
              <li>Infringes on intellectual property rights</li>
              <li>Attempts to gain unauthorized access to the Platform</li>
              <li>Interferes with or disrupts the normal functioning of the Platform</li>
              <li>Involves the transmission of spam or malicious code</li>
              <li>Involves fraudulent or deceptive practices</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Content and Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              By posting content on StreekMart, you grant StreekMart a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content. You represent and warrant that:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>You own or have the right to license the content you post</li>
              <li>The content does not violate any third-party rights</li>
              <li>The content is accurate and not misleading</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Product Listings and Transactions</h2>
            <p className="text-gray-700 mb-4">
              Sellers are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Accurate and complete product descriptions</li>
              <li>Compliance with all applicable laws and regulations</li>
              <li>Timely fulfillment of orders</li>
              <li>Quality and condition of products shipped</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Buyers are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Providing accurate shipping information</li>
              <li>Reviewing product descriptions carefully before purchase</li>
              <li>Communicating any issues with sellers promptly</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Payment and Refunds</h2>
            <p className="text-gray-700 mb-4">
              Payment processing is handled by third-party payment providers. StreekMart is not responsible for payment processing errors or unauthorized charges. Refund policies are determined by sellers, but all refunds must comply with applicable consumer protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Dispute Resolution</h2>
            <p className="text-gray-700">
              Any disputes arising from your use of the Platform shall be resolved through mutual agreement or arbitration as determined by StreekMart. StreekMart shall make reasonable efforts to mediate disputes between buyers and sellers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Termination</h2>
            <p className="text-gray-700">
              StreekMart reserves the right to terminate or suspend your account at any time for violation of these terms, fraudulent activity, or any other reason deemed appropriate at StreekMart's sole discretion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">16. Limitation of Liability</h2>
            <p className="text-gray-700">
              To the fullest extent permitted by law, StreekMart shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data, arising from your use of the Platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">17. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about these Terms and Conditions, please contact us at:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700 font-semibold mb-2">StreekMart</p>
              <p className="text-gray-700">Email: support@streekmart.online</p>
              <p className="text-gray-700">Website: www.streekmart.online</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
