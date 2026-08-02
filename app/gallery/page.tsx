import type { Metadata } from "next";
import EnterRoomLink from "../components/EnterRoomLink";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Gallery | Plumbmonkey",
  description: "3D & digital art — models, materials, and animation assets.",
};

export default function GalleryPage() {
  return (
    <main className="min-h-screen">
      <RoomHero
        roomSlug="gallery"
        title="The Gallery"
        subtitle="3D & digital art — for sale, or by commission."
      />
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-lg text-moonlit-200">
          Step inside the Victorian Haunted Gallery — a two-storey exhibition hall of
          instruments, artwork and curiosities, rendered in 3D and explorable in your browser.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <EnterRoomLink
            href="/gallery/viewer.html"
            model="/gallery/gallery-web.glb"
            className="inline-block rounded-lg bg-brass-500 px-8 py-3 font-bold text-moonlit-950 shadow transition hover:bg-brass-400"
          >
            Enter the Gallery
          </EnterRoomLink>
          <a
            href="/contact"
            className="inline-block rounded-lg border border-brass-500/50 px-8 py-3 font-bold text-brass-300 transition hover:border-brass-400 hover:text-brass-200"
          >
            Commission a Piece
          </a>
        </div>
        <p className="mt-6 text-sm text-moonlit-400">
          Best on desktop · drag to look, scroll to zoom · roughly 4&nbsp;MB to load
        </p>
      </section>
    </main>
  );
}
