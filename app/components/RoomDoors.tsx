import Link from "next/link";
import { ROOMS as CANONICAL, entrance } from "@/public/shared/rooms";

/* The home page's doors. Same rooms, same order and same destinations as the
   nav: each card links through entrance(), so a room with a 3D space is entered
   through it here exactly as it is from the bar. This list only adds the
   presentation the nav has no room for — display name, tagline, still.

   `href` must be the room's canonical href from /shared/rooms.js:
   scripts/check-room-lists.mjs reads these literals and fails `npm test` if the
   two lists drift. Order comes from rooms.js, not from this array.

   Stills are captured from each room's own 3D viewer (public/rooms/<x>/door.jpg,
   960x640). The Workshop has no room yet, so it gets a drawn placeholder and an
   honest "in progress" tag instead of a picture of something else. */
const DOORS = [
  {
    href: "/arcade",
    name: "The Arcade",
    tagline: "Play the haunted halls",
    description: "Twelve original browser games, each in its own cabinet, with global high scores.",
    image: "/rooms/arcade/door.jpg",
    alt: "A row of glowing arcade cabinets in the manor's arcade",
  },
  {
    href: "/music",
    name: "The Music Sandbox",
    tagline: "Make some noise",
    description: "Build beats, shape synths, arrange songs, and export what you create.",
    image: "/rooms/music/door.jpg",
    alt: "The music room's drum machine and synthesizer consoles either side of a song wall",
  },
  {
    href: "/visual/index.html",
    name: "The Luminarium",
    tagline: "Conduct light",
    description: "Turn any track into cinematic, audio-reactive light, then record it as a video.",
    image: "/rooms/luminarium/door.jpg",
    alt: "The Luminarium's rotunda under a dome of violet light",
  },
  {
    href: "/natural-media-lab",
    name: "The Art Room",
    tagline: "Paint, ink & pigment",
    description: "Natural-media brushes, comics and frame animation, right in the browser.",
    image: "/rooms/artroom/door.jpg",
    alt: "The Art Room's easel beneath a stained-glass skylight",
  },
  {
    href: "/screening-room",
    name: "The Theatre",
    tagline: "Stories in motion",
    description: "Animation, music videos and cinematic experiments in a haunted opera house.",
    image: "/rooms/theatre/door.jpg",
    alt: "The Spectral Grand Theatre's stage, with a grand piano under a single spotlight",
  },
  {
    href: "/gallery",
    name: "The Gallery",
    tagline: "Characters, sets & worlds",
    description: "A two-storey hall of the 2D and 3D artwork behind Spectral Manor.",
    image: "/rooms/gallery/door.jpg",
    alt: "The gallery's grand hall, with framed artwork and a sweeping staircase",
  },
  {
    href: "/workshop",
    name: "The Workshop",
    tagline: "Tools for making",
    description: "The Game Lab: build a game from art you drew and sounds you made. Being built now.",
    image: null,
    alt: "",
    status: "In progress",
  },
];

/* Wide cards keep the 3-column grid square: the Arcade leads the first row and
   the Workshop finishes the last, so seven rooms fill three rows exactly. */
const WIDE = new Set(["/arcade", "/workshop"]);

const ordered = CANONICAL.map((room) => {
  const door = DOORS.find((d) => d.href === room.href);
  return door ? { ...door, to: entrance(room) } : null;
}).filter((d): d is (typeof DOORS)[number] & { to: string } => d !== null);

export default function RoomDoors() {
  return (
    <section id="rooms" className="relative bg-moonlit-950 px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brass-400">
              Explore the rooms
            </p>
            <h2 className="font-display text-4xl text-moonlit-50 md:text-5xl">
              Seven doors. One world.
            </h2>
          </div>
          <p className="max-w-sm text-moonlit-300">
            Every room is free to enter, and everything you make inside stays on your device.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((room, i) => (
            <Link
              key={room.href}
              href={room.to}
              className={`group relative flex min-h-[19rem] flex-col justify-end overflow-hidden border border-moonlit-700/60 bg-moonlit-900 transition duration-500 hover:border-brass-400/70 focus-visible:border-brass-300 focus-visible:outline-none ${
                room.href === "/arcade" ? "sm:col-span-2" : ""
              } ${WIDE.has(room.href) && room.href !== "/arcade" ? "lg:col-span-2" : ""}`}
            >
              {room.image ? (
                <img
                  src={room.image}
                  alt={room.alt}
                  width={960}
                  height={640}
                  loading={i < 3 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-moonlit-900 bg-[linear-gradient(rgba(217,172,82,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(217,172,82,.07)_1px,transparent_1px)] bg-[size:32px_32px]"
                />
              )}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-moonlit-950 via-moonlit-950/70 to-moonlit-950/5"
              />

              <div className="relative p-6 md:p-7">
                <div className="mb-2 flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-300">
                    {room.tagline}
                  </p>
                  {"status" in room && room.status && (
                    <span className="border border-burgundy-400/60 bg-burgundy-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-burgundy-100">
                      {room.status}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-3xl text-white">{room.name}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-moonlit-200">
                  {room.description}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-brass-300 transition-transform duration-300 group-hover:translate-x-1"
                >
                  Enter →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
