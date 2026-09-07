import type { Metadata } from "next";
import Link from "next/link";
import { SERVICES } from "@/lib/services";

export const metadata: Metadata = {
  title: "What I do",
  description:
    "Software development, music and scoring, graphic design and animation, video editing, and music video production — from the studio behind Spectral Manor.",
};

/**
 * The studio's front door, and the page the commercial side hangs off.
 *
 * It exists because the site sold one thing in three vocabularies: three video
 * tiers on /pricing-scope, digital products on /sales-hub, and an intake form
 * that opened "Let's talk about your video". A visitor who wanted software or a
 * score had nowhere to land. Content comes from lib/services.ts so the footer
 * and the intake form cannot drift from it.
 *
 * Every service leads with a room rather than a claim. That is the one thing
 * this site has that a portfolio does not: the proof is playable, and it is one
 * click away on the same domain.
 */
export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-moonlit-950 pt-16">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-brass-700/25 px-6 py-24 md:py-32">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
            Work with the studio
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
            Five things,
            <span className="block text-brass-200">done properly.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-moonlit-200 md:text-xl">
            Software, music, design, and the video work the studio was built on — handled by
            one person, which is why they fit together instead of being handed between
            departments.
          </p>

          <nav aria-label="Services" className="mt-10 flex flex-wrap justify-center gap-2.5">
            {SERVICES.map((service) => (
              <a
                key={service.slug}
                href={`#${service.slug}`}
                className="border border-brass-500/40 px-4 py-2 text-xs uppercase tracking-[0.14em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
              >
                {service.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ===== THE FIVE LINES ===== */}
      {SERVICES.map((service, index) => (
        <section
          key={service.slug}
          id={service.slug}
          className={`scroll-mt-20 border-b border-moonlit-700/40 px-6 py-20 md:py-24 ${
            index % 2 === 1 ? "bg-moonlit-900/40" : ""
          }`}
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            {/* Left: what it is */}
            <div>
              <p className="mb-3 font-display text-lg text-brass-400">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="font-display text-4xl leading-tight text-moonlit-50 md:text-5xl">
                {service.name}
              </h2>
              <p className="mt-4 text-lg text-brass-200">{service.tagline}</p>
              <p className="mt-6 text-lg leading-relaxed text-moonlit-200">{service.blurb}</p>

              {service.caveat && (
                <p className="mt-6 border-l-2 border-burgundy-400/60 bg-burgundy-950/30 py-3 pl-5 pr-4 text-base leading-relaxed text-moonlit-200">
                  {service.caveat}
                </p>
              )}

              {service.proof && (
                <div className="mt-8 border border-brass-700/40 bg-moonlit-950/70 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
                    See it working
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-moonlit-300">
                    {service.proof.note}
                  </p>
                  <Link
                    href={service.proof.href}
                    className="mt-5 inline-block border border-brass-500/70 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
                  >
                    {service.proof.label}
                  </Link>
                </div>
              )}
            </div>

            {/* Right: what you get, and what it costs */}
            <div className="lg:pt-16">
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
                What you get
              </h3>
              <ul className="mt-5 grid gap-3">
                {service.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-moonlit-200">
                    <span aria-hidden="true" className="mt-1 text-brass-400">
                      ▸
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 border-t border-moonlit-700/50 pt-8">
                <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
                  What it costs
                </h3>

                {service.pricing.kind === "tiered" ? (
                  <>
                    <p className="mt-4 font-display text-3xl text-brass-200">
                      From {service.pricing.from}
                    </p>
                    <p className="mt-3 leading-relaxed text-moonlit-300">
                      {service.pricing.note}
                    </p>
                    <Link
                      href={service.pricing.href}
                      className="mt-6 inline-block bg-brass-300 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-moonlit-950 transition hover:bg-brass-200"
                    >
                      See the packages
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-4 leading-relaxed text-moonlit-300">
                      {service.pricing.note} What moves the number:
                    </p>
                    <ul className="mt-4 grid gap-2.5">
                      {service.pricing.drivers.map((driver) => (
                        <li
                          key={driver}
                          className="flex items-start gap-3 text-sm text-moonlit-300"
                        >
                          <span aria-hidden="true" className="mt-0.5 text-brass-500">
                            ·
                          </span>
                          <span>{driver}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/onboarding/orientation?service=${service.slug}`}
                      className="mt-6 inline-block border border-brass-500/70 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
                    >
                      Get a quote
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ===== CLOSING CTA ===== */}
      <section className="relative overflow-hidden px-6 py-24">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl leading-tight text-moonlit-50 md:text-5xl">
            Not sure which one you need?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-moonlit-200">
            Most projects turn out to be two or three of these at once — a game that needs a
            score, a video that needs animation. Tell me what you are making and I will work out
            what it takes.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/onboarding/orientation"
              className="bg-brass-300 px-7 py-3.5 text-sm font-bold uppercase tracking-[0.18em] text-moonlit-950 transition hover:bg-brass-200"
            >
              Start a project
            </Link>
            <Link
              href="/contact"
              className="border border-brass-500/70 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
            >
              Just ask a question
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
