import type { Metadata } from "next";
import ArcadeRoom from "../ArcadeRoom";
import NeonCursor from "../../components/NeonCursor";

export const metadata: Metadata = {
  title: "Spectral Manor Arcade | Plumbmonkey Media",
  description:
    "Play twelve original games from the Spectral Manor series, each with its own world, challenges, characters and leaderboard.",
  keywords: [
    "spectral manor arcade",
    "ghost circuit games",
    "plumbmonkey arcade",
    "browser games",
    "indie games",
  ],
  openGraph: {
    title: "Spectral Manor Arcade",
    description: "Twelve original games set inside the Ghost Circuit universe.",
    type: "website",
  },
};

export default function ArcadePage() {
  return (
    <main className="min-h-screen bg-[#07040f] text-purple-100">
      {/* Neon trail — the arcade lobby only. The games themselves opt out:
          Swarm and Mess Hall aim with the mouse, and a glowing ribbon over
          the reticle would fight the gameplay. */}
      <NeonCursor />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-28 pb-10 text-center md:pt-32">
        <p className="text-purple-400 text-sm tracking-[0.3em] uppercase mb-3">
          Welcome to the Game Room
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold text-purple-200 mb-4 tracking-wider"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          Spectral Manor Arcade
        </h1>
        <p className="text-purple-300/80 max-w-2xl mx-auto text-lg">
          Twelve original arcade experiences from inside the Ghost Circuit universe.
          <br className="hidden sm:block" />
          Step up to a cabinet — high scores are kept for every game.
        </p>
      </section>

      {/* Arcade cabinets + leaderboards (client) */}
      <ArcadeRoom />

      {/* Footer note */}
      <div className="max-w-5xl mx-auto px-6 pb-16 text-center border-t border-purple-900/40 pt-10">
        <p className="text-purple-400 text-sm tracking-wide">
          Part of the <span className="text-purple-200">Ghost Circuit</span> universe ·
          Built by Plumbmonkey Media
        </p>
        <p className="text-purple-600 text-xs mt-2">
          Free to play · Wave 1 &amp; Wave 2 now live
        </p>
      </div>
    </main>
  );
}
