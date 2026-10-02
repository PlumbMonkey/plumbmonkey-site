import Link from "next/link";
import type { ReactNode } from "react";

/* Shared frame for the legal pages (/privacy, /terms) so the two read as one
   document set and the long-form typography lives in one place. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-moonlit-950 via-moonlit-900 to-moonlit-950 px-4 pb-24 pt-32 text-moonlit-50 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
          Plumbmonkey · 3D Product Rotator
        </p>
        <h1 className="mb-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
        <p className="mb-10 text-sm text-moonlit-400">Last updated: {updated}</p>
        <div className="space-y-5 text-base leading-relaxed text-moonlit-200 [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-moonlit-50 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-moonlit-50 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2 [&_a]:text-brass-300 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-brass-200 [&_strong]:text-moonlit-50">
          {children}
        </div>
        <p className="mt-14 border-t border-moonlit-700/50 pt-6 text-sm text-moonlit-400">
          <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link> ·{" "}
          <Link href="/contact">Contact</Link>
        </p>
      </article>
    </main>
  );
}
