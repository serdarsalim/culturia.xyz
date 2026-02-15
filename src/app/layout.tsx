import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./globals.css";

export const metadata: Metadata = {
  title: "CULTURIA - Discover Authentic Cultural Content",
  description: "Explore authentic cultural content from around the world. Watch inspirational speeches, music, comedy, cooking, and street interviews from every country.",
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
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
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
