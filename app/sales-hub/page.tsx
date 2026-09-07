"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CATEGORIES,
  PRODUCTS,
  STORE_URL,
  productUrl,
  type ProductCategory,
} from "@/lib/store";

/**
 * The shop. Every product is live on Gumroad — see the header of lib/store.ts
 * for why that sentence is load-bearing.
 *
 * One page rather than the four it replaced. /sales-hub used to be a landing
 * page fronting /sales-hub/audio, /visual and /business, which made sense for
 * the twelve products it claimed to have and none at all for the nine that
 * actually exist: a category page holding a single invoice generator is a worse
 * experience than a filter chip. The sub-routes are gone.
 *
 * Checkout is Gumroad's, deliberately. It handles tax, currency and delivery,
 * and this site never sees a card number.
 */
export default function StorePage() {
  const [filter, setFilter] = useState<ProductCategory | "all">("all");

  const shown = filter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);
  const activeCategory = CATEGORIES.find((c) => c.id === filter);

  const chip = (isActive: boolean) =>
    `border px-4 py-2 text-xs uppercase tracking-[0.14em] transition ${
      isActive
        ? "border-brass-400 bg-brass-400 text-moonlit-950"
        : "border-brass-500/40 text-brass-200 hover:border-brass-400 hover:text-brass-100"
    }`;

  return (
    <main className="min-h-screen bg-moonlit-950 pt-16">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-brass-700/25 px-6 py-24">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
            The shop
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] text-white md:text-6xl">
            Take something
            <span className="block text-brass-200">home with you.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-moonlit-200">
            MIDI packs, royalty-free jams and small tools — made here, priced like they were
            made by one person rather than a company. Checkout and delivery run through
            Gumroad.
          </p>
        </div>
      </section>

      {/* ===== FILTER ===== */}
      <section className="border-b border-moonlit-700/40 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => setFilter("all")} className={chip(filter === "all")}>
              Everything ({PRODUCTS.length})
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setFilter(category.id)}
                className={chip(filter === category.id)}
              >
                {category.label} ({PRODUCTS.filter((p) => p.category === category.id).length})
              </button>
            ))}
          </div>
          {activeCategory && (
            <p className="mt-6 text-center text-moonlit-300">{activeCategory.blurb}</p>
          )}
        </div>
      </section>

      {/* ===== GRID ===== */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product) => (
            <a
              key={product.id}
              href={productUrl(product)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col border border-moonlit-700/70 bg-moonlit-900/40 transition hover:border-brass-500/60"
            >
              <div className="aspect-square overflow-hidden bg-moonlit-950">
                {/* Real cover art, served from public/store/. The grid used to
                    show grey boxes reading "Preview". */}
                <img
                  src={product.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-display text-xl leading-snug text-moonlit-50">
                  {product.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-moonlit-300">
                  {product.blurb}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-moonlit-700/60 pt-4">
                  <span className="font-display text-lg text-brass-200">{product.price}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-brass-300 transition group-hover:text-brass-100">
                    Get it →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-center text-moonlit-400">
          More on the way — packs and tools land here as they finish. Everything above is
          available right now on{" "}
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brass-300 underline underline-offset-4 transition hover:text-brass-200"
          >
            the Gumroad store
          </a>
          .
        </p>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative overflow-hidden border-t border-moonlit-700/40 px-6 py-24">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl leading-tight text-moonlit-50 md:text-5xl">
            Need something made for you?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-moonlit-200">
            The shop is the off-the-shelf half. Software, scoring, design and video are all
            done to commission.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/services"
              className="bg-brass-300 px-7 py-3.5 text-sm font-bold uppercase tracking-[0.18em] text-moonlit-950 transition hover:bg-brass-200"
            >
              See what I do
            </Link>
            <Link
              href="/onboarding/orientation"
              className="border border-brass-500/70 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
            >
              Start a project
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
