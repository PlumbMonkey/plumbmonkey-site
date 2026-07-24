"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Business-facing links — the left-to-right sales path. */
const links = [
  { href: "/how-it-works.html", label: "Services" },
  { href: "/pricing-scope.html", label: "Pricing" },
];

/**
 * The Ghost Circuit universe. These three used to sit loose in the top bar
 * alongside Services and Pricing, which both crowded the nav and blurred the
 * line between "hire me" and "play with my toys". They're one world, so they
 * now live behind one tab.
 */
const ghostCircuit = [
  {
    href: "/arcade",
    label: "Arcade",
    glyph: "🕹",
    blurb: "Eight games inside the haunted manor",
  },
  {
    href: "/music",
    label: "Sound Stage",
    glyph: "♪",
    blurb: "Drum machine, synth & song arranger",
  },
  {
    href: "/visual/index.html",
    label: "Light Lab",
    glyph: "✦",
    blurb: "Audio-reactive kaleidoscope visuals",
  },
];

const store = {
  href: "https://plumbmonkey.gumroad.com/",
  label: "Store",
};

export default function NavBar() {
  const [open, setOpen] = useState(false);            // mobile sheet
  const [gcOpen, setGcOpen] = useState(false);        // Ghost Circuit dropdown
  const [gcMobileOpen, setGcMobileOpen] = useState(false); // sheet accordion
  const gcRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const inGhostCircuit = ghostCircuit.some((item) =>
    item.href.startsWith("/visual")
      ? pathname?.startsWith("/visual")
      : pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  // Any navigation closes every menu.
  useEffect(() => {
    setOpen(false);
    setGcOpen(false);
    setGcMobileOpen(false);
  }, [pathname]);

  // Click-outside and Escape. Without these a dropdown opened by touch has no
  // way to close, since there is no pointer to move away.
  useEffect(() => {
    if (!gcOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (gcRef.current && !gcRef.current.contains(e.target as Node)) setGcOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGcOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [gcOpen]);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 text-zinc-100 backdrop-blur-xl">
      {/* hairline accent — ties the bar to the Ghost Circuit palette */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <nav
        className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4"
        aria-label="Main navigation"
      >
        <a
          href="/"
          className="mr-auto flex items-center gap-2.5 font-bold lowercase tracking-wide"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-base text-cyan-300 ring-1 ring-inset ring-white/15">
            ✦
          </span>
          <span className="text-[15px]">plumbmonkey</span>
        </a>

        {/* ---------- desktop ---------- */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`relative rounded-lg px-3 py-2 text-sm transition ${
                isActive(link.href)
                  ? "bg-white/10 text-white"
                  : "text-zinc-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2.5 -bottom-[3px] h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                />
              )}
            </a>
          ))}

          {/* Ghost Circuit dropdown.
              Click-to-open rather than hover: a hover+click hybrid fights
              itself, because opening the panel shifts layout under the cursor
              and the resulting mouseover races the click. Click-only behaves
              identically for mouse, touch and keyboard. */}
          <div ref={gcRef} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={gcOpen}
              onClick={() => setGcOpen((v) => !v)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                gcOpen || inGhostCircuit
                  ? "bg-white/10 text-white"
                  : "text-zinc-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text font-semibold text-transparent">
                Ghost Circuit
              </span>
              <span
                className={`text-[10px] text-zinc-400 transition-transform duration-200 ${
                  gcOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                ▼
              </span>
              {inGhostCircuit && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2.5 -bottom-[3px] h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                />
              )}
            </button>

            {gcOpen && (
              <div className="absolute right-0 top-full w-[19rem] pt-2">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
                  <p className="px-3 pb-1.5 pt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    The Ghost Circuit universe
                  </p>
                  {ghostCircuit.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/[0.07]"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400/15 to-violet-500/15 text-sm text-cyan-300 ring-1 ring-inset ring-white/10">
                        {item.glyph}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-zinc-100 group-hover:text-white">
                          {item.label}
                        </span>
                        <span className="block text-xs leading-snug text-zinc-500">
                          {item.blurb}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a
            href={store.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            {store.label}
          </a>
        </div>

        <a
          href="/onboarding/orientation"
          className="ml-1 hidden rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-400/20 transition hover:bg-teal-300 sm:inline-flex"
        >
          Start a project
        </a>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-xl transition hover:bg-white/10 lg:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "×" : "☰"}
        </button>
      </nav>

      {/* ---------- mobile sheet ---------- */}
      {open && (
        <div className="border-t border-white/10 bg-zinc-950 px-4 pb-5 pt-3 lg:hidden">
          <div className="mx-auto grid max-w-6xl gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}

            {/* Ghost Circuit collapses behind one entry here too, mirroring the
                desktop dropdown — the three playgrounds never appear as loose
                top-level links on any surface. */}
            <button
              type="button"
              aria-expanded={gcMobileOpen}
              onClick={() => setGcMobileOpen((v) => !v)}
              className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm transition ${
                gcMobileOpen || inGhostCircuit ? "bg-white/5" : "hover:bg-white/5"
              }`}
            >
              <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text font-semibold text-transparent">
                Ghost Circuit
              </span>
              <span
                className={`text-[10px] text-zinc-400 transition-transform duration-200 ${
                  gcMobileOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
            {gcMobileOpen && (
              <div className="grid gap-1 border-l border-white/10 pl-2">
                {ghostCircuit.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/5"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400/15 to-violet-500/15 text-sm text-cyan-300 ring-1 ring-inset ring-white/10">
                      {item.glyph}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-100">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {item.blurb}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            )}

            <a
              href={store.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 rounded-lg px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
            >
              {store.label}
            </a>

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
