import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spectral Manor Arcade | Plumbmonkey Media",
  description:
    "Play the Spectral Manor Series — eight Ghost Circuit arcade games across two waves. Defender, Food Fight, Robotron, Joust, Racing, Asteroids, Centipede & Pac-Man reborn inside the haunted manor.",
  keywords: [
    "spectral manor arcade",
    "ghost circuit games",
    "plumbmonkey arcade",
    "browser games",
    "indie games",
  ],
  openGraph: {
    title: "Spectral Manor Arcade",
    description: "Eight classic arcade games reborn inside the Ghost Circuit universe.",
    type: "website",
  },
};

const games = [
  {
    href: "/arcade/games/spectral-manor-revenger/",
    icon: "🚀",
    title: "Spectral Manor Revenger",
    description:
      "Side-scrolling defense of the Ghost Circuit concert. Shoot ghosts & UAPs (spheres, capsules, cylinders, pyramids) before they abduct the fans.",
    tags: ["Neon Lasers", "Rescue Fans", "Power-ups"],
  },
  {
    href: "/arcade/games/spectral-food-fight/",
    icon: "🍗",
    title: "Spectral Manor Mess Hall",
    description:
      "The manor cafeteria has gone insane. Throw food at vampires, werewolves, Frankensteins, ghosts & witches — while they throw food at each other.",
    tags: ["Monster Chaos", "Mouse Aim", "Food Ammo"],
  },
  {
    href: "/arcade/games/spectral-robotron/",
    icon: "👾",
    title: "Spectral Manor Swarm",
    description:
      "Twin-stick arena. Monsters hunt screaming Ghost Circuit fans. Move with WASD, shoot with the mouse. Rescue the crowd before they're dragged away.",
    tags: ["Twin Stick", "Save Fans", "Wave Survival"],
  },
  {
    href: "/arcade/games/spectral-skyline/",
    icon: "🦉",
    title: "Spectral Manor: Luno's Flight",
    description:
      "Ride Luno the owl-griffin across the haunted skyline. Flap, dive, and bump witches from above — they shatter into crystals. Watch for ghosts and aliens on floating platforms.",
    tags: ["Ride Luno", "Crystal Witches", "Sky Combat"],
  },
  {
    href: "/arcade/games/spectral-manor-soul-circuit/",
    icon: "💛",
    title: "Spectral Manor Soul Circuit",
    description:
      "Navigate a dark Victorian hedge maze collecting crystals. Four classic monsters hunt you — Vampire, Frankenstein, Werewolf, and Witch. Grab a large power crystal to activate a magic field and turn the tables.",
    tags: ["Hedge Maze", "Magic Field", "Power Crystals"],
  },
  {
    href: "/arcade/games/spectral-manor-crystal-dimension/",
    icon: "🪨",
    title: "Spectral Manor Crystal Dimension",
    description:
      "Zero-gravity combat in deep space. Blast through flying rocks and space ghosts threatening the Ghost Circuit. Rotate, thrust, and fire — or be consumed by the void.",
    tags: ["Zero-G", "Space Ghosts", "Flying Rocks"],
  },
  {
    href: "/arcade/games/spectral-manor-infestation/",
    icon: "🐛",
    title: "Spectral Manor Infestation",
    description:
      "The manor grounds are overrun. A Hauntipede descends through the haunted mushroom field — blast it into pieces before it reaches you. Watch for splitting segments and surprise bugs.",
    tags: ["Haunted Bugs", "Splitting Segments", "Toadstools"],
  },
  {
    href: "/arcade/games/spectral-manor-cruise/",
    icon: "🚗",
    title: "Spectral Manor Cruise",
    description:
      "Midnight road race through the cursed countryside. Outrun Vampire, Frankenstein, Werewolf, and Witch in a pseudo-3D sprint down the haunted highway.",
    tags: ["Night Racing", "Monster Racers", "Pseudo-3D"],
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
          Eight classic arcade experiences reborn inside the Ghost Circuit universe.
          <br className="hidden sm:block" />
          Two waves of haunted action — defend, race, maze, and survive.
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
              <div className="flex items-start justify-end mb-4">
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
            Free to play · Wave 1 &amp; Wave 2 now live
          </p>
        </div>
      </section>
    </main>
  );
}
