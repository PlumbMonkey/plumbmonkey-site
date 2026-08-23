import type { Metadata } from "next";
import EnterRoomLink from "../components/EnterRoomLink";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Screening Room | Plumbmonkey",
  description:
    "Professional video editing, motion graphics, and audio production. Transparent pricing, fast turnaround, cinematic quality.",
};

const SERVICES = [
  {
    title: "YouTube & Content Editing",
    body: "Hook viewers fast. I edit for retention, clarity, and punch — thumbnails, titles, shorts, full episodes — whatever your channel needs.",
  },
  {
    title: "Music & Story Videos",
    body: "Full-scale animated or live-action music videos, lyric videos, performance cuts, and narrative edits for bands, artists, and directors.",
  },
  {
    title: "Events & Custom Projects",
    body: "Weddings, performances, business promos, school plays — no project too unusual or ambitious. I deliver.",
  },
];

const PORTFOLIO = [
  {
    youtubeId: "9z97EOMQXiM",
    title: "Force of Nature — Lyric Music Video",
    body: "An original lyric music video combining song, animation, and atmospheric visual storytelling. The lyrics are designed directly into the film, making the typography part of the performance rather than a separate subtitle track.",
  },
  {
    youtubeId: "1rH8Hf8PI64",
    title: "Coffee House Commercial",
    body: "High-energy short crafted from stock footage, with original music and sound design. Proof that even pre-shot assets can tell a unique story.",
  },
  {
    youtubeId: "lk4YO6IBMgU",
    title: "From Sketch to Screen: My Hybrid AI & 3D Animation Workflow",
    body: "Dive into a unique creative journey where traditional artistry converges with cutting-edge artificial intelligence and 3D animation. Witness the transformation of a simple sketch into a fully realized, AI-animated 3D creature, seamlessly integrated into real-world footage.",
  },
];

export default function ScreeningRoomPage() {
  return (
    <main className="min-h-screen">
      <RoomHero
        roomSlug="screening-room"
        title="The Screening Room"
        subtitle="Video editing & production — the service that started it all."
      />

      <section className="mx-auto max-w-3xl px-6 pt-20 pb-4 text-center">
        <p className="text-lg text-moonlit-200">
          Step inside the Spectral Grand Theatre — a haunted Victorian opera house that shifts
          between concert venue and cinema, explorable in your browser.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <EnterRoomLink
            href="/theatre/viewer.html"
            model="/theatre/theatre-web.glb"
            className="inline-block rounded-lg bg-brass-500 px-8 py-3 font-bold text-moonlit-950 shadow transition hover:bg-brass-400"
          >
            Enter the Theatre
          </EnterRoomLink>
        </div>
        <p className="mt-6 text-sm text-moonlit-400">
          Best on desktop · drag to look, scroll to zoom · roughly 4&nbsp;MB to load
        </p>
        <p className="mt-2 text-sm text-moonlit-400">
          Also walkable in VR — open this page in a Meta&nbsp;Quest headset browser
          and choose <span className="text-brass-300">Enter in VR</span>.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-4 text-center font-display text-3xl font-semibold">
          Video Editing &amp; Creative Services
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-moonlit-200">
          <b>For YouTubers, creators, musicians, brands, and anyone with a story to tell.</b>
          <br />
          Quick-turnaround, pro results, and a creative partner who gets what matters — whether
          it&apos;s a viral short, a music video, or your one-shot wedding footage.
        </p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title}>
              <h3 className="mb-2 text-xl font-semibold text-moonlit-50">{s.title}</h3>
              <p className="text-moonlit-200">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center text-moonlit-300">
          <span>
            Prefer human-only, hybrid, or full AI workflow? <b>You call the shots.</b>
          </span>
          <br />
          <a href="/contact" className="text-brass-400 underline hover:text-brass-300">
            Book a consult — let&apos;s create something that stands out.
          </a>
        </div>
      </section>

      <section className="bg-moonlit-900/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center font-display text-3xl font-semibold">
            Video Editing Portfolio
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-lg text-moonlit-200">
            Music, motion, and story — every edit powered by Plumbmonkey&apos;s own animation and
            original music.
          </p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {PORTFOLIO.map((p) => (
              <div key={p.youtubeId} className="group">
                <iframe
                  className="aspect-video w-full rounded transition group-hover:opacity-80"
                  src={`https://www.youtube-nocookie.com/embed/${p.youtubeId}?cc_load_policy=0&iv_load_policy=3&rel=0&playsinline=1`}
                  title={`${p.title} — Plumbmonkey`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <h3 className="mt-2 text-xl font-semibold">{p.title}</h3>
                <p className="text-sm text-moonlit-300">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="mb-4 text-sm text-moonlit-400">
              MIDI packs, music loops, producer tools, 3D assets, and more. New releases regularly
              added.
            </p>
            <a
              href="https://plumbmonkey.gumroad.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-brass-400 px-6 py-3 font-bold text-moonlit-950 shadow transition hover:bg-brass-300"
            >
              Visit the Plumbmonkey Store
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-24 text-center">
        <h2 className="mb-4 font-display text-3xl font-semibold">Start Your Project</h2>
        <p className="mx-auto mb-8 max-w-xl text-lg text-moonlit-200">
          Get a quote, browse the full pricing breakdown, or book a slot directly.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href="/onboarding/orientation"
            className="rounded-lg bg-burgundy-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-burgundy-500"
          >
            Get a Quote
          </a>
          <a
            href="/pricing-scope"
            className="rounded-lg border border-moonlit-600 px-6 py-3 font-semibold text-moonlit-100 transition hover:border-brass-400 hover:text-brass-400"
          >
            View Pricing
          </a>
          <a
            href="/booking"
            className="rounded-lg bg-brass-500 px-6 py-3 font-semibold text-moonlit-950 shadow transition hover:bg-brass-400"
          >
            Book Now
          </a>
        </div>
      </section>
    </main>
  );
}
