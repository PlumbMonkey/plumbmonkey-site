import Link from "next/link";
import { tiers } from "@/data/tiers";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Hero Section */}
      <section className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-teal-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Video Editing Pricing
        </h1>
        <p className="text-xl text-zinc-300 max-w-2xl mx-auto mb-4">
          You're not paying for cuts. You're paying for impact.
        </p>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          If you want cheap, there are millions of editors. If you want a video that actually keeps attention, you hire Plumbmonkey.
        </p>
      </section>

      {/* Pricing Cards Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border transition-all duration-300 ${
                tier.featured
                  ? 'border-teal-500/50 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-xl shadow-teal-500/20 scale-105 md:scale-110'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800'
              }`}
            >
              {/* Badge */}
              {("badge" in tier && (tier as any).badge) && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-zinc-950 text-xs font-bold px-3 py-1 rounded-full">
                    {(tier as any).badge}
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col h-full">
                {/* Tier Name */}
                <h3 className="text-2xl font-bold mb-2 text-white">{tier.name}</h3>

                {/* Description */}
                <p className="text-sm text-zinc-400 mb-4">{tier.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                </div>

                {/* Best For (if applicable) */}
                {("bestFor" in tier && (tier as any).bestFor) && (
                  <div className="mb-4 text-xs text-teal-300 bg-teal-950/30 rounded px-3 py-2">
                    <strong>Best for:</strong> {(tier as any).bestFor}
                  </div>
                )}

                {/* Features */}
                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start text-sm text-zinc-300"
                    >
                      <span className="text-teal-400 mr-3 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Link
                  href={tier.ctaHref}
                  className={`block text-center py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                    tier.featured
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-zinc-950 hover:shadow-lg hover:shadow-teal-500/50'
                      : 'bg-zinc-700 text-white hover:bg-zinc-600'
                  }`}
                >
                  {tier.ctaLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Info text */}
        <p className="mt-8 text-center text-sm text-zinc-400">
          Need something bigger? Music videos & custom productions start at $2,000 —{" "}
          <Link href="/consult" className="text-teal-400 hover:text-teal-300">
            book a free consult
          </Link>
          .
        </p>
      </section>

      {/* Revision Logic Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center text-white">
          How Revisions Work
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-teal-400 mb-2">Clean Cut</h3>
            <p className="text-zinc-300 text-center text-2xl font-bold">1 Revision</p>
            <p className="text-zinc-400 text-sm text-center mt-2">
              One round of changes to fine-tune the edit.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Impact Cut</h3>
            <p className="text-zinc-300 text-center text-2xl font-bold">2 Revisions</p>
            <p className="text-zinc-400 text-sm text-center mt-2">
              Two rounds to get it exactly right.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-pink-400 mb-2">Cinematic</h3>
            <p className="text-zinc-300 text-center text-2xl font-bold">3 Revisions</p>
            <p className="text-zinc-400 text-sm text-center mt-2">
              Full collaboration to perfect your vision.
            </p>
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-700/50 rounded-lg p-6">
          <p className="text-zinc-300">
            <strong className="text-amber-300">Beyond revisions?</strong> Additional changes are billed hourly or as a revision pack. We protect our time so we can deliver quality.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-12 text-center text-white">
          Frequently Asked Questions
        </h2>

        <div className="space-y-6">
          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              What's the difference between the tiers?
            </h3>
            <p className="text-zinc-300">
              Clean Cut is a fast, professional edit for straightforward content. Impact Cut adds motion graphics, better color, and sound design—it's the level where videos start looking cinematic. Cinematic is full storytelling treatment with animation, original sound design, and multiple deliverables.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              Can I combine packages or do a custom price?
            </h3>
            <p className="text-zinc-300">
              Absolutely. Every project is different. Some clients need a Clean Cut with add-on motion graphics, or an Impact Cut with rush delivery. Start your brief and we'll quote exactly what you need.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              What if my video is longer/shorter than expected?
            </h3>
            <p className="text-zinc-300">
              Pricing scales with length and complexity. A 2-minute product demo is different from a 15-minute podcast edit. Give us your raw materials and timeline, and we'll quote accordingly.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              Do you offer rush delivery?
            </h3>
            <p className="text-zinc-300">
              Yes. Rush delivery (48–72 hours) adds 25–50% to your tier price. For urgent projects, contact us and we'll see if we can fit it in.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              Can I get raw project files?
            </h3>
            <p className="text-zinc-300">
              Yes, as a premium add-on for +$100–$300, depending on the project. We never give these for free—they represent months of workflow setup and learning.
            </p>
          </div>

          <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-800/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              What formats do I get?
            </h3>
            <p className="text-zinc-300">
              Standard exports include 1080p and 4K in H.264. Impact Cut and above include vertical video (9:16) for Instagram/TikTok. Cinematic includes all aspect ratios (16:9, 9:16, 1:1).
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-teal-500/10 to-purple-500/10 border border-teal-500/30 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to elevate your content?
          </h2>
          <p className="text-zinc-300 mb-6">
            Pick your tier and start your project brief. We'll get back to you within 24 hours with timeline and next steps.
          </p>
          <Link
            href="/onboarding"
            className="inline-block bg-gradient-to-r from-teal-500 to-cyan-500 text-zinc-950 font-bold py-3 px-8 rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all duration-200"
          >
            Start Your Brief
          </Link>
        </div>
      </section>
    </main>
  );
}
