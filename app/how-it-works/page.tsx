"use client";

import React from "react";
import Link from "next/link";

export default function HowItWorksPage() {
  const steps = [
    {
      number: 1,
      icon: "🎬",
      title: "Choose Your Package",
      description:
        "Start by selecting a service tier that fits your project — from a simple edit to a full cinematic buildout. Each package clearly lists what's included so you know exactly what you're getting.",
      cta: "View Pricing",
      ctaHref: "/pricing-scope",
    },
    {
      number: 2,
      icon: "🧠",
      title: "Submit Your Brief",
      description:
        "Fill out the guided form — this captures your goals, tone, target audience, and examples you love. It's designed to eliminate miscommunication and give me everything I need to start right.",
      cta: "Start Your Brief",
      ctaHref: "/onboarding",
    },
    {
      number: 3,
      icon: "💰",
      title: "Approve Estimate & Schedule",
      description:
        "Once I review your brief, you'll receive a personalized estimate with a transparent timeline. Confirm, pay your deposit, and lock in your production slot.",
      cta: "Get Estimate",
      ctaHref: "/onboarding",
    },
    {
      number: 4,
      icon: "🎛️",
      title: "Production in Progress",
      description:
        "Your project moves through the creative pipeline — editing, animation, audio, and post-production — using my pro tool stack (DaVinci Resolve Studio, FL Studio, Blender, and more). You'll get status updates via email.",
      cta: "See Tools",
      ctaHref: "#toolkit",
    },
    {
      number: 5,
      icon: "🚀",
      title: "Review & Delivery",
      description:
        "You'll receive a preview cut or final deliverable for review. One round of revisions (depending on your package), then final files are delivered via secure link — ready to launch.",
      cta: "Start Your Project",
      ctaHref: "/onboarding",
    },
  ];

  const tools = [
    { name: "Video Editing", icon: "🎬" },
    { name: "Music & Audio Creation", icon: "🎵" },
    { name: "Editing, Mixing & Mastering", icon: "🎙️" },
    { name: "2D/3D Animation & Motion Graphics", icon: "✨" },
    { name: "Design & Painting", icon: "🖌️" },
    { name: "AI Tools", icon: "🤖" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* HERO SECTION */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
            How It Works
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 mb-8">
            No jargon. No confusion. Just creation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-lg bg-teal-500 text-zinc-950 font-semibold hover:bg-teal-400 transition"
            >
              Start Your Brief
            </Link>
            <Link
              href="/pricing-scope"
              className="inline-block px-8 py-4 rounded-lg border border-teal-500 text-teal-400 font-semibold hover:bg-teal-500/10 transition"
            >
              Browse Packages
            </Link>
          </div>
        </div>
      </section>

      {/* TIMELINE SECTION */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Vertical line (visible on desktop) */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-teal-500 via-purple-500 to-transparent opacity-30"></div>

            {/* Steps */}
            <div className="space-y-20">
              {steps.map((step, idx) => (
                <div
                  key={step.number}
                  className={`relative grid md:grid-cols-2 gap-8 items-center ${
                    idx % 2 === 1 ? "md:grid-flow-dense" : ""
                  }`}
                >
                  {/* Step Content */}
                  <div className={idx % 2 === 1 ? "md:order-2" : ""}>
                    <div className="relative">
                      {/* Step number badge (hidden on mobile, shown on desktop) */}
                      <div className="hidden md:flex absolute -left-16 top-0 w-12 h-12 rounded-full bg-teal-600 items-center justify-center text-lg font-bold border-4 border-zinc-950 shadow-lg z-10">
                        {step.number}
                      </div>

                      {/* Mobile step number */}
                      <div className="md:hidden mb-4 inline-flex px-4 py-2 rounded-full bg-teal-600/20 border border-teal-500/50 text-sm font-semibold text-teal-400">
                        Step {step.number}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <span className="text-5xl">{step.icon}</span>
                          <h2 className="text-3xl md:text-4xl font-bold">{step.title}</h2>
                        </div>
                        <p className="text-lg text-zinc-300 leading-relaxed">
                          {step.description}
                        </p>
                        <div className="pt-4">
                          <Link
                            href={step.ctaHref}
                            className="inline-flex items-center px-6 py-3 rounded-lg bg-zinc-800 text-teal-400 font-semibold hover:bg-zinc-700 hover:text-teal-300 transition border border-zinc-700 hover:border-teal-500"
                          >
                            {step.cta} →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual placeholder (alternates sides) */}
                  <div className={`hidden md:flex items-center justify-center ${idx % 2 === 1 ? "md:order-1" : ""}`}>
                    <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-teal-900/40 via-purple-900/30 to-zinc-900/40 border border-zinc-800 flex items-center justify-center shadow-2xl">
                      <span className="text-8xl opacity-50">{step.icon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TOOLKIT SECTION */}
      <section id="toolkit" className="py-24 px-6 bg-zinc-900/50 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Toolkit</h2>
          <p className="text-lg text-zinc-300 mb-4">
            A professional suite of tools — the same ones used in film studios and sound labs.
          </p>
          <p className="text-md text-zinc-400 mb-12">
            Because you deserve professional results.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 hover:border-teal-500 transition group"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition">
                  {tool.icon}
                </div>
                <h3 className="font-semibold text-lg">{tool.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FOOTER SECTION */}
      <section className="py-20 px-6 bg-gradient-to-r from-teal-900/20 to-purple-900/20 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to roll?</h2>
          <p className="text-lg text-zinc-300 mb-8">
            Pick your package, drop your brief, and let's build something cinematic.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 transition"
            >
              Start Your Brief
            </Link>
            <Link
              href="/pricing-scope"
              className="inline-block px-8 py-4 rounded-lg border border-teal-500 text-teal-400 font-semibold hover:bg-teal-500/10 transition"
            >
              View Packages
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
