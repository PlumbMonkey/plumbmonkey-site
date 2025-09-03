export default function TWTest() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border shadow p-6">
        <h1 className="text-2xl font-semibold">Tailwind Smoke Test</h1>
        <p className="mt-2 text-sm text-zinc-600">
          If Tailwind works, this box has rounded corners, a shadow, and spacing.
        </p>
        <button className="mt-6 inline-flex items-center justify-center rounded-lg bg-teal-600 text-white px-4 py-2 font-medium hover:bg-teal-500">
          Styled Button
        </button>
      </div>
    </main>
  );
}
