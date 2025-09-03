export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">
          how it works
        </h1>
        <p className="mt-2 text-sm text-zinc-400 text-center">
          Simple flow. Clear pricing. Honest timelines.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Step 1 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-teal-400 text-sm font-semibold">Step 1</div>
            <h2 className="mt-1 text-xl font-semibold">Choose your package</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Essential, Pro, or Super—each with transparent scope and included revisions.
            </p>
            <a href="/pricing" className="mt-4 inline-block text-teal-400 hover:underline">
              View pricing →
            </a>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-teal-400 text-sm font-semibold">Step 2</div>
            <h2 className="mt-1 text-xl font-semibold">Schedule / assess</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Quick assessment to estimate timeline. Book a slot or request a free bid.
            </p>
            <a href="/onboarding" className="mt-4 inline-block text-teal-400 hover:underline">
              Start assessment →
            </a>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-teal-400 text-sm font-semibold">Step 3</div>
            <h2 className="mt-1 text-xl font-semibold">Upload your assets</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Send footage, brand kit, and music links. I cut, you review—two revisions included.
            </p>
            <a href="/upload" className="mt-4 inline-block text-teal-400 hover:underline">
              Go to upload →
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
