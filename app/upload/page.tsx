"use client";
import { useState } from "react";

export default function UploadPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [footageLinks, setFootageLinks] = useState("");
  const [brandLinks, setBrandLinks] = useState("");
  const [musicLinks, setMusicLinks] = useState("");
  const [notes, setNotes] = useState("");

  const onSend = () => {
    // Compose a mailto with the intake summary for now.
    const subject = encodeURIComponent("Plumbmonkey — Upload Links");
    const body = encodeURIComponent(
`Name: ${name}
Email: ${email}

Footage links:
${footageLinks}

Brand kit links:
${brandLinks}

Music links:
${musicLinks}

Notes:
${notes}
`);
    window.location.href = `mailto:plumbmonkey@proton.me?subject=${subject}&body=${body}`;
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          upload your assets
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Paste Drive/Dropbox/WeTransfer links. Direct file uploads can be added later.
        </p>

        <div className="mt-6 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Footage links</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              placeholder="One per line"
              rows={4}
              value={footageLinks}
              onChange={(e) => setFootageLinks(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Brand kit links</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              placeholder="Logos/fonts/palette"
              value={brandLinks}
              onChange={(e) => setBrandLinks(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Music links / notes</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={musicLinks}
              onChange={(e) => setMusicLinks(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              rows={4}
              placeholder="Anything I should know before I start?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSend}
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 text-white px-5 py-2.5 font-semibold hover:bg-teal-500"
            >
              Email links to plumbmonkey@proton.me
            </button>
            <a
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-5 py-2.5 font-medium"
            >
              Back to assessment
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
