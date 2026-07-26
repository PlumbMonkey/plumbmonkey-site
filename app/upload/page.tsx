"use client";
import { useState } from "react";

export default function UploadPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [footageLinks, setFootageLinks] = useState("");
  const [brandLinks, setBrandLinks] = useState("");
  const [musicLinks, setMusicLinks] = useState("");
  const [notes, setNotes] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSend = async () => {
    setIsSending(true);
    setError("");
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("message", `Upload Links Submission\n\nFootage links:\n${footageLinks}\n\nBrand kit links:\n${brandLinks}\n\nMusic links / notes:\n${musicLinks}\n\nNotes:\n${notes}`);

      const response = await fetch("https://formspree.io/f/mqawknwn", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSuccess(true);
        setName("");
        setEmail("");
        setFootageLinks("");
        setBrandLinks("");
        setMusicLinks("");
        setNotes("");
      } else {
        setError("Failed to send. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again or email directly to plumbmonkey@proton.me");
    } finally {
      setIsSending(false);
    }
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
            {success && (
              <div className="w-full rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 text-green-200">
                ✓ Links sent successfully!
              </div>
            )}
            {error && (
              <div className="w-full rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSend}
              disabled={isSending}
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 text-white px-5 py-2.5 font-semibold hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? "Sending..." : "Email links to plumbmonkey@proton.me"}
            </button>
            <a
              href="/onboarding.html"
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
