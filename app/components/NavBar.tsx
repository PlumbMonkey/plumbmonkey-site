"use client";

import Link from "next/link";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold lowercase">
          plumbmonkey
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/how-it-works" className="hover:text-teal-400">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-teal-400">
            Pricing
          </Link>
          <Link href="/onboarding" className="hover:text-teal-400">
            Start a Project
          </Link>
          <Link href="/upload" className="hover:text-teal-400">
            Upload
          </Link>
        </div>
      </nav>
    </header>
  );
}
