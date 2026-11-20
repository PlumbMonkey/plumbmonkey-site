"use client";

import { useEffect, useRef, useState } from "react";

interface RoomHeroProps {
  /** Matches the folder under public/rooms/<roomSlug>/ (hero.mp4 + hero-poster.jpg). */
  roomSlug: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * Shared hero section for each "room" page. Plays a short looping Blender
 * render as an ambient background (public/rooms/<roomSlug>/hero.mp4), with
 * the first-frame poster shown immediately and swapped in once the video can
 * play. Respects prefers-reduced-motion by never requesting the video at all.
 */
export default function RoomHero({ roomSlug, title, subtitle, children }: RoomHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="door-transition relative h-[70vh] min-h-[420px] w-full overflow-hidden bg-gradient-to-b from-moonlit-900 via-moonlit-950 to-black">
      {/* Themed fallback so the room still reads as "finished" before its
          Blender render lands in public/rooms/<roomSlug>/ — an <img> whose
          source 404s just renders nothing on top of this gradient. */}
      <img
        src={`/rooms/${roomSlug}/hero-poster.jpg`}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          videoReady && !reducedMotion ? "opacity-0" : "opacity-100"
        }`}
      />
      {!reducedMotion && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoReady(true)}
        >
          <source src={`/rooms/${roomSlug}/hero.mp4`} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-moonlit-950/55" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-4xl font-bold text-moonlit-50 drop-shadow-lg md:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-lg text-moonlit-100 drop-shadow md:text-xl">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
