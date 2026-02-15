import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./globals.css";

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Culturia | Review Countries",
  description:
    "Read and share honest impressions about countries around the world. Compare pros and cons, and track where people have been or lived.",
  openGraph: {
    title: "Culturia | Review Countries",
    description:
      "A global map of country impressions, pros and cons, and lived/visited experiences shared by real people.",
    type: "website",
    siteName: "Culturia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Culturia | Review Countries",
    description:
      "Read and share country impressions, pros and cons, and lived/visited experiences.",
  },
  icons: {
    icon: "/culturia.png",
    shortcut: "/culturia.png",
    apple: "/culturia.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Culturia",
    url: baseUrl,
    description:
      "Read and share honest impressions about countries around the world. Compare pros and cons, and track where people have been or lived.",
    publisher: {
      "@type": "Person",
      name: "SerdarSalim",
      url: "https://serdarsalim.com",
    },
  };

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          {children}
          <Analytics />
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
