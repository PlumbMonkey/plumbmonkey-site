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
    },
    {
      number: 2,
      icon: "🧠",
      title: "Submit Your Brief",
      description:
        "Fill out the guided form — this captures your goals, tone, target audience, and examples you love. It's designed to eliminate miscommunication and give me everything I need to start right.",
    },
    {
      number: 3,
      icon: "💰",
      title: "Approve Estimate & Schedule",
      description:
        "Once I review your brief, you'll receive a personalized estimate with a transparent timeline. Confirm, pay your deposit, and lock in your production slot.",
    },
    {
      number: 4,
      icon: "🎛️",
      title: "Production in Progress",
      description:
        "Your project moves through the creative pipeline — editing, animation, audio, and post-production. You'll get status updates via email while I handle all the creative work.",
    },
    {
      number: 5,
      icon: "🚀",
      title: "Review & Delivery",
      description:
        "You'll receive a preview cut or final deliverable for review. One round of revisions (depending on your package), then final files are delivered via secure link — ready to launch.",
    },
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
                    <div className="relative text-center md:text-left">
                      {/* Step number badge - centered at top */}
                      <div className="flex justify-center md:justify-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-lg font-bold border-4 border-zinc-950 shadow-lg z-10">
                          {step.number}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-center md:justify-start gap-4">
                          <span className="text-5xl">{step.icon}</span>
                          <h2 className="text-3xl md:text-4xl font-bold">{step.title}</h2>
                        </div>
                        <p className="text-lg text-zinc-300 leading-relaxed">
                          {step.description}
                        </p>
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

      {/* CTA FOOTER SECTION */}
      <section className="py-24 px-6 bg-gradient-to-r from-teal-900/20 to-purple-900/20 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to roll?</h2>
          <p className="text-lg text-zinc-300 mb-8">
            Let's build something cinematic.
          </p>
          <Link
            href="/onboarding/orientation"
            className="inline-block px-8 py-4 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 transition"
          >
            Start Your Project
          </Link>
        </div>
      </section>
    </main>
  );
}
