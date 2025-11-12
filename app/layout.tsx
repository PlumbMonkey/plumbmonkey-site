import "../styles/globals.css";
import NavBar from "./components/NavBar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plumbmonkey | Video Editing & Production Services",
  description: "Professional video editing, motion graphics, and audio production. Transparent pricing, fast turnaround, and cinematic quality.",
  keywords: "video editing, video production, motion graphics, audio production, YouTube editing, promo videos",
  authors: [{ name: "Plumbmonkey" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://plumbmonkey.online",
    siteName: "Plumbmonkey",
    title: "Plumbmonkey | Video Editing & Production Services",
    description: "Professional video editing, motion graphics, and audio production. Transparent pricing, fast turnaround, and cinematic quality.",
    images: [
      {
        url: "https://plumbmonkey.online/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Plumbmonkey Video Production",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plumbmonkey | Video Editing & Production",
    description: "Professional video editing and production services with transparent pricing.",
    images: ["https://plumbmonkey.online/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "google-site-verification": "your-google-verification-code-here",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Plumbmonkey",
    image: "https://plumbmonkey.online/og-image.jpg",
    description: "Professional video editing and production services with transparent pricing and fast turnaround.",
    url: "https://plumbmonkey.online",
    telephone: "",
    email: "plumbmonkey@proton.me",
    address: {
      "@type": "PostalAddress",
      streetAddress: "",
      addressLocality: "",
      addressRegion: "",
      postalCode: "",
      addressCountry: "US",
    },
    sameAs: ["https://plumbmonkey.gumroad.com/"],
    offers: [
      {
        "@type": "Offer",
        name: "Clean Cut Video Editing",
        description: "Fast, clean edits for social media and simple projects",
        url: "https://plumbmonkey.online/pricing-scope.html",
      },
      {
        "@type": "Offer",
        name: "Impact Cut Video Editing",
        description: "Color grading, VFX, and motion graphics included",
        url: "https://plumbmonkey.online/pricing-scope.html",
      },
      {
        "@type": "Offer",
        name: "Signature Video Production",
        description: "Full cinematic production with custom music and VFX",
        url: "https://plumbmonkey.online/pricing-scope.html",
      },
    ],
  };

  return (
    <html lang="en" className="h-full bg-zinc-950 text-zinc-50">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-XXXXXXXXXX', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}

