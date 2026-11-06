import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Room Not Found | Plumbmonkey",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-4 font-display text-4xl font-bold">This room isn&apos;t on the map.</h1>
      <p className="mb-8 max-w-md text-moonlit-300">
        The door you&apos;re looking for doesn&apos;t exist, or has moved. Head back to the foyer
        and try another one.
      </p>
      <a
        href="/"
        className="rounded-lg bg-brass-500 px-6 py-3 font-bold text-moonlit-950 shadow transition hover:bg-brass-400"
      >
        Back to the Foyer
      </a>
    </main>
  );
}
