/* ============================================================
   Plumbmonkey — THE canonical product catalogue.

   Every product here is REAL: title, price and `id` were read off
   https://plumbmonkey.gumroad.com on 2026-09-07, and each `id` is the live
   Gumroad permalink. Cover art was downloaded from Gumroad's CDN into
   public/store/ rather than hotlinked, so the shop does not go blank if that
   CDN moves a file.

   THIS FILE REPLACED TWELVE INVENTED PRODUCTS. /sales-hub used to list things
   like "Cinematic MIDI Vol. 01 — $29" and "Quick Background Remover — $49"
   across three category pages, each with a plausible-looking Gumroad URL. None
   of them existed; every checkout link returned 404. A visitor could read three
   pages of catalogue, pick a product, click Buy and land on an error page.

   So: do not add a product here that is not live on Gumroad, and do not invent
   a price. If something is coming, say so in prose on the page — the shop shows
   a "more on the way" note for exactly that purpose. Verify a permalink
   resolves before adding it:

       curl -s -o /dev/null -w '%{http_code}' -L https://plumbmonkey.gumroad.com/l/<id>

   PRICES ARE CANADIAN DOLLARS, which is what the store charges and what it
   shows a Canadian visitor. Gumroad converts at checkout for everyone else, so
   the page says CAD explicitly rather than a bare "$5" that a US visitor would
   reasonably read as USD.
   ============================================================ */

export type Product = {
  /** Gumroad permalink — the bit after /l/. */
  id: string;
  title: string;
  /** One line, drawn from the product's own Gumroad description. */
  blurb: string;
  /** Display price, CAD. A trailing "+" means pay-what-you-want above a floor. */
  price: string;
  category: ProductCategory;
  /** Under public/store/, downloaded from Gumroad. */
  image: string;
};

export type ProductCategory = "midi" | "music" | "tools";

export const CATEGORIES: { id: ProductCategory; label: string; blurb: string }[] = [
  {
    id: "midi",
    label: "MIDI packs",
    blurb: "Drum and bass patterns, pre-mapped and ready to drop into a session.",
  },
  {
    id: "music",
    label: "Jams",
    blurb: "Full loop packages, played and produced here. Use them royalty-free.",
  },
  {
    id: "tools",
    label: "Tools",
    blurb: "Small software that does one job without a subscription.",
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "ldyyk",
    title: "Rock Drum MIDI Pack: Starter Edition",
    blurb: "Five hard-hitting rock grooves, sculpted for FL Studio's FPC.",
    price: "CAD$5",
    category: "midi",
    image: "/store/rock-drum-midi.png",
  },
  {
    id: "djjgbq",
    title: "MIDI Groove Pack: Starter Edition",
    blurb: "Five studio-ready drum patterns for funk, rock and swing.",
    price: "CAD$5",
    category: "midi",
    image: "/store/midi-groove.png",
  },
  {
    id: "fpfpy",
    title: "Trap Variations Drum MIDI Pack: Essential Edition",
    blurb: "Five trap grooves across five tempos — 25 MIDI patterns in all.",
    price: "CAD$12",
    category: "midi",
    image: "/store/trap-drum.png",
  },
  {
    id: "zjfoun",
    title: "Trap Bass Variations MIDI Pack: Essential Edition",
    blurb: "Five bass-line patterns at five tempos — 25 MIDI files of low end.",
    price: "CAD$12",
    category: "midi",
    image: "/store/trap-bass.png",
  },
  {
    id: "oztqk",
    title: "Quick Invoice Generator",
    blurb: "Polished invoice PDFs in seconds. No signup, no monthly fee.",
    price: "CAD$9",
    category: "tools",
    image: "/store/invoice-generator.jpg",
  },
  {
    id: "ddxxn",
    title: "Plumbmonkey Jam #8 — Last Jam of 2025",
    blurb: "Drums, bass, piano, cello and synth. Built from the ground up, human made.",
    price: "CAD$5+",
    category: "music",
    image: "/store/jam-8.jpg",
  },
  {
    id: "ecdaxh",
    title: "Plumbmonkey Jam #7",
    blurb: "A blend of drums, bass, electric guitar and synthesizer. Jam it, remix it, rewrite it.",
    price: "CAD$5+",
    category: "music",
    image: "/store/jam-7.jpg",
  },
  {
    id: "iyokro",
    title: "Plumbmonkey Jam #3",
    blurb: "Slow and creepy — drums, bass and synth.",
    price: "CAD$5+",
    category: "music",
    image: "/store/jam-3.jpg",
  },
  {
    id: "fzezkr",
    title: "Plumbmonkey Jam #1",
    blurb: "A simple drum and bass groove.",
    price: "CAD$5+",
    category: "music",
    image: "/store/jam-1.jpg",
  },
];

export const STORE_URL = "https://plumbmonkey.gumroad.com";

/** The live checkout page for a product. */
export function productUrl(product: Product): string {
  return `${STORE_URL}/l/${product.id}`;
}

export function productsIn(category: ProductCategory): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}
