"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    NeonCursor?: {
      init: (o?: Record<string, unknown>) => void;
      destroy: () => void;
    };
  }
}

/**
 * Mounts the neon cursor trail on a single page.
 *
 * Deliberately NOT in the root layout: the effect belongs on the Ghost Circuit
 * / creative pages, not on pricing, portfolio or contact where it would
 * undercut the business-facing tone (and burn battery on every visit).
 *
 * The effect itself lives in /public/neon-cursor.js as plain JS so the static
 * Sound Stage and The Luminarium can use the exact same file.
 */
export default function NeonCursor(props: { particleCount?: number }) {
  const { particleCount } = props;

  useEffect(() => {
    let cancelled = false;

    const start = () => {
      if (cancelled || !window.NeonCursor) return;
      window.NeonCursor.init(particleCount ? { particleCount } : {});
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-neon-cursor]'
    );

    if (window.NeonCursor) {
      start();
    } else if (existing) {
      existing.addEventListener("load", start);
    } else {
      const s = document.createElement("script");
      s.src = "/neon-cursor.js";
      s.async = true;
      s.dataset.neonCursor = "true";
      s.addEventListener("load", start);
      document.body.appendChild(s);
    }

    return () => {
      cancelled = true;
      // Tear the canvas down on navigate so it never leaks onto a page that
      // did not opt in.
      window.NeonCursor?.destroy();
    };
  }, [particleCount]);

  return null;
}
