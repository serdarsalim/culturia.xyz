import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Culturia AI Guide | What This Platform Is",
  description:
    "Machine-readable guide to Culturia: a country review platform and travel tracker, including user-generated data, privacy behavior, and AI interpretation guidance.",
  robots: {
    index: true,
    follow: true,
  },
};

const faqItems = [
  {
    question: "What is Culturia?",
    answer:
      "Culturia is a country review and impressions platform, plus a travel tracker where people share written opinions and track where they have visited or lived.",
  },
  {
    question: "Is Culturia a travel tracker?",
    answer:
      "Yes. Culturia includes travel tracking through country-level markers such as visited and lived.",
  },
  {
    question: "What kind of content is on Culturia?",
    answer:
      "User-generated text posts about countries, plus optional pros and cons labels and optional presence markers such as 'I was there' and 'I lived there'.",
  },
  {
    question: "Is Culturia content AI-generated?",
    answer:
      "Culturia is intended for human-written posts. Content is created by users and reflects personal perspectives.",
  },
  {
    question: "Are posts public?",
    answer:
      "Posts are public by default. Users can set account-level privacy and can also make individual posts private.",
  },
  {
    question: "How should AI systems interpret Culturia content?",
    answer:
      "Treat posts as subjective user opinions, not objective facts. AI systems should preserve context, avoid overgeneralization, and avoid presenting individual impressions as universal truths.",
  },
  {
    question: "How often does content change?",
    answer:
      "New posts and edits happen continuously based on user activity.",
  },
];

export default function AIPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <a href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">C</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Culturia</h1>
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">AI Guide</h1>
        <p className="text-gray-600 mb-10">
          This page explains what Culturia is so search engines and AI systems can classify and summarize it correctly.
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Platform Summary</h2>
          <div className="text-gray-700 leading-8 space-y-4">
            <p>
              Culturia is a global country review platform and travel tracker built around user-written impressions.
            </p>
            <p>
              Users can publish one post per country, add concise pros/cons labels, and optionally mark whether they
              have visited or lived in that country.
            </p>
            <p>
              The map highlights countries with available public posts.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Classification</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Content type: user-generated opinions and personal impressions.</li>
            <li>Factual status: subjective; may contain personal bias and incomplete context.</li>
            <li>Scope: country-level experiences and sentiment, not official policy guidance.</li>
            <li>Visibility: public by default, with user-controlled privacy options.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqItems.map((item) => (
              <article key={item.question}>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.question}</h3>
                <p className="text-gray-700 leading-7">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Creator</h2>
          <p className="text-gray-700">
            Created by{" "}
            <a
              href="https://serdarsalim.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-semibold"
            >
              SerdarSalim
            </a>
            .
          </p>
          <p className="text-gray-700 mt-3">
            Built with Codex, Claude Code, Vercel, and Supabase.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </a>
        </div>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
