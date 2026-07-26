"use client";

import { useEffect, useRef, useState } from "react";

interface Package {
  slug: string;
  name: string;
  blurb: string;
  price: string;
  suffix?: string;
  note?: string;
  features: string[];
  stripeUrl: string;
  accent: "brass" | "burgundy" | "amber";
  badge?: string;
}

const PACKAGES: Package[] = [
  {
    slug: "clean-cut",
    name: "Clean Cut",
    blurb: "Tight, professional edit. Tutorials, talking heads, product demos.",
    price: "$150",
    suffix: "CAD",
    features: [
      "Basic audio cleanup",
      "Light color correction",
      "Simple text titles",
      "Export in 1080/4K",
      "1 revision included",
    ],
    stripeUrl: "https://buy.stripe.com/dRmfZi6JV60tbFD5KhcEw02",
    accent: "brass",
  },
  {
    slug: "impact-cut",
    name: "Impact Cut",
    blurb: "Where the video starts to carry weight. YouTube, promos, ads.",
    price: "$350",
    suffix: "CAD",
    badge: "Popular",
    features: [
      "Everything in Clean Cut",
      "Better color & sound design",
      "Motion graphics & SFX",
      "Thumbnail design included",
      "2 revisions included",
    ],
    stripeUrl: "https://buy.stripe.com/aFa28s8S388B8tr2y5cEw03",
    accent: "brass",
  },
  {
    slug: "signature",
    name: "Signature Edit",
    blurb: "Cinematic treatment. Music videos, brand films, trailers.",
    price: "$450",
    suffix: "CAD",
    note: "50% deposit to begin · balance due on delivery",
    features: [
      "Everything in Impact Cut",
      "Animated intro & outro",
      "Motion-tracked titles",
      "Original soundtrack (optional)",
      "3 revisions included",
    ],
    stripeUrl: "https://buy.stripe.com/00waEY1pBcoReRPa0xcEw04",
    accent: "burgundy",
  },
  {
    slug: "addons",
    name: "Add-Ons & Balance",
    blurb: "Short-form cuts, logo intros, thumbnails, rush delivery, or a remaining project balance.",
    price: "$40+",
    suffix: "CAD",
    features: [
      "Short-form cutdowns (TikTok/Reels)",
      "Animated logo intro",
      "Thumbnail pack",
      "Original soundtrack",
      "Rush delivery surcharge",
      "Project balance payment",
    ],
    stripeUrl: "https://buy.stripe.com/8x29AUb0bdsV7pndcJcEw05",
    accent: "amber",
  },
];

// Estimator/pricing-page tier keys → this page's package slugs.
const TIER_ALIASES: Record<string, string> = {
  budget: "clean-cut",
  pro: "impact-cut",
  super: "signature",
  "clean-cut": "clean-cut",
  "impact-cut": "impact-cut",
  signature: "signature",
  cinematic: "signature",
};

const ACCENT_CLASSES: Record<Package["accent"], { border: string; button: string }> = {
  brass: { border: "hover:border-brass-500/60", button: "bg-brass-600 hover:bg-brass-500 text-moonlit-950" },
  burgundy: { border: "hover:border-burgundy-400/60", button: "bg-burgundy-600 hover:bg-burgundy-500 text-white" },
  amber: { border: "hover:border-amber-500/60", button: "bg-amber-600 hover:bg-amber-500 text-moonlit-950" },
};

export default function BookingClient() {
  const [recommended, setRecommended] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const tier = new URLSearchParams(window.location.search).get("tier")?.toLowerCase() ?? "";
    const slug = TIER_ALIASES[tier];
    if (!slug) return;
    setRecommended(slug);
    const card = cardRefs.current[slug];
    if (card) setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Book a Production Slot
        </h1>
        <p className="mx-auto max-w-xl text-lg text-moonlit-300">
          Select your package below and pay via Stripe to hold your spot in the production queue.
          You&apos;ll receive a confirmation email within 24 hours.
        </p>
      </div>

      <div className="mb-10 rounded-xl border border-brass-700/40 bg-brass-950/30 px-6 py-4 text-sm text-brass-200">
        <strong className="text-brass-100">How it works:</strong> Payment holds your slot. Once
        received, I&apos;ll reach out within 24 hours to confirm scope, timeline, and next steps. The{" "}
        <em>Signature Edit</em> requires a 50% deposit — the balance is due on delivery.
      </div>

      <div className="mb-10 grid gap-6 sm:grid-cols-2">
        {PACKAGES.map((pkg) => {
          const isRecommended = recommended === pkg.slug;
          const accent = ACCENT_CLASSES[pkg.accent];
          return (
            <div
              key={pkg.slug}
              ref={(el) => {
                cardRefs.current[pkg.slug] = el;
              }}
              className={`flex flex-col gap-4 rounded-xl border p-6 transition-all duration-200 ${accent.border} ${
                isRecommended
                  ? "border-brass-400 ring-2 ring-brass-400/30"
                  : "border-moonlit-700 bg-moonlit-800/50"
              }`}
            >
              {isRecommended && (
                <p className="rounded border border-brass-700/40 bg-brass-950/60 px-3 py-1 text-center text-xs font-semibold text-brass-300">
                  ★ Recommended for your project
                </p>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{pkg.name}</h2>
                  <p className="mt-1 text-sm text-moonlit-400">{pkg.blurb}</p>
                </div>
                {pkg.badge && (
                  <span className="ml-2 whitespace-nowrap rounded-full bg-brass-600 px-2 py-0.5 text-xs font-bold text-moonlit-950">
                    {pkg.badge}
                  </span>
                )}
              </div>
              <div>
                <div className="text-3xl font-bold text-brass-400">
                  {pkg.price} {pkg.suffix && <span className="text-lg font-normal text-moonlit-400">{pkg.suffix}</span>}
                </div>
                {pkg.note && <p className="mt-1 text-xs text-moonlit-500">{pkg.note}</p>}
              </div>
              <ul className="flex-1 space-y-1 text-sm text-moonlit-200">
                {pkg.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <a
                href={pkg.stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (typeof window !== "undefined" && typeof (window as any).gtag !== "undefined") {
                    (window as any).gtag("event", "begin_checkout", {
                      event_category: "ecommerce",
                      event_label: pkg.slug,
                    });
                  }
                }}
                className={`block rounded-lg px-4 py-3 text-center font-semibold transition-colors ${accent.button}`}
              >
                Pay {pkg.price} {pkg.suffix} — Book {pkg.name}
              </a>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-moonlit-500">
        Payments are processed securely by Stripe. All prices in Canadian dollars. Questions?{" "}
        <a href="/contact" className="text-brass-400 underline hover:text-brass-300">
          Contact us
        </a>
        .
      </p>
    </main>
  );
}
