import "../styles/globals.css";
import { Inter, Playfair_Display } from "next/font/google";
import type { Metadata } from "next";
import Footer from "./components/Footer";
import NavBar from "./components/NavBar";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://plumbmonkey.online"),
  title: {
    default: "Plumbmonkey | Spectral Manor",
    template: "%s | Plumbmonkey",
  },
  description:
    "Enter Spectral Manor, an evolving creative world of original music, characters, stories, games, animation, and browser-based creative tools.",
  keywords: [
    "Spectral Manor",
    "Ghost Circuit",
    "independent creative studio",
    "browser games",
    "music tools",
    "animation",
    "3D art",
  ],
  authors: [{ name: "Plumbmonkey" }],
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "/",
    siteName: "Plumbmonkey",
    title: "Enter Spectral Manor",
    description:
      "An evolving creative world of original music, characters, stories, games, animation, and tools.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Enter Spectral Manor — a world of music, stories, games, and creative tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Enter Spectral Manor",
    description:
      "An evolving creative world of original music, characters, stories, games, animation, and tools.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "CreativeWorkSeries",
    name: "Spectral Manor",
    creator: {
      "@type": "Organization",
      name: "Plumbmonkey",
      url: "https://plumbmonkey.online",
    },
    description:
      "An evolving creative world of music, characters, stories, games, animation, and browser-based creative tools.",
    url: "https://plumbmonkey.online",
  };

  return (
    <html
      lang="en"
      className={`h-full bg-moonlit-950 text-moonlit-50 ${display.variable} ${body.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
        {/* The arriving half of a room transition. Synchronous and ahead of the
            body on purpose: it wears the hallway film over a room that is still
            loading, and a deferred copy would let the page paint underneath it
            first. Inert on every page that was not reached with ?walk. */}
        <script src="/shared/walk-in.js" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-512918665" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-512918665');
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-body antialiased">
        <NavBar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
