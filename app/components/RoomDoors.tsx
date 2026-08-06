import Link from "next/link";

const ROOMS = [
  {
    href: "/arcade",
    number: "01",
    name: "The Arcade",
    tagline: "Play the haunted halls",
    description: "Original browser games, spectral visitors, leaderboards, and experiments.",
    color: "from-violet-500/20",
  },
  {
    href: "/music",
    number: "02",
    name: "The Music Sandbox",
    tagline: "Make some noise",
    description: "Build beats, shape synths, arrange songs, and export what you create.",
    color: "from-cyan-500/20",
  },
  {
    href: "/visual/index.html",
    number: "03",
    name: "The Luminarium",
    tagline: "Conduct light",
    description: "Shape sound into cinematic, audio-reactive light, motion, and atmosphere.",
    color: "from-fuchsia-500/20",
  },
  {
    href: "/screening-room",
    number: "04",
    name: "The Theatre",
    tagline: "Stories in motion",
    description: "Animation, music videos, cinematic experiments, and selected client work.",
    color: "from-amber-500/20",
  },
  {
    href: "/gallery",
    number: "05",
    name: "The Gallery",
    tagline: "Characters, sets & worlds",
    description: "The growing collection of 2D and 3D artwork behind Spectral Manor.",
    color: "from-rose-500/20",
  },
  {
    href: "/workshop",
    number: "06",
    name: "The Workshop",
    tagline: "Tools for making",
    description: "Creative software, prototypes, and open experiments built inside the studio.",
    color: "from-emerald-500/20",
  },
  {
    href: "/natural-media-lab",
    number: "07",
    name: "The Art Room",
    tagline: "Paint, ink & pigment",
    description: "Natural-media tools for drawing and painting directly in the browser.",
    color: "from-sky-500/20",
  },
];

export default function RoomDoors() {
  return (
    <section id="rooms" className="relative bg-moonlit-900/35 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brass-400">
            Explore the rooms
          </p>
          <h2 className="font-display text-4xl text-moonlit-50 md:text-5xl">
            Every door opens onto a different part of the same world.
          </h2>
        </div>

        <div className="grid border-l border-t border-moonlit-700/60 sm:grid-cols-2 lg:grid-cols-3">
          {ROOMS.map((room) => (
            <Link
              key={room.href}
              href={room.href}
              className={`group relative min-h-72 overflow-hidden border-b border-r border-moonlit-700/60 bg-gradient-to-br ${room.color} to-transparent p-7 transition duration-500 hover:bg-moonlit-800/90`}
            >
              <div className="absolute inset-x-8 top-0 h-px origin-left scale-x-0 bg-brass-300 transition-transform duration-500 group-hover:scale-x-100" />
              <span className="text-xs tracking-[0.24em] text-moonlit-500">{room.number}</span>
              <div className="mt-16">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brass-400">
                  {room.tagline}
                </p>
                <h3 className="font-display text-3xl text-white">{room.name}</h3>
                <p className="mt-4 max-w-sm leading-relaxed text-moonlit-300">{room.description}</p>
              </div>
              <span className="absolute bottom-7 right-7 text-xl text-brass-400 transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
