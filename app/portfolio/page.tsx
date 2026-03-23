"use client";

import { useEffect } from "react";

export default function PortfolioRedirect() {
  useEffect(() => {
    window.location.replace("/#portfolio");
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
      <p className="text-zinc-400">Redirecting to portfolio…</p>
    </main>
  );
}
