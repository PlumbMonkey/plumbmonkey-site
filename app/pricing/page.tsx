import React from "react";
import Link from "next/link";

export default function Page() {
  return (
    <header className="w-full bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 py-16 px-4 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Simple, transparent pricing for VFX projects
        </h1>
        <p className="text-lg md:text-xl text-zinc-700 dark:text-zinc-300 mb-8">
          Choose the plan that fits your production. No hidden fees, no surprises.
        </p>
        <Link
          href="/onboarding"
          className="inline-block px-8 py-3 rounded-lg bg-teal-500 text-white font-semibold text-lg shadow hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          aria-label="Start a Project"
        >
          Start a Project
        </Link>
      </div>
    </header>
  );
}