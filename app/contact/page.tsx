"use client";

import Link from "next/link";
import { useState } from "react";
import { SERVICES } from "@/lib/services";

const FORMSPREE = "https://formspree.io/f/mqawknwn";
const EMAIL = "plumbmonkey@proton.me";

/**
 * The short way in. /onboarding/orientation is the full brief; this is for
 * "can you do X, and roughly what would it cost" — the question that was
 * previously answered by a bare unstyled form with a teal button that looked
 * like a default template dropped onto the site.
 *
 * The subject line is drawn from lib/services.ts rather than typed here, so a
 * new service line shows up in the dropdown without anyone remembering to add
 * it in two places.
 */
export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setIsSubmitting(true);
    setStatusMessage("");
    setIsError(false);

    try {
      const response = await fetch(FORMSPREE, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
      });

      if (response.ok) {
        if (typeof window !== "undefined" && typeof (window as any).gtag !== "undefined") {
          (window as any).gtag("event", "form_submit", {
            event_category: "engagement",
            event_label: "contact_form",
          });
        }
        setStatusMessage("Message sent. I'll come back to you within a day.");
        setIsError(false);
        form.reset();
      } else {
        /* Say it failed when it failed. This branch used to report success on
           any response and even on a thrown request, which turned every dropped
           message into a visitor who believed they had reached the studio. */
        setIsError(true);
        setStatusMessage(`That didn't send. Email me directly at ${EMAIL} and it'll reach me.`);
      }
    } catch {
      setIsError(true);
      setStatusMessage(`That didn't send — the request never left. Email ${EMAIL} instead.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const field =
    "w-full border border-moonlit-700 bg-moonlit-950/80 px-4 py-3 text-moonlit-50 " +
    "placeholder:text-moonlit-500 transition focus:border-brass-500 focus:outline-none " +
    "focus:ring-1 focus:ring-brass-500/50";
  const label = "mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-brass-400";

  return (
    <main className="min-h-screen bg-moonlit-950 pt-16">
      <section className="relative overflow-hidden px-6 py-20 md:py-28">
        <div className="manor-glow pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-2xl">
          <div className="text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.36em] text-brass-300">
              Pull the bell
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight text-white md:text-5xl">
              Get in touch
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-moonlit-200">
              A question, a rough idea, or a project that already has a deadline — all
              welcome. If you would rather answer a few questions and get a considered
              reply,{" "}
              <Link href="/onboarding/orientation" className="text-brass-300 underline underline-offset-4 transition hover:text-brass-200">
                start a project brief
              </Link>{" "}
              instead.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={label}>
                  Name
                </label>
                <input id="name" name="name" type="text" required className={field} />
              </div>
              <div>
                <label htmlFor="email" className={label}>
                  Email
                </label>
                <input id="email" name="email" type="email" required className={field} />
              </div>
            </div>

            <div>
              <label htmlFor="subject" className={label}>
                What is it about?
              </label>
              <select id="subject" name="subject" defaultValue="" className={field}>
                <option value="">Pick one, or leave it blank</option>
                {SERVICES.map((service) => (
                  <option key={service.slug} value={service.name}>
                    {service.name}
                  </option>
                ))}
                <option value="Something else">Something else</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className={label}>
                Message
              </label>
              <textarea id="message" name="message" rows={7} required className={field} />
            </div>

            {statusMessage && (
              <p
                role="status"
                className={`border px-4 py-3 text-sm ${
                  isError
                    ? "border-burgundy-400/60 bg-burgundy-950/40 text-burgundy-100"
                    : "border-brass-500/50 bg-brass-900/20 text-brass-100"
                }`}
              >
                {statusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brass-300 px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-moonlit-950 transition hover:bg-brass-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-moonlit-400">
            Or email{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-brass-300 underline underline-offset-4 transition hover:text-brass-200"
            >
              {EMAIL}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
