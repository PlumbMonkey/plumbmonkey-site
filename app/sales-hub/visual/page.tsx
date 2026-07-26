"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function VisualPage() {
  const visualProducts = [
    {
      id: "bg-remover-pro",
      title: "Quick Background Remover",
      shortDesc: "AI-powered batch background removal",
      fullDesc: "Remove backgrounds from 100+ images in minutes. Perfect for product photos, portraits, and social media assets.",
      price: 49,
      tags: ["AI", "Batch Processing", "Images"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/bg-remover-pro",
    },
    {
      id: "color-grade-preset",
      title: "Cinematic Color Grade Presets",
      shortDesc: "30+ professional color grading presets",
      fullDesc: "Apply professional color grades in seconds. Works with DaVinci Resolve, Premiere Pro, and Final Cut Pro.",
      price: 34,
      tags: ["Color Grading", "Presets", "Video"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/color-grade-preset",
    },
    {
      id: "motion-templates",
      title: "Motion Graphics Templates",
      shortDesc: "100+ editable motion templates",
      fullDesc: "Lower thirds, transitions, intros, and outros. Fully customizable in After Effects and Premiere Pro.",
      price: 59,
      tags: ["Motion Graphics", "Templates", "AE/Premiere"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/motion-templates",
    },
    {
      id: "video-transition-pack",
      title: "Ultra Smooth Transitions Pack",
      shortDesc: "200+ professional video transitions",
      fullDesc: "Organic, modern transitions including cuts, fades, zooms, and creative wipes. All 4K-ready.",
      price: 29,
      tags: ["Transitions", "Video", "4K"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/video-transition-pack",
    },
  ];

  const [sortBy, setSortBy] = useState<"price" | "newest">("newest");

  const sortedProducts = [...visualProducts].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    return 0;
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* HEADER */}
      <section className="relative py-16 px-6 bg-gradient-to-b from-blue-900/20 to-zinc-950 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <Link href="/sales-hub" className="text-sm text-teal-400 hover:underline mb-4 inline-block">
            ← Back to Sales Hub
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">🎨 Visual Products</h1>
          <p className="text-lg text-zinc-300">
            Professional tools for video editing, color grading, motion graphics, and visual effects.
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
                <div className="w-full h-64 bg-gradient-to-br from-blue-900/40 to-cyan-900/40 flex items-center justify-center group-hover:from-blue-800/60 group-hover:to-cyan-800/60 transition">
                  <div className="text-center">
                    <div className="text-6xl mb-2">🎬</div>
                    <span className="text-zinc-400 text-sm">{product.title}</span>
                  </div>
                </div>

                {/* Product info */}
                <div className="p-6">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {product.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 rounded bg-zinc-800 text-cyan-400">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-xl font-bold mb-2">{product.title}</h3>
                  <p className="text-sm text-zinc-400 mb-4">{product.shortDesc}</p>

                  <div className="border-t border-zinc-700 pt-4 mt-4 flex items-center justify-between">
                    <span className="text-2xl font-bold text-cyan-400">${product.price}</span>
                    <a
                      href={product.gumroadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-500 transition"
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
          <h2 className="text-2xl font-bold mb-4">Need a custom visual solution?</h2>
          <p className="text-zinc-300 mb-6">
            Get a bespoke color grade, motion design, or video editing service tailored to your project.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-6 py-3 rounded-lg border border-cyan-500 text-cyan-400 font-semibold hover:bg-cyan-500/10 transition"
          >
            Book a Service
          </Link>
        </div>
      </section>
    </main>
  );
}
