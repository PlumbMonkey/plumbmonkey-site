"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (
        elId: string,
        opts: { events: Record<string, (event: { data: number }) => void> }
      ) => unknown;
      PlayerState: { ENDED: number };
    };
  }
}

/**
 * Foyer hero: the YouTube promo-reel embed + poster-on-end + mute toggle,
 * ported from the old index.html/assets/hero.js (vanilla DOM) into React.
 * Distinct from RoomHero (which loops local Blender renders forever) —
 * this plays once, then reveals a poster, same as before.
 */
export default function HeroVideo() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      if (!iframeRef.current || !window.YT) return;
      new window.YT.Player("hero-video", {
        events: {
          onStateChange: (event) => {
            if (window.YT && event.data === window.YT.PlayerState.ENDED) setEnded(true);
          },
        },
      });
    };

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  const toggleMute = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const nextMuted = !muted;
    iframe.src = iframe.src.replace(nextMuted ? "mute=0" : "mute=1", nextMuted ? "mute=1" : "mute=0");
    setMuted(nextMuted);
  };

  return (
    <section className="relative h-screen w-full overflow-hidden" id="hero">
      <iframe
        ref={iframeRef}
        id="hero-video"
        className={`absolute left-1/2 top-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-500 ${
          ended ? "opacity-0" : "opacity-100"
        }`}
        style={{ width: "100vw", height: "56.25vw", minWidth: "177.77vh" }}
        src="https://www.youtube.com/embed/yOZtEoB2-UE?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1"
        title="Plumbmonkey Hero Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <img
        src="/assets/haunted-house-with-logo.jpg"
        alt="The Haunted House — Plumbmonkey"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          ended ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className="absolute inset-x-0 z-10 flex flex-col items-center px-4 pb-8 text-center"
        style={{ bottom: "25%", height: "20%", justifyContent: "flex-end" }}
      >
        <h1 className="mb-2 font-display text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
          Video Editing &amp; Animated Music Videos
          <br />
          That Hit Like Thunder
        </h1>
        <p className="mx-auto mb-4 max-w-2xl text-base text-moonlit-100 drop-shadow md:text-lg">
          From high-impact edits to fully-animated visuals and custom soundtracks.
          <br />
          For artists, storytellers, creators — break through the noise.
        </p>
        <a
          href="/screening-room"
          className="inline-block rounded-2xl bg-brass-400 px-8 py-4 font-semibold text-moonlit-950 shadow transition hover:bg-brass-300"
        >
          Video Portfolio
        </a>
      </div>

      {!ended && (
        <button
          onClick={toggleMute}
          aria-label="Toggle audio"
          className="absolute bottom-8 left-6 z-20 rounded-full border border-white/20 bg-black/70 p-4 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-black/90 focus:outline-none"
        >
          {muted ? (
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3z" />
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" opacity="0.4" />
                <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" opacity="0.4" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-0.5 w-8 rotate-45 bg-red-500 shadow-sm" />
              </div>
            </div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      )}
    </section>
  );
}
