/* ============================================================
   Plumbmonkey — THE canonical service list. Single source of truth.

   The studio side of the site reads from this file:
     · app/services/page.tsx      the service index
     · app/components/Footer.tsx  the "What I do" column
     · app/components/OrientationQuestionnaire.tsx  the first question

   It exists for the same reason public/shared/rooms.js does. Before it, the
   commercial pages each described the studio in their own words and the site
   sold one thing in three different vocabularies: /pricing-scope offered three
   video tiers, /sales-hub offered digital products, and the intake form opened
   with "Let's talk about your video". Nothing on the site said what the studio
   actually does.

   PROOF, NOT CLAIMS. Every service names a room that already demonstrates it,
   because the rooms are not decoration around the portfolio — they ARE the
   portfolio. The Arcade is twelve games that run; the Art Room is a painting
   application; the Music Sandbox is a working instrument. A visitor who wants
   to know whether the software line is real can go and use the software. Keep
   `proof` pointing at something a stranger can open and try in one click, and
   drop the field before pointing it at something that only asserts.

   PRICES ARE REAL OR ABSENT. `pricing.kind: "tiered"` means published rates
   exist and are honoured (video editing — see app/pricing-scope/page.tsx, whose
   Stripe links are live). Everything else is "scoped", which prints the cost
   DRIVERS rather than a number. Do not fill these in with plausible-looking
   figures to make the page feel finished: the store already did that and
   shipped twelve invented products behind dead checkout links.
   ============================================================ */

export type Service = {
  slug: string;
  /** Short label — nav, footer, the intake form's first question. */
  label: string;
  /** Full name, for headings. */
  name: string;
  tagline: string;
  /** Two or three sentences. What it is, in plain words. */
  blurb: string;
  /** Concrete things a client receives. */
  deliverables: string[];
  /** A room on this site that already does this, openable in one click. */
  proof?: { href: string; label: string; note: string };
  pricing:
    | { kind: "tiered"; from: string; href: string; note: string }
    | { kind: "scoped"; drivers: string[]; note: string };
  /** Stated plainly on the page. Honesty about limits is a feature here. */
  caveat?: string;
};

export const SERVICES: Service[] = [
  {
    slug: "software",
    label: "Software",
    name: "Software development",
    tagline: "Apps, tools and games — built and shipped.",
    blurb:
      "Desktop and browser software, built end to end by one person who also does the art and the audio. That combination is the point: creative tools get designed by someone who uses them, and games arrive with their own soundtrack.",
    deliverables: [
      "Desktop applications (Windows)",
      "Browser-based tools that run without an account",
      "Games — browser or native",
      "Audio and creative tooling",
      "Prototypes for a pitch or a proof of concept",
    ],
    proof: {
      href: "/arcade",
      label: "Play the Arcade",
      note: "Twelve original games, running in your browser right now — not screenshots.",
    },
    pricing: {
      kind: "scoped",
      drivers: [
        "Scope — one tool, or an application with a roadmap",
        "Platform — browser, desktop, or both",
        "Whether it ships to a store, and who maintains it after",
      ],
      note: "Quoted per project after a short conversation about scope.",
    },
  },
  {
    slug: "scoring",
    label: "Scoring",
    name: "Music & scoring",
    tagline: "Original score for film and games first — TV and social too.",
    blurb:
      "Original music written to picture, to a brief, or to a world. Game scoring gets the treatment it needs — loopable cues, stems that layer, and music that survives being cut into by the player rather than the editor.",
    deliverables: [
      "Original score written to picture",
      "Loopable game cues and adaptive stems",
      "Theme and identity music",
      "Short-form beds for social",
      "Delivered as stems, not just a stereo bounce",
    ],
    proof: {
      href: "/music",
      label: "Open the Music Sandbox",
      note: "A drum machine, a synth and a song editor — built here, and used here.",
    },
    pricing: {
      kind: "scoped",
      drivers: [
        "Minutes of finished music, and how many distinct cues",
        "Live instrumentation versus programmed",
        "Licence — where it runs, for how long, and how exclusively",
      ],
      note: "Quoted per project. Licensing is agreed in writing before a note is written.",
    },
  },
  {
    slug: "design",
    label: "Design & animation",
    name: "Graphic design & animation",
    tagline: "Identity, artwork and motion.",
    blurb:
      "Design that moves when it needs to. Logos and key art through to title sequences and full 3D animation, with the 2D and 3D sides handled by the same pair of hands so the still and the moving version never drift apart.",
    deliverables: [
      "Logos, identity and brand marks",
      "Key art, covers and thumbnails",
      "2D motion graphics and title sequences",
      "3D modelling, lighting and animation",
      "Animated logo stings and openers",
    ],
    proof: {
      href: "/gallery",
      label: "Walk the Gallery",
      note: "A two-storey exhibition hall, modelled and lit here, explorable in 3D.",
    },
    pricing: {
      kind: "scoped",
      drivers: [
        "Number of finished assets, and how many directions explored first",
        "2D or 3D — and whether anything needs to be modelled from scratch",
        "Seconds of animation, which is the real cost driver in motion work",
      ],
      note: "Quoted per project. Single assets can be flat-rated.",
    },
  },
  {
    slug: "video",
    label: "Video editing",
    name: "Video editing",
    tagline: "Cut, colour, sound, finish.",
    blurb:
      "The line the studio started on, and it is not going anywhere. Footage in, finished video out — with the colour and the sound treated as part of the edit rather than something bolted on at the end.",
    deliverables: [
      "Story-led editing from your rushes",
      "Colour correction and grading",
      "Audio cleanup, mix and sound design",
      "Captions, titles and motion graphics",
      "Multi-aspect exports for every platform",
    ],
    proof: {
      href: "/screening-room",
      label: "Visit the Theatre",
      note: "Finished work, playing in the manor's own screening room.",
    },
    pricing: {
      kind: "tiered",
      from: "$150",
      href: "/pricing-scope",
      note: "Three published packages, $150 to $3,500+ per video, bookable directly.",
    },
  },
  {
    slug: "music-video",
    label: "Music video",
    name: "Music video production",
    tagline: "Post, effects and animation for artists.",
    blurb:
      "Music videos built in post. Bring footage and I will cut, grade and build effects over it — or skip the camera entirely and go animated, which is often the better answer for an independent budget anyway.",
    deliverables: [
      "Edit, grade and finish from your footage",
      "VFX and compositing",
      "Fully animated videos, 2D or 3D",
      "Lyric videos and visualisers",
      "Performance-sync and beat-cut editing",
    ],
    proof: {
      href: "/screening-room",
      label: "Visit the Theatre",
      note: "Finished work, playing in the manor's own screening room.",
    },
    caveat:
      "I don't run a camera crew. If your track needs a shoot, I'll help you find a crew to work alongside — and I take it from the moment the footage lands.",
    pricing: {
      kind: "scoped",
      drivers: [
        "Shot footage versus fully animated — animation is priced by the second",
        "Effects load, and how much needs tracking or rotoscoping",
        "Whether the track also needs scoring or a remix",
      ],
      note: "Quoted per project. Animated videos are scoped by the second, not the minute.",
    },
  },
];

/** The service a slug names, or null. */
export function serviceFor(slug: string): Service | null {
  return SERVICES.find((s) => s.slug === slug) || null;
}

/** Options for the intake form's opening question, plus its escape hatch. */
export const SERVICE_OPTIONS: { value: string; label: string }[] = [
  ...SERVICES.map((s) => ({ value: s.slug, label: s.name })),
  { value: "several", label: "Several of these" },
  { value: "unsure", label: "Not sure yet — help me work it out" },
];
