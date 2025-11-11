"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function AudioPage() {
  const audioProducts = [
    {
      id: "midi-cinematic-vol1",
      title: "Cinematic MIDI Vol. 01",
      shortDesc: "100+ cinematic chord progressions and melodies",
      fullDesc: "Perfect for film scores, trailers, and epic storytelling. Includes full MIDI stems and audio previews.",
      price: 29,
      tags: ["MIDI", "Cinematic", "Chords"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/cinematic-midi-vol1",
    },
    {
      id: "synth-loops-pack",
      title: "Synth Loops & Textures",
      shortDesc: "500+ synthesizer loops and atmospheric textures",
      fullDesc: "Modern synth packs for electronic music, lo-fi beats, and ambient soundscapes. Royalty-free and ready to use.",
      price: 39,
      tags: ["Loops", "Synth", "Electronic"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/synth-loops",
    },
    {
      id: "drumkit-vanguard",
      title: "Vanguard Drum Kit",
      shortDesc: "250+ drum samples and drum hits",
      fullDesc: "Professional-grade drum kit with kicks, snares, hats, and percussion. One-shots and loops included.",
      price: 19,
      tags: ["Drums", "Percussion", "One-Shots"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/vanguard-drumkit",
    },
    {
      id: "sound-design-toolkit",
      title: "Sound Design Toolkit",
      shortDesc: "FX, transitions, and sound design elements",
      fullDesc: "Audio FX, whooshes, transitions, and sci-fi elements for video editing and game audio.",
      price: 24,
      tags: ["SFX", "Transitions", "Design"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/sound-design-toolkit",
    },
  ];

  const [sortBy, setSortBy] = useState<"price" | "newest">("newest");

  const sortedProducts = [...audioProducts].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    return 0; // newest is default order
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* HEADER */}
      <section className="relative py-16 px-6 bg-gradient-to-b from-purple-900/20 to-zinc-950 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <Link href="/sales-hub" className="text-sm text-teal-400 hover:underline mb-4 inline-block">
            ← Back to Sales Hub
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">🎧 Audio Products</h1>
          <p className="text-lg text-zinc-300">
            Professional MIDI packs, loops, drum kits, and sound design tools for creators and producers.
          </p>
        </div>
      </section>

      {/* FILTERS & SORT */}
      <section className="py-6 px-6 bg-zinc-900/50 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-sm text-zinc-400">Found {sortedProducts.length} products</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "price" | "newest")}
              className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="newest">Newest</option>
              <option value="price">Price: Low to High</option>
            </select>
          </div>
        </div>
      </section>

      {/* PRODUCTS GRID */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
            {sortedProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-teal-500 transition group"
              >
                {/* Product image/preview placeholder */}
                <div className="w-full h-64 bg-gradient-to-br from-purple-900/40 to-pink-900/40 flex items-center justify-center group-hover:from-purple-800/60 group-hover:to-pink-800/60 transition">
                  <div className="text-center">
                    <div className="text-6xl mb-2">🎵</div>
                    <span className="text-zinc-400 text-sm">{product.title}</span>
                  </div>
                </div>

                {/* Product info */}
                <div className="p-6">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {product.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 rounded bg-zinc-800 text-teal-400">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-xl font-bold mb-2">{product.title}</h3>
                  <p className="text-sm text-zinc-400 mb-4">{product.shortDesc}</p>

                  <div className="border-t border-zinc-700 pt-4 mt-4 flex items-center justify-between">
                    <span className="text-2xl font-bold text-teal-400">${product.price}</span>
                    <a
                      href={product.gumroadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 transition"
                    >
                      Buy Now
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-zinc-900/50 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Don't see what you need?</h2>
          <p className="text-zinc-300 mb-6">
            Request a custom audio tool or book a consultation with Plumbmonkey for bespoke sound design.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-6 py-3 rounded-lg border border-teal-500 text-teal-400 font-semibold hover:bg-teal-500/10 transition"
          >
            Get a Custom Quote
          </Link>
        </div>
      </section>
    </main>
  );
}
