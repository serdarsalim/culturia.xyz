export default function Terms() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>

        <div className="prose prose-lg">
          <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700">
              By accessing and using CULTURIA ("the Service"), you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to these Terms of Service, please do not use
              the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. User-Submitted Content</h2>
            <p className="text-gray-700 mb-4">
              Culturia lets users post written country impressions. You may include post content, pros, cons,
              and optional presence markers such as "I was there" or "I lived there." By posting content, you agree that:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>You are responsible for what you post</li>
              <li>Your post must be lawful and must not violate others' rights</li>
              <li>Your post must not contain harassment, hate speech, threats, or explicit illegal content</li>
              <li>We may remove, hide, or moderate content at our discretion</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Content Guidelines</h2>
            <p className="text-gray-700 mb-4">Posts should be:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Based on personal impressions or clearly stated opinions</li>
              <li>Respectful toward people, places, and cultures</li>
              <li>Free from spam, scams, or misleading manipulation</li>
              <li>Within the platform limits for post length and labels</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Copyright and Intellectual Property</h2>
            <p className="text-gray-700">
              You retain ownership of your original text. By posting on Culturia, you grant us a non-exclusive
              license to store, display, and process that content as needed to operate the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. User Accounts</h2>
            <p className="text-gray-700">
              To create or edit posts, you must sign in. You are responsible for your account credentials and
              all activity under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Prohibited Activities</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Impersonate another person or organization</li>
              <li>Attempt unauthorized access or abuse the platform</li>
              <li>Use automated abuse, spam, or malicious scraping</li>
              <li>Post unlawful or harmful content</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Visibility and Privacy</h2>
            <p className="text-gray-700">
              Posts are public by default. You can mark individual posts private, and you can also set your profile
              visibility to private in settings. Private content may still be visible to administrators for moderation
              and safety purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-gray-700">
              The Service is provided "as is" without any warranties, expressed or implied. We do not guarantee
              the accuracy, completeness, or usefulness of user-generated content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700">
              CULTURIA and its operators shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages resulting from your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Changes to Terms</h2>
            <p className="text-gray-700">
              We reserve the right to modify these terms at any time. Changes will be effective immediately upon
              posting. Your continued use of the Service constitutes acceptance of modified terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contact</h2>
            <p className="text-gray-700">
              For questions about these Terms of Service, please contact us through our website.
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
