"use client";

import { useEffect, useRef } from "react";

/**
 * The home page hero loop.
 *
 * Deliberately carries no `poster`, and no `media` gate on its sources.
 *
 * A poster made the browser paint a still before autoplay began, and the only
 * still on hand is older art (the house and moon, no figure, no fog) that does
 * not match this loop — so every visit flashed the wrong image the moment the
 * video took over. Gating the sources on `prefers-reduced-motion: no-preference`
 * compounded it: those users got no playable source at all and fell through to
 * that same mismatched poster.
 *
 * So the loop always loads, and reduced-motion users get it paused on its first
 * frame instead — correct imagery, no animation, and nothing to flash. `autoPlay`
 * stays on the element so the motion path still works with JavaScript disabled.
 */
export default function HeroLoop() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (query.matches) {
        video.pause();
        video.currentTime = 0;
      } else {
        // Autoplay can still be refused (power saving, tab policy); ignore it.
        void video.play().catch(() => {});
      }
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={ref}
      className="manor-hero-image absolute inset-0 -z-30"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    >
      <source src="/assets/spectral-manor-hero-loop.webm" type="video/webm" />
      <source src="/assets/spectral-manor-hero-loop.mp4" type="video/mp4" />
    </video>
  );
}
