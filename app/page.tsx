
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20 bg-zinc-950 text-zinc-50">
      <h1 className="text-4xl md:text-6xl font-bold mb-6">Welcome to Plumbmonkey!</h1>
      <p className="text-lg text-zinc-400 mb-8 max-w-2xl">
        Professional video editing, transparent pricing, and honest timelines.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/pricing-scope.html"
          className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold text-lg hover:bg-teal-500 transition"
        >
          View Pricing
        </a>
        <a
          href="/onboarding.html"
          className="px-6 py-3 rounded-lg bg-purple-600 text-white font-semibold text-lg hover:bg-purple-500 transition"
        >
          Start a Project
        </a>
        <a
          href="https://plumbmonkey.gumroad.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 rounded-lg bg-orange-600 text-white font-semibold text-lg hover:bg-orange-500 transition"
        >
          Shop Digital Tools
        </a>
      </div>
    </main>
  );
}