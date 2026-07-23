"use client";

import { useEffect, useState } from "react";

export default function MusicContinue() {
  const [destination, setDestination] = useState<{ href: string; label: string; detail: string } | null>(null);

  useEffect(() => {
    try {
      const song = JSON.parse(localStorage.getItem("ghostCircuit.song.v1") || "null");
      if (song?.blocks?.length) {
        setDestination({ href: "/music/song/index.html", label: "Continue your song", detail: `${song.blocks.length} arrangement block${song.blocks.length === 1 ? "" : "s"} saved` });
        return;
      }
      if (localStorage.getItem("ghostCircuit.drumMachine.pattern")) {
        setDestination({ href: "/music/drum-machine/index.html", label: "Continue your beat", detail: "A drum pattern is saved on this device" });
        return;
      }
      if (localStorage.getItem("ghostCircuit.synth.userPatch")) {
        setDestination({ href: "/music/synth/index.html", label: "Continue your synth patch", detail: "A custom sound is saved on this device" });
      }
    } catch {}
  }, []);

  if (!destination) return null;

  return (
    <a
      href={destination.href}
      className="mx-auto mt-6 flex max-w-xl items-center justify-between gap-4 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-left transition hover:border-cyan-200/60 hover:bg-cyan-300/15"
    >
      <span>
        <strong className="block text-sm text-cyan-100">{destination.label}</strong>
        <span className="mt-1 block text-xs text-slate-400">{destination.detail}</span>
      </span>
      <span className="text-cyan-300">Continue →</span>
    </a>
  );
}
