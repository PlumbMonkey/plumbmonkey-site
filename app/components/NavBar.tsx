"use client";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="font-bold lowercase">
          plumbmonkey
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/how-it-works.html" className="hover:text-teal-400">
            How it works
          </a>
          <a href="/pricing-scope.html" className="hover:text-teal-400">
            Pricing
          </a>
          <a href="https://plumbmonkey.gumroad.com/" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400">
            Plumbmonkey Store
          </a>
          <a href="/onboarding/orientation" className="hover:text-teal-400">
            Start a Project
          </a>
          <a href="/upload.html" className="hover:text-teal-400">
            Upload
          </a>
          <a href="/arcade" className="hover:text-purple-400 text-purple-300/80">
            Spectral Manor Arcade
          </a>
        </div>
      </nav>
    </header>
  );
}
