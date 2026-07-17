import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Sound Stage | Plumbmonkey Music Sandbox",
  description:
    "Make beats and sounds in your browser — a synthesized drum machine and a polyphonic soft synth from the Ghost Circuit sound lab. Free, no install. A taste of the desktop Drum Machine on Gumroad.",
  keywords: ["web drum machine", "browser synth", "ghost circuit", "plumbmonkey music", "make beats online"],
  openGraph: {
    title: "The Sound Stage — Plumbmonkey Music Sandbox",
    description: "A browser drum machine and soft synth from the Ghost Circuit sound lab.",
    type: "website",
  },
};

const INSTRUMENTS = [
  {
    href: "/music/drum-machine/index.html",
    title: "Drum Machine",
    tag: "8-track step sequencer",
    desc: "Program 16-step beats across eight synthesized drum voices — kick, snare, claps, hats, toms and cowbell. Tempo, swing, save & load, and export your loop to WAV or MIDI (plus one-shot samples).",
    accent: "#22d3ee",
    glyph: "▦",
  },
  {
    href: "/music/synth/index.html",
    title: "Soft Synth",
    tag: "polyphonic subtractive synth",
    desc: "Play with your mouse, touch, or computer keys across a shiftable C2–C6 range. Shape it with waveforms, a resonant filter and full ADSR, then run it through a real FX rack — vibrato, drive, chorus, delay and reverb — with five presets and a live oscilloscope. Record a take and export it to WAV or MIDI.",
    accent: "#c084fc",
    glyph: "♪",
  },
];

export default function MusicPage() {
  return (
    <main className="min-h-screen bg-[#07040f] text-slate-100">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-8 text-center">
        <p className="text-cyan-400 text-sm tracking-[0.3em] uppercase mb-3">
          Welcome to the Sound Stage
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold mb-4 tracking-wider"
          style={{
            fontFamily: "'Cinzel', Georgia, serif",
            background: "linear-gradient(90deg,#67e8f9,#c084fc)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Plumbmonkey Music Sandbox
        </h1>
        <p className="text-slate-300/80 max-w-2xl mx-auto text-lg">
          Two instruments from the Ghost Circuit sound lab, running entirely in your browser.
          <br className="hidden sm:block" />
          Make a beat, play a riff — no install, no sign-up.
        </p>
      </section>

      {/* Instruments */}
      <section className="max-w-4xl mx-auto px-6 pb-6">
        <div className="grid md:grid-cols-2 gap-6">
          {INSTRUMENTS.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="group block rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5"
              style={{
                background: "linear-gradient(150deg,#12182e 0%,#0c0a18 100%)",
                border: `1px solid ${it.accent}44`,
              }}
            >
              <div className="text-4xl mb-3" style={{ color: it.accent, textShadow: `0 0 20px ${it.accent}` }}>
                {it.glyph}
              </div>
              <h2
                className="text-2xl mb-1 font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', Georgia, serif", color: it.accent }}
              >
                {it.title}
              </h2>
              <div className="text-xs uppercase tracking-widest mb-3 text-slate-400">{it.tag}</div>
              <p className="text-slate-300/70 text-sm leading-relaxed mb-4">{it.desc}</p>
              <div className="text-xs" style={{ color: it.accent }}>
                Open instrument →
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Gumroad funnel */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: "linear-gradient(150deg,#1a1025,#0c0a18)", border: "1px solid #7c3aed55" }}
        >
          <p className="text-purple-200 text-lg mb-1" style={{ fontFamily: "'Cinzel', Georgia, serif" }}>
            Ready for the full studio?
          </p>
          <p className="text-slate-400 text-sm mb-4 max-w-xl mx-auto">
            The desktop <strong className="text-cyan-300">Drum Machine</strong> adds real sampled kits,
            your own sample import, MIDI-controller playability and deeper sound design — the pro studio version
            of what you&apos;re playing here.
          </p>
          <a
            href="https://plumbmonkey.gumroad.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2.5 rounded-lg font-semibold text-[#06121f]"
            style={{ background: "linear-gradient(90deg,#67e8f9,#c084fc)" }}
          >
            Get it on Gumroad →
          </a>
        </div>

        <div className="mt-10 text-center border-t border-purple-900/40 pt-8">
          <p className="text-slate-400 text-sm">
            Part of the <span className="text-cyan-300">Ghost Circuit</span> universe · Built by Plumbmonkey Media
          </p>
          <p className="text-slate-600 text-xs mt-2">
            Everything you make exports to WAV &amp; MIDI — drop it straight into any DAW.
          </p>
        </div>
      </section>
    </main>
  );
}
