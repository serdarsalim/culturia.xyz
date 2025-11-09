import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CULTURIA - Discover Authentic Cultural Content",
  description: "Explore authentic cultural content from around the world. Watch inspirational speeches, music, comedy, cooking, and street interviews from every country.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
