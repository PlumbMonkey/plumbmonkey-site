"use client";

import { useState } from "react";

const links = [
  { href: "/how-it-works.html", label: "Services" },
  { href: "/pricing-scope.html", label: "Pricing" },
  { href: "/music", label: "Sound Stage", creative: true },
  { href: "/visual/index.html", label: "Light Lab", creative: true },
  { href: "/arcade", label: "Arcade" },
  { href: "https://plumbmonkey.gumroad.com/", label: "Store", external: true },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/90 bg-zinc-950/92 text-zinc-100 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4" aria-label="Main navigation">
        <a href="/" className="mr-auto flex items-center gap-2 font-bold lowercase tracking-wide">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 text-teal-300">✦</span>
          <span>plumbmonkey</span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition hover:bg-zinc-800 hover:text-white ${
                link.creative ? "text-cyan-200" : "text-zinc-300"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="/onboarding/orientation"
          className="hidden rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-teal-300 sm:inline-flex"
        >
          Start a project
        </a>
        <a
          href="/music"
          className="inline-flex rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200 lg:hidden"
        >
          Create
        </a>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-xl lg:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "×" : "☰"}
        </button>
      </nav>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 pb-5 pt-3 lg:hidden">
          <div className="mx-auto grid max-w-6xl gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-3 text-sm hover:bg-zinc-900 ${
                  link.creative ? "text-cyan-200" : "text-zinc-200"
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/onboarding/orientation"
              className="mt-2 rounded-lg bg-teal-400 px-4 py-3 text-center text-sm font-bold text-zinc-950"
              onClick={() => setOpen(false)}
            >
              Start a project
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
