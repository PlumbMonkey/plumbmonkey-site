"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function BusinessPage() {
  const businessProducts = [
    {
      id: "invoice-generator",
      title: "Invoice & Proposal Generator",
      shortDesc: "Customizable invoices for creatives",
      fullDesc: "Generate professional invoices and proposals in minutes. Includes payment tracking and export to PDF.",
      price: 19,
      tags: ["Templates", "Business", "Generator"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/invoice-generator",
    },
    {
      id: "project-timeline-tool",
      title: "Project Timeline & Gantt Tool",
      shortDesc: "Visual project planning for video production",
      fullDesc: "Plan shoots, edits, and deliverables with a simple Gantt chart. Track dependencies and deadlines.",
      price: 29,
      tags: ["Planning", "Management", "Production"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/project-timeline-tool",
    },
    {
      id: "rate-calculator",
      title: "Creative Pricing Calculator",
      shortDesc: "Calculate rates based on project complexity",
      fullDesc: "Smart pricing tool that factors in scope, deadline, and revisions. Ensures fair rates every time.",
      price: 24,
      tags: ["Pricing", "Freelance", "Calculator"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/rate-calculator",
    },
    {
      id: "media-organizer",
      title: "Media Organization System",
      shortDesc: "Folder structure templates and workflow",
      fullDesc: "Industry-standard folder structures for video projects. Includes naming conventions and best practices.",
      price: 14,
      tags: ["Workflow", "Organization", "Tutorial"],
      gumroadUrl: "https://plumbmonkey.gumroad.com/l/media-organizer",
    },
  ];

  const [sortBy, setSortBy] = useState<"price" | "newest">("newest");

  const sortedProducts = [...businessProducts].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    return 0;
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* HEADER */}
      <section className="relative py-16 px-6 bg-gradient-to-b from-amber-900/20 to-zinc-950 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <Link href="/sales-hub" className="text-sm text-teal-400 hover:underline mb-4 inline-block">
            ← Back to Sales Hub
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">🧰 Business Tools</h1>
          <p className="text-lg text-zinc-300">
            Templates, scripts, and workflow automation for creative professionals and freelancers.
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
                <div className="w-full h-64 bg-gradient-to-br from-amber-900/40 to-orange-900/40 flex items-center justify-center group-hover:from-amber-800/60 group-hover:to-orange-800/60 transition">
                  <div className="text-center">
                    <div className="text-6xl mb-2">📊</div>
                    <span className="text-zinc-400 text-sm">{product.title}</span>
                  </div>
                </div>

                {/* Product info */}
                <div className="p-6">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {product.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 rounded bg-zinc-800 text-amber-400">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-xl font-bold mb-2">{product.title}</h3>
                  <p className="text-sm text-zinc-400 mb-4">{product.shortDesc}</p>

                  <div className="border-t border-zinc-700 pt-4 mt-4 flex items-center justify-between">
                    <span className="text-2xl font-bold text-amber-400">${product.price}</span>
                    <a
                      href={product.gumroadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 transition"
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
          <h2 className="text-2xl font-bold mb-4">Need help optimizing your workflow?</h2>
          <p className="text-zinc-300 mb-6">
            Get a personalized consultation on business practices, automation, and creative operations.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-6 py-3 rounded-lg border border-amber-500 text-amber-400 font-semibold hover:bg-amber-500/10 transition"
          >
            Schedule a Consultation
          </Link>
        </div>
      </section>
    </main>
  );
}
