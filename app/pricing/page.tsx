import Link from "next/link";
import { tiers } from "@/data/tiers";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="max-w-6xl mx-auto px-4 py-16">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">transparent pricing</h1>
          <p className="mt-3 text-zinc-400">
            Clear scope, honest timelines, two revisions included on every package.
          </p>
        </header>

        {/* Tier cards */}
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={`rounded-2xl border p-6 bg-zinc-900/60 border-zinc-800 flex flex-col ${
                tier.featured ? "ring-2 ring-teal-500" : ""
              }`}
            >
              {("badge" in tier && (tier as any).badge) ? (
                <div className="mb-3 inline-block rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                  {(tier as any).badge}
                </div>
              ) : null}

              <h3 className="text-xl font-semibold">{tier.name}</h3>
              <div className="mt-1 text-3xl font-extrabold">{tier.price}</div>
              <p className="mt-2 text-sm text-zinc-400">{tier.description}</p>

              <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-teal-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`mt-6 inline-flex justify-center rounded-lg px-4 py-2.5 font-semibold transition ${
                  tier.featured
                    ? "bg-teal-600 text-white hover:bg-teal-500"
                    : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                }`}
              >
                {tier.ctaLabel}
              </Link>
            </article>
          ))}
        </div>

        {/* Micro-copy under grid */}
        <p className="mt-8 text-center text-xs text-zinc-500">
          Need something bigger? Music videos & custom productions start at $2,000 —{" "}
          <Link href="/consult" className="text-teal-400 hover:underline">
            book a free consult
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
