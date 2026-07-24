import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plumbmonkey | Professional Video Editing Services",
  description: "Fast, affordable video editing with transparent pricing. From YouTube videos to promotional content, we deliver cinematic quality on your timeline.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20 bg-zinc-950 text-zinc-50">
      <h1 className="text-4xl md:text-6xl font-bold mb-6">Welcome to Plumbmonkey!</h1>
      <p className="text-lg text-zinc-400 mb-8 max-w-2xl">
        Professional video editing, transparent pricing, and honest timelines.
      </p>
      <p className="text-sm text-zinc-500 mb-10 max-w-xl">
        MIDI packs, music loops, producer tools, 3D assets, and more. New releases regularly added.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/pricing-scope.html"
          className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold text-lg hover:bg-teal-500 transition"
        >
          View Pricing
        </a>
        <a
          href="/onboarding/orientation"
          className="px-6 py-3 rounded-lg bg-purple-600 text-white font-semibold text-lg hover:bg-purple-500 transition"
        >
          Start a Project
        </a>
        <a
          href="https://plumbmonkey.gumroad.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 rounded-lg bg-orange-600 text-white font-semibold text-lg hover:bg-orange-500 transition"
        >
          Visit the Plumbmonkey Store
        </a>
      </div>
      {/* Branded to match the Ghost Circuit tab in the nav — the same three
          playgrounds, named the same way, so the universe reads as one thing
          wherever a visitor meets it. */}
      <section className="mt-16 w-full max-w-5xl">
        <div className="mb-1 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-400/50" />
          <p className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-xs font-semibold uppercase tracking-[0.3em] text-transparent">
            Ghost Circuit
          </p>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-400/50" />
        </div>
        <p className="mb-6 text-sm text-zinc-500">
          Three free playgrounds from the Ghost Circuit universe — no install, no sign-up.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <a href="/arcade" className="group rounded-2xl border border-violet-900 bg-violet-950/40 p-6 text-left transition hover:-translate-y-1 hover:border-violet-400">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/15 text-lg text-violet-200">🕹</span>
            <span className="text-xl font-bold text-violet-200">Arcade</span>
            <span className="mt-2 block text-sm text-zinc-400">Eight games in the haunted manor — desktop, mobile, or VR.</span>
          </a>
          <a href="/music" className="group rounded-2xl border border-cyan-900 bg-cyan-950/40 p-6 text-left transition hover:-translate-y-1 hover:border-cyan-400">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/15 text-lg text-cyan-200">♪</span>
            <span className="text-xl font-bold text-cyan-200">Sound Stage</span>
            <span className="mt-2 block text-sm text-zinc-400">Build beats, synth parts, songs, and recordings.</span>
          </a>
          <a href="/visual/index.html" className="group rounded-2xl border border-fuchsia-900 bg-fuchsia-950/40 p-6 text-left transition hover:-translate-y-1 hover:border-fuchsia-400">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/15 text-lg text-fuchsia-200">✦</span>
            <span className="text-xl font-bold text-fuchsia-200">Light Lab</span>
            <span className="mt-2 block text-sm text-zinc-400">Turn your audio into customizable visuals for video.</span>
          </a>
        </div>
      </section>
    </main>
  );
}
