import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20 bg-zinc-950 text-zinc-50">
      <h1 className="text-4xl md:text-6xl font-bold mb-6">Welcome to Plumbmonkey!</h1>
      <p className="text-lg text-zinc-400 mb-8 max-w-2xl">
        Professional video editing, transparent pricing, and honest timelines.
      </p>
      <Link
        href="/pricing"
        className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold text-lg hover:bg-teal-500 transition"
      >
        View Pricing & Start a Project
      </Link>
    </main>
  );
}