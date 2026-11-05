import Script from "next/script";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./glow.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  metadataBase: new URL("https://shelfrelay.site"),
  applicationName: "ShelfRelay",
  openGraph: { siteName: "ShelfRelay", url: "https://shelfrelay.site", type: "website" },
  title: { default: "ShelfRelay — Procurement intelligence for independent retail", template: "%s · ShelfRelay" },
  description:
    "Compare suppliers on true landed cost, consolidate catalogues, and plan replenishment with transparent, reviewable AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">
        <Script src="/glow.js" strategy="afterInteractive" />
        <script type="application/ld+json" id="founders-ld" dangerouslySetInnerHTML={{ __html: "{\"@context\": \"https://schema.org\", \"@type\": \"Organization\", \"name\": \"ShelfRelay\", \"url\": \"https://shelfrelay.site\", \"email\": \"hello@shelfrelay.site\", \"logo\": \"https://shelfrelay.site/icon-512.png\", \"founder\": [{\"@type\": \"Person\", \"name\": \"Frank Idahor\", \"jobTitle\": \"Founder/CEO\"}, {\"@type\": \"Person\", \"name\": \"Emeka Nwosu\", \"jobTitle\": \"Co-founder/CTO\"}]}" }} />{children}</body>
    </html>
  );
}
