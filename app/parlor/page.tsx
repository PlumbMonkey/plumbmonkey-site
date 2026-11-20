import type { Metadata } from "next";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Parlor | Plumbmonkey",
  description: "Original music — stream, or own it outright.",
};

export default function ParlorPage() {
  return (
    <main className="min-h-screen">
      <RoomHero
        roomSlug="parlor"
        title="The Parlor"
        subtitle="Original releases — stream, or own it outright."
      />
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-lg text-moonlit-200">
          Releases are being moved in. In the meantime, get in touch or check the store.
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
