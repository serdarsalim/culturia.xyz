export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">C</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">CULTURIA</h1>
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

        <div className="prose prose-lg">
          <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700">
              CULTURIA ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, and safeguard your personal information when you use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
            <p className="text-gray-700 mb-4">We collect the following types of information:</p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">Account Information</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Email address (when you sign up)</li>
              <li>Password (encrypted)</li>
              <li>Google account information (if you sign in with Google)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">User-Generated Content</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>YouTube video links you submit</li>
              <li>Video titles and descriptions</li>
              <li>Category selections</li>
              <li>Country associations</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">Usage Data</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Videos you favorite</li>
              <li>Your submission history</li>
              <li>Authentication logs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Provide and maintain the Service</li>
              <li>Authenticate your account</li>
              <li>Process and review video submissions</li>
              <li>Display your submitted and favorited content to you</li>
              <li>Communicate with you about the Service</li>
              <li>Improve and optimize the Service</li>
              <li>Prevent spam and abuse</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Storage and Security</h2>
            <p className="text-gray-700">
              Your data is stored securely using Supabase, a trusted backend service provider. We implement
              industry-standard security measures including encryption, secure authentication, and row-level
              security policies to protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Information Sharing</h2>
            <p className="text-gray-700 mb-4">We do not sell your personal information. We may share information in the following circumstances:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>With service providers (Supabase for database, Google for authentication)</li>
              <li>When required by law or to protect our rights</li>
              <li>With your consent</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Note: Approved video submissions (YouTube links) are publicly visible to all users.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Third-Party Services</h2>
            <p className="text-gray-700 mb-4">We use the following third-party services:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Google OAuth:</strong> For authentication (subject to Google's Privacy Policy)</li>
              <li><strong>YouTube:</strong> For video hosting (subject to YouTube's Privacy Policy)</li>
              <li><strong>Supabase:</strong> For data storage and authentication</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Cookies and Tracking</h2>
            <p className="text-gray-700">
              We use cookies and local storage to maintain your authentication session and improve your
              experience. You can disable cookies in your browser settings, but this may limit functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Your Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Access your personal data</li>
              <li>Update or correct your information</li>
              <li>Delete your account and associated data</li>
              <li>Edit or delete your submissions</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Data Retention</h2>
            <p className="text-gray-700">
              We retain your account information and submissions as long as your account is active. If you
              delete your account, we will remove your personal information within 30 days, though approved
              video links may remain visible without attribution to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Children's Privacy</h2>
            <p className="text-gray-700">
              Our Service is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If we discover we have collected such information, we
              will delete it immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. International Users</h2>
            <p className="text-gray-700">
              Your information may be transferred to and processed in countries other than your own. By
              using the Service, you consent to such transfers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
            <p className="text-gray-700">
              If you have any questions about this Privacy Policy or your personal data, please contact
              us through our website.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </a>
        </div>
      </main>
    </div>
  );
}
