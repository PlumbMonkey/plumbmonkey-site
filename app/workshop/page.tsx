import type { Metadata } from "next";
import Link from "next/link";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Workshop",
  description:
    "The Game Lab — build a game in your browser from art you drew and sounds you made — plus software development on commission.",
};

/**
 * The Workshop has two halves, and they are deliberately different in kind:
 * a tool you use yourself (the Game Lab) and a person you hire (commissions).
 * Every other room is only the first kind, and /services is only the second.
 *
 * THE GAME LAB IS NOT BUILT YET. It is described here in the future tense and
 * flagged in progress on purpose — the room is in the primary nav, so it cannot
 * be blank, but it also must not read as though a visitor can click through to
 * a working editor today. When it ships, replace the status note and the
 * disabled control; do not quietly change the tense and leave the rest.
 */

/* The pipeline the Game Lab closes. Each step is a room that already exists and
   already exports — which is the whole reason the Lab is worth building rather
   than a from-scratch editor: two thirds of it is running on this site now. */
const PIPELINE = [
  {
    step: "01",
    title: "Draw it",
    room: "The Art Room",
    href: "/natural-media-lab",
    status: "Working now",
    copy: "Paint sprites, tiles and backgrounds in the browser, then export them to your own machine.",
  },
  {
    step: "02",
    title: "Score it",
    room: "The Music Sandbox",
    href: "/music",
    status: "Working now",
    copy: "Build sound effects on the synth and beds on the drum machine, and export those too.",
  },
  {
    step: "03",
    title: "Assemble it",
    room: "The Game Lab",
    href: null,
    status: "In progress",
    copy: "Snap code blocks together to make the game, then load in the art and audio you just made.",
  },
];

export default function WorkshopPage() {
  return (
    <main className="min-h-screen bg-moonlit-950">
      <RoomHero
        roomSlug="workshop"
        title="The Workshop"
        subtitle="Build a game from art you drew and sounds you made — or hire me to build the software."
      />

      {/* ===== THE GAME LAB ===== */}
      <section className="relative overflow-hidden border-b border-moonlit-700/40 px-6 py-24">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
                The Game Lab
              </p>
              <span className="border border-burgundy-400/60 bg-burgundy-950/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-burgundy-100">
                In progress
              </span>
            </div>
            <h2 className="font-display text-4xl leading-tight text-moonlit-50 md:text-5xl">
              Make the art. Make the noise.
              <span className="block text-brass-200">Then make the game.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-moonlit-200">
              The manor already has a painting studio and a synthesiser. The Game Lab is the
              room that joins them up: draw a sprite in the Art Room, build its sound in the
              Music Sandbox, then snap together code blocks to turn the pieces into something
              playable. No engine to install and no programming language to learn first.
            </p>
          </div>

          {/* The three-step pipeline */}
          <ol className="mt-14 grid gap-px overflow-hidden border border-moonlit-700/70 bg-moonlit-700/70 md:grid-cols-3">
            {PIPELINE.map((stage) => (
              <li key={stage.step} className="flex flex-col bg-moonlit-950/95 p-7">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg text-brass-400">{stage.step}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      stage.href ? "text-brass-400" : "text-burgundy-200"
                    }`}
                  >
                    {stage.status}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-2xl text-white">{stage.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-moonlit-300">
                  {stage.copy}
                </p>
                {stage.href ? (
                  <Link
                    href={stage.href}
                    className="mt-6 inline-block text-xs uppercase tracking-[0.14em] text-brass-300 transition hover:text-brass-100"
                  >
                    Open {stage.room} →
                  </Link>
                ) : (
                  <span className="mt-6 inline-block text-xs uppercase tracking-[0.14em] text-moonlit-500">
                    {stage.room} — building
                  </span>
                )}
              </li>
            ))}
          </ol>

          {/* The privacy model, which is the same one the rest of the manor runs on
              and is a consequence of the site being static rather than a promise
              layered on top of it. */}
          <div className="mt-12 grid gap-8 border border-brass-700/40 bg-moonlit-950/70 p-8 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
                Your work stays yours
              </h3>
              <p className="mt-4 leading-relaxed text-moonlit-200">
                Nothing you make here is uploaded. There is no account and no cloud project
                storage — the tools run in your browser, and you save your sprites, sounds and
                games to your own machine, then load them back in when you return.
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-brass-400">
                What's coming with it
              </h3>
              <ul className="mt-4 grid gap-2.5 text-moonlit-200">
                {[
                  "A starter set of code blocks for a few game shapes",
                  "A walkthrough that builds one game end to end",
                  "Import for anything you exported from the other rooms",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-1 text-brass-400">
                      ▸
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-10 text-moonlit-300">
            Want to be told when it opens?{" "}
            <Link
              href="/contact"
              className="text-brass-300 underline underline-offset-4 transition hover:text-brass-200"
            >
              Send me a line
            </Link>{" "}
            — and in the meantime, the{" "}
            <Link
              href="/arcade"
              className="text-brass-300 underline underline-offset-4 transition hover:text-brass-200"
            >
              Arcade
            </Link>{" "}
            has twelve finished games to play.
          </p>
        </div>
      </section>

      {/* ===== COMMISSIONS ===== */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
            Or hire the workshop
          </p>
          <h2 className="mt-5 max-w-3xl font-display text-4xl leading-tight text-moonlit-50 md:text-5xl">
            Software built by someone who ships it.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-moonlit-200">
            Everything in this manor — the games, the painting studio, the synthesiser, the 3D
            rooms — was built here. If you need an application, a tool or a game of your own,
            that is the same workshop and the same hands.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding/orientation?service=software"
              className="bg-brass-300 px-7 py-3.5 text-center text-sm font-bold uppercase tracking-[0.18em] text-moonlit-950 transition hover:bg-brass-200"
            >
              Start a software project
            </Link>
            <Link
              href="/services#software"
              className="border border-brass-500/70 px-7 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.18em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
            >
              What it involves
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
