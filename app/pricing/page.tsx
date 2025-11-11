import Link from "next/link";
import { tiers } from "@/data/tiers";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Hero Section */}
      <section className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-teal-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-zinc-300 max-w-2xl mx-auto">
          Clear scope, honest timelines, two revisions included on every package.
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

      {/* Bottom CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-teal-500/10 to-purple-500/10 border border-teal-500/30 rounded-xl p-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to bring your vision to life?
          </h2>
          <p className="text-zinc-300 mb-6">
            Choose your package and start your project brief. We'll deliver professional results within your timeline.
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
