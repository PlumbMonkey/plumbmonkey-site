import type { Metadata } from "next";
import Image from "next/image";
import NeonCursor from "../components/NeonCursor";
import MusicContinue from "./MusicContinue";

export const metadata: Metadata = {
  title: "Spectral Manor Instruments | SY-1 & DM-1",
  description:
    "Play the SY-1 synthesizer and DM-1 rhythm machine in your browser, then arrange a complete song inside Spectral Manor.",
  keywords: ["Stave", "SY-1 synthesizer", "DM-1 drum machine", "browser synth", "browser drum machine", "music visualizer"],
  openGraph: {
    title: "Stave Instruments — The Spectral Manor",
    description: "Summon a beat. Shape your sound. Build a complete song.",
    type: "website",
  },
};

const tools = [
  {
    number: "01",
    href: "/music/dm1",
    title: "Summon the beat",
    product: "DM-1 Rhythm Machine",
    copy: "Program eight spectral drum voices on a tactile 16-step grid. Save patterns and export WAV or MIDI.",
    action: "Open the DM-1",
    accent: "cyan",
    preview: (
      <div className="grid grid-cols-8 gap-1" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className={`aspect-square rounded-sm ${[0, 3, 7, 10, 14, 16, 19, 23].includes(i) ? "bg-cyan-300 shadow-[0_0_12px_#67e8f9]" : "bg-cyan-950/70"}`} />
        ))}
      </div>
    ),
  },
  {
    number: "02",
    href: "/music/sy1",
    title: "Shape your sound",
    product: "SY-1 Synthesizer",
    copy: "Wake a polyphonic voice with filters, envelopes, performance controls and spectral effects, then record a playable riff.",
    action: "Open the SY-1",
    accent: "amber",
    preview: (
      <div className="flex h-14 items-end gap-1" aria-hidden="true">
        {[70, 42, 84, 56, 95, 36, 74, 48, 88, 62, 40, 78].map((height, i) => (
          <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-amber-600 to-amber-200" style={{ height: `${height}%` }} />
        ))}
      </div>
    ),
  },
  {
    number: "03",
    href: "/music/song/index.html",
    title: "Arrange the track",
    product: "Song View",
    copy: "Place saved beats and synth takes onto lanes, repeat sections, edit clips and export a complete arrangement.",
    action: "Build your song",
    accent: "violet",
    preview: (
      <div className="space-y-2" aria-hidden="true">
        <div className="grid grid-cols-6 gap-1"><span className="col-span-2 h-5 rounded bg-violet-400" /><span className="col-span-3 h-5 rounded bg-violet-500/60" /><span className="h-5 rounded bg-violet-300/35" /></div>
        <div className="grid grid-cols-6 gap-1"><span className="h-5 rounded bg-cyan-400/70" /><span className="col-span-2 h-5 rounded bg-cyan-300/40" /><span className="col-span-3 h-5 rounded bg-cyan-500/70" /></div>
      </div>
    ),
  },
];

const accentStyles: Record<string, { border: string; text: string; glow: string }> = {
  cyan: { border: "border-cyan-400/30", text: "text-cyan-300", glow: "group-hover:shadow-[0_20px_70px_-35px_#22d3ee]" },
  amber: { border: "border-amber-400/30", text: "text-amber-300", glow: "group-hover:shadow-[0_20px_70px_-35px_#f59e0b]" },
  violet: { border: "border-violet-400/30", text: "text-violet-300", glow: "group-hover:shadow-[0_20px_70px_-35px_#a78bfa]" },
};

export default function MusicPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07080c] text-slate-100">
      {/* Neon trail — the Sound Stage hub. The instrument pages opt out: the
          synth and drum machine need precise knob/step dragging. */}
      <NeonCursor />

      <section className="relative border-b border-white/10 px-5 pb-16 pt-16 text-center sm:px-6 md:pb-24 md:pt-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15 shadow-[0_0_120px_#22d3ee22]" />
          <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/20" />
          <div className="absolute inset-0 bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.34em] text-lime-200">Stave · Spectral Manor Instruments</p>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-7xl">
            Summon a beat. Shape your sound.
            <span className="block bg-gradient-to-r from-lime-200 via-amber-200 to-violet-300 bg-clip-text text-transparent">Build a complete song.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Two playable instruments from Stave, waiting in the manor. No install or account required.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/music/dm1" className="rounded-xl bg-lime-200 px-6 py-3.5 font-bold text-slate-950 transition hover:bg-lime-100">Open DM-1</a>
            <a href="/music/sy1" className="rounded-xl border border-amber-200/40 bg-amber-200/10 px-6 py-3.5 font-semibold text-amber-100 transition hover:bg-amber-200/20">Open SY-1</a>
          </div>
          <MusicContinue />
          <div className="relative mx-auto mt-12 overflow-hidden rounded-2xl border border-lime-200/20 bg-black/40 shadow-[0_35px_120px_-45px_#9fcf9a]">
            <Image
              src="/assets/stave-instruments.png"
              alt="The SY-1 synthesizer and DM-1 rhythm machine inside the Spectral Manor"
              width={1680}
              height={945}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section id="studio" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">One connected workflow</p>
          <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">From first rhythm to finished track</h2>
          <p className="mt-3 text-slate-400">Start anywhere. Saved beats and synth takes move into Song View on the same device.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {tools.map((tool) => {
            const accent = accentStyles[tool.accent];
            return (
              <a key={tool.href} href={tool.href} className={`group flex min-h-[360px] flex-col rounded-2xl border bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 transition duration-300 hover:-translate-y-1 ${accent.border} ${accent.glow}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-xs ${accent.text}`}>{tool.number}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{tool.product}</span>
                </div>
                <div className="my-8 rounded-xl border border-white/10 bg-black/35 p-5">{tool.preview}</div>
                <h3 className="font-serif text-2xl font-bold">{tool.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{tool.copy}</p>
                <span className={`mt-6 text-sm font-semibold ${accent.text}`}>{tool.action} →</span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="border-y border-lime-300/15 bg-gradient-to-r from-lime-300/[0.04] via-cyan-300/[0.04] to-violet-300/[0.04]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-6 md:grid-cols-[1fr_1.15fr] md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">A separate visual studio</p>
            <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">Turn the finished track into a visual</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-slate-400">
              Light Lab has its own full creative workspace. Export WAV from Sound Stage and it becomes available there automatically on this device—or upload any audio file.
            </p>
            <a href="/visual/index.html?handoff=1" className="mt-7 inline-flex rounded-xl bg-lime-300 px-6 py-3.5 font-bold text-slate-950 transition hover:bg-lime-200">Open Light Lab →</a>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-lime-300/25 bg-[#050609] shadow-[0_30px_100px_-45px_#d9ff63]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#a67cff44,transparent_24%),conic-gradient(from_0deg,#5ce6db22,#d9ff6333,#a67cff33,#5ce6db22)]" />
            {[30, 45, 60, 75].map((size) => <div key={size} className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime-200/20" style={{ width: `${size}%` }} />)}
            <div className="absolute bottom-4 left-4 rounded-md border border-white/10 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-lime-200">Light Lab · audio ready</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
        <h2 className="text-center font-serif text-3xl font-bold">Choose your path</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Quick beat", "Drum Machine → WAV or MIDI", "/music/dm1"],
            ["Complete track", "Drums + Synth → Song View", "/music/song/index.html"],
            ["Music visual", "Finished audio → Light Lab → Video", "/visual/index.html"],
          ].map(([title, copy, href]) => (
            <a key={title} href={href} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.06]">
              <strong className="block text-white">{title}</strong><span className="mt-2 block text-sm text-slate-400">{copy}</span>
            </a>
          ))}
        </div>
        <div className="mt-14 text-center">
          <p className="text-sm text-slate-500">Want sampled kits, MIDI-controller support and deeper sound design?</p>
          <a href="https://plumbmonkey.gumroad.com/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-semibold text-violet-300 hover:text-violet-200">Visit the Plumbmonkey Store →</a>
        </div>
      </section>
    </main>
  );
}
