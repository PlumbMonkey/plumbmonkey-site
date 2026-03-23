'use client';

import { useEffect } from 'react';

export default function PricingPage() {
  useEffect(() => {
    window.location.replace('/pricing-scope.html');
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50">
      <p className="text-zinc-400">Redirecting to pricing...</p>
    </main>
  );
}
