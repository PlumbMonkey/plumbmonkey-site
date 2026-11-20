import type { Metadata } from "next";
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
          The collection is being moved in. In the meantime, get in touch about a commission.
        </p>
        <a
          href="/contact"
          className="mt-8 inline-block rounded-lg bg-brass-500 px-8 py-3 font-bold text-moonlit-950 shadow transition hover:bg-brass-400"
        >
          Get in Touch
        </a>
      </section>
    </main>
  );
}
