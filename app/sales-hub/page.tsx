"use client";

import React from "react";
import Link from "next/link";

export default function SalesHubPage() {
  const categories = [
    {
      id: "audio",
      name: "🎧 Audio",
      description: "MIDI packs, loops, sound design tools, and audio plugins",
      href: "/sales-hub/audio",
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "visual",
      name: "🎨 Visual",
      description: "Background removal, image/video generators, creative plugins",
      href: "/sales-hub/visual",
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "business",
      name: "🧰 Business Tools",
      description: "Templates, scripts, and workflow automation for creatives",
      href: "/sales-hub/business",
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* HERO SECTION */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950">
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Creative Tools &<br />
            <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              Professional Services
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
            Premium digital products and direct booking for video editing, sound design, and creative production.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#categories"
              className="inline-block px-8 py-4 rounded-lg bg-teal-500 text-zinc-950 font-semibold hover:bg-teal-400 transition"
            >
              Shop Digital Tools
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-8 py-4 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-500 transition"
            >
              View Service Pricing
            </Link>
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-lg border border-teal-500 text-teal-400 font-semibold hover:bg-teal-500/10 transition"
            >
              Book Creative Time
            </Link>
          </div>
        </div>

        {/* Background gradient effect */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>
      </section>

      {/* CATEGORIES SECTION */}
      <section id="categories" className="py-24 px-6 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Browse by Category</h2>
          <p className="text-center text-zinc-400 mb-12 max-w-2xl mx-auto">
            Choose what you're looking for — or explore all three to supercharge your creative workflow.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={cat.href}
                className="group relative rounded-2xl overflow-hidden border border-zinc-800 hover:border-teal-500 transition"
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-10 group-hover:opacity-20 transition`}></div>

                {/* Content */}
                <div className="relative p-8 flex flex-col h-full">
                  <h3 className="text-2xl font-bold mb-2">{cat.name}</h3>
                  <p className="text-zinc-300 flex-1">{cat.description}</p>
                  <div className="mt-6 inline-flex items-center text-teal-400 group-hover:translate-x-1 transition">
                    Browse → 
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS PREVIEW */}
      <section className="py-24 px-6 bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Featured Products</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Sample product cards */}
            {[
              {
                title: "Cinematic MIDI Vol. 01",
                category: "Audio",
                price: "$29",
                desc: "100+ cinematic chord progressions and melodies",
              },
              {
                title: "Quick Background Remover",
                category: "Visual",
                price: "$49",
                desc: "AI-powered batch background removal tool",
              },
              {
                title: "Invoice & Proposal Generator",
                category: "Business",
                price: "$19",
                desc: "Customizable invoices for creative freelancers",
              },
            ].map((prod, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-teal-500 transition group cursor-pointer"
              >
                {/* Placeholder for media */}
                <div className="w-full h-48 bg-gradient-to-br from-zinc-800 to-zinc-700 rounded-lg mb-4 flex items-center justify-center group-hover:from-teal-900/30 group-hover:to-purple-900/30 transition">
                  <span className="text-zinc-500 text-sm">Preview</span>
                </div>
                <div className="text-xs text-teal-400 mb-2">{prod.category}</div>
                <h3 className="text-lg font-semibold mb-1">{prod.title}</h3>
                <p className="text-sm text-zinc-400 mb-4">{prod.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-400">{prod.price}</span>
                  <button className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500 transition">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 px-6 bg-gradient-to-r from-teal-900/30 to-purple-900/30 border-y border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to level up your creative work?</h2>
          <p className="text-lg text-zinc-300 mb-8">
            Pick a tool, book a service, or get a free consultation. Whatever you choose, let's make something great.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#categories"
              className="inline-block px-8 py-3 rounded-lg bg-teal-500 text-zinc-950 font-semibold hover:bg-teal-400 transition"
            >
              Start Shopping
            </Link>
            <Link
              href="/onboarding"
              className="inline-block px-8 py-3 rounded-lg border border-teal-500 text-teal-400 font-semibold hover:bg-teal-500/10 transition"
            >
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
