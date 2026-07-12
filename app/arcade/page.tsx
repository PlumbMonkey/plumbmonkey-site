import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spectral Manor Arcade | Plumbmonkey Media",
  description:
    "Play the Spectral Manor Series — four Ghost Circuit arcade games. Defender, Food Fight, Robotron & Joust reborn inside the haunted manor.",
  keywords: [
    "spectral manor arcade",
    "ghost circuit games",
    "plumbmonkey arcade",
    "browser games",
    "indie games",
  ],
  openGraph: {
    title: "Spectral Manor Arcade",
    description: "Four classic arcade games reborn inside the Ghost Circuit universe.",
    type: "website",
  },
};

const games = [
  {
    href: "/arcade/games/spectral-manor-revenger/",
    genre: "Defender Style",
    genreColor: "text-amber-400",
    icon: "🚀",
    title: "Spectral Manor Revenger",
    description:
      "Side-scrolling defense of the Ghost Circuit concert. Shoot ghosts & UAPs (spheres, capsules, cylinders, pyramids) before they abduct the fans.",
    tags: ["Neon Lasers", "Rescue Fans", "Power-ups"],
  },
  {
    href: "/arcade/games/spectral-food-fight/",
    genre: "Food Fight Style",
    genreColor: "text-pink-400",
    icon: "🍗",
    title: "Spectral Food Fight",
    description:
      "The manor cafeteria has gone insane. Throw food at vampires, werewolves, Frankensteins, ghosts & witches — while they throw food at each other.",
    tags: ["Monster Chaos", "Mouse Aim", "Food Ammo"],
  },
  {
    href: "/arcade/games/spectral-robotron/",
    genre: "Robotron Style",
    genreColor: "text-cyan-400",
    icon: "👾",
    title: "Spectral Robotron",
    description:
      "Twin-stick arena. Monsters hunt screaming Ghost Circuit fans. Move with WASD, shoot with the mouse. Rescue the crowd before they're dragged away.",
    tags: ["Twin Stick", "Save Fans", "Wave Survival"],
  },
  {
    href: "/arcade/games/spectral-skyline/",
    genre: "Joust Style",
    genreColor: "text-violet-400",
    icon: "🦉",
    title: "Spectral Skyline",
    description:
      "Ride Luno the owl-griffin across the haunted skyline. Flap, dive, and bump witches from above — they shatter into crystals. Watch for ghosts and aliens on floating platforms.",
    tags: ["Ride Luno", "Crystal Witches", "Sky Combat"],
  },
];

export default function ArcadePage() {
  return (
    <main className="min-h-screen bg-[#07040f] text-purple-100">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-10 text-center">
        <p className="text-purple-400 text-sm tracking-[0.3em] uppercase mb-3">
          Enter the Game Room
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold text-purple-200 mb-4 tracking-wider"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          Spectral Manor Arcade
        </h1>
        <p className="text-purple-300/80 max-w-2xl mx-auto text-lg">
          Four classic arcade experiences reborn inside the Ghost Circuit universe.
          <br className="hidden sm:block" />
          Defend the concert. Save the fans. Rule the cafeteria. Rule the skyline.
        </p>
      </section>

      {/* Game grid */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {games.map((game) => (
            <a
              key={game.href}
              href={game.href}
              className="group block border border-purple-800/60 rounded-xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-500 hover:shadow-[0_0_40px_rgba(168,85,247,0.35)]"
              style={{
                background: "linear-gradient(145deg, #1a1025 0%, #0f0a18 100%)",
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <span
                  className={`text-xs tracking-widest uppercase ${game.genreColor}`}
                >
                  {game.genre}
                </span>
                <span className="text-2xl">{game.icon}</span>
              </div>

              <h2
                className="text-2xl text-purple-100 mb-2 font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                {game.title}
              </h2>

              <p className="text-purple-300/70 text-sm leading-relaxed mb-4">
                {game.description}
              </p>

              <div className="flex flex-wrap gap-2 text-xs">
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded bg-purple-900/50 text-purple-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 text-xs text-purple-500 group-hover:text-purple-300 transition-colors">
                Play now →
              </div>
            </a>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-14 text-center border-t border-purple-900/40 pt-10">
          <p className="text-purple-400 text-sm tracking-wide">
            Part of the{" "}
            <span className="text-purple-200">Ghost Circuit</span> universe ·
            Built by Plumbmonkey Media
          </p>
          <p className="text-purple-600 text-xs mt-2">
            Free to play · More coming soon
          </p>
        </div>
      </section>
    </main>
  );
}
