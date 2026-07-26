import type { Metadata } from "next";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Workshop | Plumbmonkey",
  description: "Software, apps & games from Plumbmonkey.",
};

export default function WorkshopPage() {
  return (
    <main className="min-h-screen">
      <RoomHero
        roomSlug="workshop"
        title="The Workshop"
        subtitle="Software, apps & games — tools built to ship."
      />
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-lg text-moonlit-200">
          The full catalog is being moved in. In the meantime, get in touch about a project.
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
