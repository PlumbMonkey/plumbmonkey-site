"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Canonical room list — see public/shared/rooms.js. The static pages read the
// same file at runtime, so the nav cannot drift between the React side and the
// standalone tools.
//
// entrance() is where a room's door is: its 3D space when it has one, its page
// otherwise. Link to it rather than to `href`, or the Luminarium and the Art
// Room lose the only menu that reaches their rooms.
import { ROOMS as LINKS, CTA, entrance } from "@/public/shared/rooms";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-moonlit-950/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center border border-brass-500/60 font-display text-brass-300">
            P
          </span>
          <span>
            <span className="block font-display text-base leading-none text-white">Plumbmonkey</span>
            <span className="mt-1 block text-[8px] uppercase tracking-[0.26em] text-moonlit-400">
              Spectral Manor
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 text-xs uppercase tracking-[0.14em] text-moonlit-200 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={entrance(link)}
              className="transition hover:text-brass-300"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={CTA.href}
            className="border border-brass-500/70 px-4 py-2 text-brass-200 transition hover:bg-brass-400 hover:text-moonlit-950"
          >
            {CTA.label}
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center border border-white/15 text-xl text-white lg:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "×" : "☰"}
        </button>
      </nav>

      <div
        id="mobile-navigation"
        className={`${open ? "grid" : "hidden"} border-t border-white/10 bg-moonlit-950 px-5 py-5 lg:hidden`}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={entrance(link)}
            className="border-b border-white/10 py-3 text-sm uppercase tracking-[0.16em] text-moonlit-100"
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href={CTA.href}
          className="mt-5 bg-brass-300 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-moonlit-950"
          onClick={() => setOpen(false)}
        >
          {CTA.label}
        </Link>
      </div>
    </header>
  );
}
