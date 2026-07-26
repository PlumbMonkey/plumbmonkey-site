import type { Metadata } from "next";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Studio | Plumbmonkey",
  description: "Original music scoring, for hire — composed to picture.",
};

export default function StudioPage() {
  return (
    <main className="min-h-screen">
      <RoomHero
        roomSlug="studio"
        title="The Studio"
        subtitle="Music scoring, for hire — composed to your brief."
      />
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-lg text-moonlit-200">
          Packages and samples are being moved in. In the meantime, get in touch about a score.
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
