import type { Metadata } from "next";
import RoomHero from "../components/RoomHero";

export const metadata: Metadata = {
  title: "The Gift Shop | Plumbmonkey",
  description: "Print-ready art and merch from Plumbmonkey.",
};

export default function GiftShopPage() {
  return (
    <main className="min-h-screen">
      <RoomHero
        roomSlug="gift-shop"
        title="The Gift Shop"
        subtitle="Wearable art, ready to print. Physical merch is next."
      />
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-lg text-moonlit-200">
          Print-ready designs are being moved in. A live print-on-demand store follows once
          there&apos;s an audience to support it.
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
