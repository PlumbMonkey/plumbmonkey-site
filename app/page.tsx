import type { Metadata } from "next";
import Link from "next/link";
import RoomDoors from "./components/RoomDoors";

export const metadata: Metadata = {
  title: "Plumbmonkey | Enter Spectral Manor",
  description:
    "Explore Spectral Manor, an evolving creative world of original music, characters, stories, games, animation, and browser-based creative tools.",
};

const CURRENTLY_BUILDING = [
  "A final full-length album and the music that will score the world",
  "A growing library of 2D and 3D characters, sets, and props",
  "New games, instruments, and creative rooms inside Spectral Manor",
];

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-moonlit-950">
      <section className="manor-hero relative isolate h-screen min-h-[38rem] overflow-hidden bg-[#05060a]">
        <video
          className="manor-hero-image absolute inset-0 -z-30"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/spectral-manor-poster.jpg"
          aria-hidden="true"
        >
          <source
            src="/assets/spectral-manor-hero-loop.webm"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference)"
          />
          <source
            src="/assets/spectral-manor-hero-loop.mp4"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference)"
          />
        </video>
        <div className="absolute inset-0 -z-20 bg-gradient-to-l from-moonlit-950/90 via-moonlit-950/30 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-moonlit-950/80 via-transparent to-moonlit-950/15" />

        <div className="absolute bottom-7 right-6 z-10 w-[calc(100%-3rem)] max-w-2xl text-right sm:bottom-10 sm:right-10 md:bottom-14 md:right-14">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
              An independent creative world
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.95] text-white drop-shadow-2xl sm:text-6xl md:text-8xl">
              Enter
              <span className="block text-brass-200">Spectral Manor</span>
            </h1>
            <p className="ml-auto mt-7 max-w-2xl text-lg leading-relaxed text-moonlit-100 drop-shadow md:text-xl">
              Music, characters, stories, games, animation, and creative tools—built as one
              evolving world where every new piece gives life to the rest.
            </p>
            <div className="mt-9 flex flex-col justify-end gap-3 sm:flex-row">
              <a
                href="#rooms"
                className="rounded-sm bg-brass-300 px-7 py-3.5 text-center text-sm font-bold uppercase tracking-[0.18em] text-moonlit-950 transition hover:bg-brass-200"
              >
                Enter the Manor
              </a>
              <Link
                href="/screening-room"
                className="rounded-sm border border-white/30 bg-black/20 px-7 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition hover:border-brass-300 hover:text-brass-200"
              >
                Watch the Work
              </Link>
            </div>
        </div>

      </section>

      <section id="world" className="relative border-y border-brass-700/25 px-6 py-24">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brass-400">
                Private by design
              </p>
              <h2 className="font-display text-4xl leading-tight text-moonlit-50 md:text-5xl">
                Create here. Keep it with you.
              </h2>
            </div>
            <div className="space-y-5 text-lg leading-relaxed text-moonlit-200">
              <p>
                Your projects are not uploaded to Plumbmonkey, added to a shared library, or
                reused by the studio. The creative tools run in your browser and your work
                remains yours.
              </p>
              <p>
                Download a project file when you finish. Re-upload it later to continue
                working&mdash;no account or cloud project storage required.
              </p>
            </div>
          </div>

          <ol className="mt-14 grid gap-px overflow-hidden border border-moonlit-700/70 bg-moonlit-700/70 md:grid-cols-3">
            {[
              ["01", "Create in your browser", "Use the instruments and creative rooms without sending a project to us."],
              ["02", "Download your project", "Keep the editable file on your own device, alongside any finished exports."],
              ["03", "Return when you like", "Upload that project file to continue from where you left off."],
            ].map(([number, title, copy]) => (
              <li key={number} className="bg-moonlit-950/95 p-7">
                <span className="font-display text-lg text-brass-400">{number}</span>
                <h3 className="mt-5 font-display text-2xl text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-moonlit-300">{copy}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-6 border-t border-brass-700/25 pt-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brass-400">
              One world, many forms
            </p>
            <h3 className="font-display text-3xl leading-tight text-moonlit-50">
              Our world grows through connected stories.
            </h3>
          </div>
          <div className="text-base leading-relaxed text-moonlit-300">
            <p>
              Plumbmonkey&apos;s own characters, music, stories, and games cross between rooms
              inside Spectral Manor. That connected universe belongs to the studio; anything
              you make with the public tools belongs to you.
            </p>
          </div>
          </div>
        </div>
      </section>

      <RoomDoors />

      <section className="bg-[#08090d] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid overflow-hidden border border-moonlit-700/70 bg-moonlit-900/60 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-80 overflow-hidden lg:min-h-[30rem]">
              <img
                src="/assets/haunted-house-branded.jpg"
                alt="Spectral Manor, the home of the Ghost Circuit universe"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-moonlit-950 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-moonlit-950" />
            </div>
            <div className="flex flex-col justify-center p-8 md:p-12">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brass-400">
                The current chapter
              </p>
              <h2 className="font-display text-4xl text-white">The world is being built now.</h2>
              <ul className="mt-7 space-y-5">
                {CURRENTLY_BUILDING.map((item, index) => (
                  <li key={item} className="flex gap-4 text-moonlit-200">
                    <span className="font-display text-brass-400">0{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/gallery"
                className="mt-9 self-start border-b border-brass-400 pb-1 text-sm font-semibold uppercase tracking-[0.18em] text-brass-300 transition hover:text-brass-100"
              >
                See the visual work
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brass-400">
            Selective commissions
          </p>
          <h2 className="font-display text-4xl text-moonlit-50 md:text-5xl">
            Interesting work is still welcome.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-moonlit-200">
            Plumbmonkey occasionally accepts animation, video, scoring, software, and unusual
            cross-disciplinary projects that belong in the journey.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/onboarding/orientation"
              className="rounded-sm bg-burgundy-500 px-7 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-burgundy-400"
            >
              Propose a Project
            </Link>
            <Link
              href="/contact"
              className="rounded-sm border border-moonlit-600 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-moonlit-100 transition hover:border-brass-400 hover:text-brass-200"
            >
              Contact the Studio
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
