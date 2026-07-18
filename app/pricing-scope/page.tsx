'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function PricingScopePage() {
  const [expandedAddOn, setExpandedAddOn] = useState<string | null>(null);
  const [expandedRevision, setExpandedRevision] = useState(false);

  const addOns = [
    { name: 'Short-form cutdowns (TikTok/Reels)', price: '$40–$120', desc: 'Vertical and square versions for social platforms.' },
    { name: 'Animated logo intro', price: '$100–$300', desc: 'Custom 3–5 second branded opener.' },
    { name: 'Thumbnail pack (3–5 designs)', price: '$40–$150', desc: 'Eye-catching YouTube thumbnails.' },
    { name: 'Custom soundtrack', price: '$100–$500', desc: 'Original music composed for your video.' },
    { name: 'Rush delivery (48–72hr)', price: '+25%–50%', desc: 'Fast turnaround if you need it sooner.' },
    { name: 'Raw project files', price: '+$100–$300', desc: 'Source files for future edits (premium add-on).' },
  ];

  const revisionPolicy = [
    { tier: 'Clean Cut', revisions: '1 revision', desc: 'One round of changes.' },
    { tier: 'Impact Cut', revisions: '2 revisions', desc: 'Two rounds for refinement.' },
    { tier: 'Signature', revisions: '3 revisions', desc: 'Full collaboration.' },
    { tier: 'Extra revisions', revisions: 'Billed hourly', desc: 'Additional rounds beyond tier.' },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-50">
      {/* ===== 1. HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600 rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Every frame has a price
            <br />
            <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
              — and a pace.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Your story deserves precision, not guesswork. Choose your speed, your depth, and your impact.
          </p>
          <p className="text-sm text-zinc-500">Based in Calgary, AB</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/onboarding/orientation"
              className="inline-block px-8 py-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:shadow-lg hover:shadow-orange-500/50 transition-all duration-200"
            >
              Start Your Brief
            </Link>
            <a
              href="#pricing"
              className="inline-block px-8 py-4 rounded-lg border-2 border-orange-500 text-orange-400 font-bold hover:bg-orange-500/10 transition-all duration-200"
            >
              View Packages
            </a>
          </div>
        </div>
      </section>

      {/* ===== 2. PRICING CARDS GRID ===== */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-center">Three ways to edit.</h2>
          <p className="text-center text-zinc-400 mb-16 max-w-2xl mx-auto text-lg">
            Pick the pace that matches your project.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* CARD 1: CLEAN CUT */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-8 hover:border-orange-500/50 transition-all duration-300 flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Clean Cut</h3>
                <p className="text-3xl font-bold text-orange-400">$150–$350</p>
                <p className="text-sm text-zinc-400 mt-2">per video · CAD</p>
              </div>

              <p className="text-zinc-300 mb-6">
                The basics done properly. Tight edits, clean sound, no fluff.
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Basic audio cleanup</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Light color correction</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Simple text titles</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Music if needed</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Export in 1080/4K</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Turnaround: 3–5 business days</span>
                </li>
              </ul>

              <p className="text-xs text-zinc-400 italic mb-6">
                "For tutorials, talk videos, product demos."
              </p>

              <Link
                href="/onboarding?tier=clean-cut"
                className="block text-center py-3 px-4 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-500 transition-all"
              >
                Get Started
              </Link>
              <a
                href="https://buy.stripe.com/dRmfZi6JV60tbFD5KhcEw02"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-3 px-4 rounded-lg border border-orange-500 text-orange-400 font-semibold hover:bg-orange-500/10 transition-all mt-3"
              >
                Book This Package
              </a>
            </div>

            {/* CARD 2: IMPACT CUT */}
            <div className="rounded-xl border-2 border-orange-500/60 bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 md:scale-105 flex flex-col shadow-xl shadow-orange-500/20">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </span>
              </div>

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Impact Cut</h3>
                <p className="text-3xl font-bold text-orange-400">$350–$900</p>
                <p className="text-sm text-zinc-400 mt-2">per video · CAD</p>
              </div>

              <p className="text-zinc-300 mb-6">
                Where your video starts to carry weight.
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Everything in Clean Cut</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Better color and sound</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Captions (burned or SRT)</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Motion graphics + SFX</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Thumbnail design</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Multi-format exports</span>
                </li>
              </ul>

              <p className="text-xs text-zinc-400 italic mb-6">
                "For YouTube creators and business promos."
              </p>

              <Link
                href="/onboarding?tier=impact-cut"
                className="block text-center py-3 px-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:shadow-lg hover:shadow-orange-500/50 transition-all"
              >
                Request Quote
              </Link>
              <a
                href="https://buy.stripe.com/aFa28s8S388B8tr2y5cEw03"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-3 px-4 rounded-lg border border-orange-500 text-orange-400 font-semibold hover:bg-orange-500/10 transition-all mt-3"
              >
                Book This Package
              </a>
            </div>

            {/* CARD 3: SIGNATURE */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-8 hover:border-orange-500/50 transition-all duration-300 flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Signature Edit</h3>
                <p className="text-3xl font-bold text-orange-400">$900–$3,500+</p>
                <p className="text-sm text-zinc-400 mt-2">per video · CAD</p>
              </div>

              <p className="text-zinc-300 mb-6">
                Where art crashes into engineering — storytelling, sound design, and cinematic polish.
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Everything in Impact Cut</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Story structure help</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Animated intro/outro</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Motion-tracked titles</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Original soundtrack (optional)</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✓</span>
                  <span>Multi-aspect exports</span>
                </li>
              </ul>

              <p className="text-xs text-zinc-400 italic mb-6">
                "For music videos, brand films, and launch trailers."
              </p>

              <Link
                href="/onboarding?tier=signature"
                className="block text-center py-3 px-4 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-500 transition-all"
              >
                Let's Talk
              </Link>
              <a
                href="https://buy.stripe.com/00waEY1pBcoReRPa0xcEw04"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-3 px-4 rounded-lg border border-orange-500 text-orange-400 font-semibold hover:bg-orange-500/10 transition-all mt-3"
              >
                Book This Package
              </a>
              <p className="text-xs text-zinc-400 mt-2 text-center">50% deposit to begin. Balance due on delivery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3. ADD-ONS SECTION ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-center">Add-On Options</h2>
          <p className="text-center text-zinc-400 mb-12 text-lg">
            Go à la carte. Add what your project needs.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {addOns.map((addon, idx) => (
              <div
                key={idx}
                onClick={() => setExpandedAddOn(expandedAddOn === addon.name ? null : addon.name)}
                className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30 hover:border-orange-500/30 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{addon.name}</h3>
                    <p className="text-orange-400 font-bold text-lg">{addon.price}</p>
                  </div>
                  <span className="text-orange-400 text-2xl ml-4">{expandedAddOn === addon.name ? '−' : '+'}</span>
                </div>
                {expandedAddOn === addon.name && (
                  <p className="text-zinc-400 text-sm mt-4 pt-4 border-t border-zinc-700">
                    {addon.desc}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="https://buy.stripe.com/8x29AUb0bdsV7pndcJcEw05"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 rounded-lg border border-orange-500 text-orange-400 font-bold hover:bg-orange-500/10 transition-all"
            >
              Add-Ons & Rush
            </a>
          </div>
        </div>
      </section>

      {/* ===== 4. SCOPE & TURNAROUND SECTION ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold mb-12 text-center">What shapes your quote</h2>

          <div className="grid md:grid-cols-2 gap-12 mb-12">
            {/* Left: Explainer */}
            <div>
              <p className="text-zinc-300 text-lg leading-relaxed mb-6">
                Once your project is reviewed, I'll provide you with an estimated completion date. Deadlines are sacred — I take them seriously, even for AI-assisted work.
              </p>
              <p className="text-zinc-400 text-sm italic">
                No guesses. No surprises. Just precision and respect for your timeline.
              </p>
            </div>

            {/* Right: Table */}
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
              <div className="bg-zinc-800/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="px-4 py-3 text-left font-semibold text-orange-400">Factor</th>
                      <th className="px-4 py-3 text-left font-semibold text-orange-400">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-700/50">
                      <td className="px-4 py-3">Footage (up to 60 min)</td>
                      <td className="px-4 py-3 text-zinc-300">Included in base price</td>
                    </tr>
                    <tr className="border-b border-zinc-700/50">
                      <td className="px-4 py-3">60–180 min</td>
                      <td className="px-4 py-3 text-zinc-300">50% off base price per additional hour</td>
                    </tr>
                    <tr className="border-b border-zinc-700/50">
                      <td className="px-4 py-3">3+ hours</td>
                      <td className="px-4 py-3 text-zinc-300">Custom quote</td>
                    </tr>
                    <tr className="border-b border-zinc-700/50">
                      <td className="px-4 py-3">Multi-aspect export</td>
                      <td className="px-4 py-3 text-zinc-300">+25–50%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Deadline priority</td>
                      <td className="px-4 py-3 text-zinc-300">Always honored</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5. AI-ASSISTED vs HUMAN-CRAFTED ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold mb-12 text-center">How we build your edit</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* AI-Accelerated */}
            <div className="border border-zinc-700 rounded-lg p-8 bg-zinc-800/30">
              <h3 className="text-2xl font-bold mb-4">AI-Accelerated</h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">⚡</span>
                  <span>Fast concepting and editing</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">⚡</span>
                  <span>Baseline pricing (no rush premium)</span>
                </li>
              </ul>
              <p className="text-zinc-400 text-sm italic">
                "AI accelerates the process, but every frame still gets human review and precision."
              </p>
            </div>

            {/* Human-Crafted */}
            <div className="border border-orange-500/40 rounded-lg p-8 bg-gradient-to-br from-zinc-800 to-zinc-900">
              <h3 className="text-2xl font-bold mb-4">Human-Crafted</h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✋</span>
                  <span>Fully drawn, rigged, and animated by hand</span>
                </li>
                <li className="flex items-start text-sm text-zinc-300">
                  <span className="text-orange-400 mr-3 mt-0.5">✋</span>
                  <span>+15–30% premium (but it's yours forever)</span>
                </li>
              </ul>
              <p className="text-zinc-300 text-sm italic">
                "If you want it drawn from scratch, not dreamed by a machine, that takes time — but it's yours forever. Deadline still applies."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 6. REVISION POLICY ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8 text-center">Revision policy</h2>

          <div
            onClick={() => setExpandedRevision(!expandedRevision)}
            className="border border-zinc-700 rounded-lg p-8 bg-zinc-800/50 cursor-pointer hover:border-orange-500/30 transition-all"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">What's included?</h3>
              <span className="text-orange-400 text-2xl">{expandedRevision ? '−' : '+'}</span>
            </div>

            {expandedRevision && (
              <div className="mt-6 space-y-4 pt-6 border-t border-zinc-700">
                {revisionPolicy.map((policy, idx) => (
                  <div key={idx} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-zinc-200">{policy.tier}</p>
                      <p className="text-sm text-zinc-400">{policy.desc}</p>
                    </div>
                    <p className="font-bold text-orange-400 ml-4 whitespace-nowrap">{policy.revisions}</p>
                  </div>
                ))}
                <div className="mt-6 pt-6 border-t border-zinc-700">
                  <p className="text-sm text-zinc-400">
                    <strong className="text-zinc-200">Extra revisions:</strong> Billed hourly or as a revision pack. We protect our time so we can deliver quality.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== 7. CTA FOOTER ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-orange-950/30 to-red-950/30 border-y border-zinc-700">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl sm:text-3xl font-bold mb-4 leading-relaxed">
            If you want cheap, you're in the wrong studio.
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              If you want a video that hits, you're home.
            </span>
          </p>

          <p className="text-zinc-400 mb-12 text-lg">
            Every project gets a custom quote. Every edit gets precision and heart.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/onboarding/orientation"
              className="inline-block px-8 py-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:shadow-lg hover:shadow-orange-500/50 transition-all"
            >
              Start Your Brief
            </Link>
            <a
              href="https://plumbmonkey.github.io/gregg-henwood-dev-portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 rounded-lg border-2 border-orange-500 text-orange-400 font-bold hover:bg-orange-500/10 transition-all"
            >
              View Portfolio
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
