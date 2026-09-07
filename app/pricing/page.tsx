"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * /pricing is an alias kept for old links. It used to bounce to the legacy
 * hand-written /pricing-scope.html, which is the pre-React page in the original
 * orange palette — so the one route most likely to be reached from a search
 * result or an old quote was also the one that skipped the styled page
 * entirely. It now lands on the React page.
 *
 * `output: 'export'` in next.config.js means there is no server to issue a 308,
 * so the hop is client-side. `replace` rather than `assign` keeps it out of the
 * back button, and the markup below is a real fallback for anyone who arrives
 * with JavaScript disabled rather than a flash of throwaway text.
 */
export default function PricingPage() {
  useEffect(() => {
    window.location.replace("/pricing-scope");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-moonlit-950 px-6 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
          One moment
        </p>
        <h1 className="mt-4 font-display text-3xl text-moonlit-50">Taking you to pricing…</h1>
        <Link
          href="/pricing-scope"
          className="mt-8 inline-block border border-brass-500/70 px-6 py-3 text-xs uppercase tracking-[0.14em] text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
        >
          Continue to pricing
        </Link>
      </div>
    </main>
  );
}
