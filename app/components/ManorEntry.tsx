"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Enter the Manor" — the home page's entry cinematic into The Foyer.
 *
 * Clicking plays a 4.5 s film over the page and then lands the visitor in the
 * interactive foyer at /foyer/viewer.html. Three things make the handover read
 * as one continuous move rather than a video followed by a website:
 *
 *  1. The white flashes. The hero loop behind this button is at an
 *     unpredictable frame when the click lands, so cutting straight to the
 *     film would jump. A lightning flash covers that cut — and the same trick
 *     covers the three frames where the figure teleports closer, which is why
 *     Blender only has to move it rather than render a glitch.
 *
 *  2. The film IS the loading screen. The foyer is a 2.3 MB glTF; the fetch
 *     starts on the same click (earlier, on hover) and runs under the film, so
 *     the download costs no visible wait. This is the whole reason the
 *     sequence earns its place rather than just delaying people.
 *
 *  3. The last frame of the film is rendered from the same camera the 3D
 *     viewer opens on, and the viewer paints that exact still behind its own
 *     loader. Film, still and first live frame are the same picture, so the
 *     page navigation in the middle of it has nothing to give away.
 *
 * Everything degrades: no video, a stalled network, reduced motion or a second
 * visit all end up in the same foyer, just without the film.
 */

const FOYER = "/foyer/viewer.html";
const MODEL = "/foyer/foyer-web.glb";
const ARRIVAL_STILL = "/foyer/arrival-frame.jpg";
/* The film's OWN first frame, and not ARRIVAL_STILL, which is its last.
   `poster` is what a <video> paints before it has decoded anything, so the
   arrival still put the foyer doors — the end of the journey — on screen for
   however long the 970 KB film took to buffer, and the film then cut back to
   the house outside and travelled to those doors a second time. On localhost
   the film is ready inside a frame and it never showed; over a real
   connection it is the first thing a visitor sees. */
const FIRST_FRAME = "/assets/manor-entry-first-frame.jpg";

/** Where the lightning fires, in milliseconds.
 *
 *  These are dictated by the SOUND, not the picture. The thunder was designed
 *  first and carries two strikes — one from 0.000 and a bigger one landing at
 *  1.500 — so the beats were moved onto them rather than the track being cut
 *  to fit an even spacing. Beat 2 sits at 0.750, inside the first strike's
 *  body, where there is no distinct hit to pin it to.
 *
 *  0.000  beat 1  the 2D figure glitches
 *  0.750  beat 2  it snaps closer
 *  1.500  beat 3  cut to the 3D phantom, head and shoulders   <- biggest crack
 *  2.500          cut to the doors
 */
const FLASH_MS = [0, 750, 1500, 2500];
/** Measured off the encoded file, not assumed: 60 + 48 frames at 24 fps plus
 *  the 0.1 s hold on the arrival still that the closing dissolve leaves. */
const FILM_MS = 4625;
/** Slightly longer than the .manor-flash animation in globals.css (0.24 s). */
const FLASH_HOLD_MS = 260;
/** Long enough that the flash has cleared, short enough to catch an impatient
 *  second visitor before they feel trapped. */
const SKIP_AFTER_MS = 900;
const SEEN_KEY = "pm-manor-entered";
const SOUND_KEY = "pm-manor-sound";

export default function ManorEntry({ className }: { className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [flash, setFlash] = useState(false);
  const [muted, setMuted] = useState(false);
  /* Gates the portal: document.body does not exist during the server render. */
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const warmed = useRef(false);
  const timers = useRef<number[]>([]);
  const leaving = useRef(false);

  const fired = useRef<Set<number>>(new Set());
  const raf = useRef<number | null>(null);

  const strike = useCallback(() => {
    setFlash(true);
    // Must outlast the .manor-flash animation, or the class is pulled partway
    // through and the strike is chopped off mid-decay instead of falling away.
    // Removing it is still necessary: re-adding is what re-triggers the
    // animation for the next flash.
    timers.current.push(window.setTimeout(() => setFlash(false), FLASH_HOLD_MS));
  }, []);

  /**
   * Fires the remaining flashes off the video's own clock rather than off
   * timers started at the click.
   *
   * The thunder's strikes land on these exact marks, so the lightning has to be
   * locked to the same timeline the audio is on.
   * Wall-clock timers drift the moment the video takes any time to start or
   * stalls mid-play — and a flash that misses its thunderclap reads as a
   * mistake in a way that a slightly late flash over silence never did.
   */
  const syncFlashesToVideo = useCallback(
    (video: HTMLVideoElement) => {
      const tick = () => {
        const t = video.currentTime * 1000;
        for (const mark of FLASH_MS) {
          if (t >= mark && !fired.current.has(mark)) {
            fired.current.add(mark);
            strike();
          }
        }
        if (!video.ended && !leaving.current) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [strike]
  );

  const clearTimers = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  useEffect(() => setMounted(true), []);

  /* Start the downloads on intent rather than on click, the same way
     EnterRoomLink warms the gallery: it buys the time between "thinking about
     it" and "clicking", which is most of the model's transfer on a good line.
     Not prefetched on page load — most home page visitors never click. */
  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    for (const [href, as] of [
      [MODEL, "fetch"],
      [ARRIVAL_STILL, "image"],
    ] as const) {
      const l = document.createElement("link");
      l.rel = "prefetch";
      l.as = as;
      l.href = href;
      if (as === "fetch") l.crossOrigin = "anonymous";
      document.head.appendChild(l);
    }
    /* `preload` has to come off "none" before `load()`, or the browser is
       within its rights to fetch nothing at all and the warm-up buys nothing
       — which is the whole point of doing this on hover. */
    const video = videoRef.current;
    if (video) {
      video.preload = "auto";
      video.load();
    }
  }, []);

  const toggleSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "off" : "on");
    } catch {}
  }, []);

  const go = useCallback((arriving: boolean) => {
    if (leaving.current) return;
    leaving.current = true;
    clearTimers();
    window.location.href = arriving ? `${FOYER}?arrive=1` : FOYER;
  }, []);

  const onEnter = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let seen = false;
      try {
        seen = sessionStorage.getItem(SEEN_KEY) === "1";
      } catch {
        // Private mode can throw on access; treat it as a first visit.
      }
      // A cinematic is a delight once and an obstacle the fourth time.
      if (reduced || seen) return go(false);
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}

      warm();
      setPlaying(true);

      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        // User-initiated, so sound is allowed here even though the hero loop
        // behind it must stay muted. The thunder opens near full scale, so a
        // visitor who silenced it before is not made to discover that twice —
        // localStorage rather than session, because the film only plays once
        // per session and the preference would otherwise never be read back.
        let wantsSilence = false;
        try {
          wantsSilence = localStorage.getItem(SOUND_KEY) === "off";
        } catch {}
        setMuted(wantsSilence);
        video.muted = wantsSilence;
        video.play().catch(() => {
          // Some configurations refuse audible playback even on a click.
          // A silent film beats no film.
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {});
        });
      }

      // The first strike fires on the click, not on the video: its whole job
      // is to hide the cut *into* the film, so it has to be up before the
      // first frame paints — however long the video takes to start.
      strike();
      fired.current = new Set([0]);
      if (video) syncFlashesToVideo(video);

      /* Backstop for the remaining flashes. The video clock is the accurate
         source and normally wins, but requestAnimationFrame does not run in a
         backgrounded or non-compositing tab, and without this the lightning
         would simply never fire there while the thunder still played. Set a
         little late so the video-clock path gets first refusal; `fired` makes
         whichever arrives first the only one that counts. */
      for (const mark of FLASH_MS) {
        if (mark === 0) continue;
        timers.current.push(
          window.setTimeout(() => {
            if (fired.current.has(mark)) return;
            fired.current.add(mark);
            strike();
          }, mark + 150)
        );
      }
      timers.current.push(window.setTimeout(() => setCanSkip(true), SKIP_AFTER_MS));
      // Backstop: if the video stalls or never fires `ended`, leave anyway.
      timers.current.push(window.setTimeout(() => go(true), FILM_MS + 900));
    },
    [go, warm, strike, syncFlashesToVideo]
  );

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, go]);

  return (
    <>
      <a
        href={FOYER}
        onClick={onEnter}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        className={className}
      >
        Enter the Manor
      </a>

      {mounted &&
        createPortal(
          <>
            {/* Portalled to <body>, which is the only place this can cover the page
                from.

                `fixed inset-0 z-[100]` was being resolved against two nested
                stacking contexts on the way up — the hero's own `z-10` copy block,
                inside the `isolate` on <section class="manor-hero"> — and that
                section paints at z-index auto. So the film's 100 and the lightning's
                110 were competing inside the hero, not against the page, and the
                fixed NavBar (z-50, a sibling of the hero at the root) sat on top of
                the cinematic for its whole 4.6 s: a translucent bar with a border
                and a backdrop-blur straight across the film. Portalling makes the
                two z-indices mean what they say.

                Still kept mounted-but-hidden so `load()` on hover has somewhere to
                buffer into. preload="none" until then: it is several MB and most
                visitors never click. */}
            <div
              /* Appears instantly rather than fading in: the first flash fires on
                 the same tick and covers it, whereas a fade would show the home page
                 dimming for a fifth of a second before the film starts — the one
                 moment the sequence cannot afford to look like a page transition. */
              className={`fixed inset-0 z-[100] bg-black ${
                playing ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={!playing}
              inert={!playing}
            >
              {/* `cover`, matching the END of the sequence rather than the start.

                  The film has two seams to serve and only one fit to serve them
                  with. Going in it cuts from the hero loop; coming out it hands to
                  the foyer's arrival still and then to the live canvas. Those two
                  are both viewport-filling — `#loader.arriving` is `center/cover`
                  and the WebGL canvas is the full viewport — so a `contain` film
                  sits letterboxed at 1440x810 and the navigation pops it to
                  1600x900 on identical imagery. That pop is completely unhidden:
                  the whole point of the handover is that the film's last frame,
                  the still and the first live frame are the same picture, and
                  there is no flash over it.

                  The entry seam can afford the mismatch instead. It no longer
                  matches on ANY fit — the hero loop is the wide establishing shot
                  and the film opens pushed in, two different cameras — and the
                  full-strength lightning covers it, which is what it is for.
                  Match the exit; flash the entrance. */}
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                preload="none"
                poster={FIRST_FRAME}
                onEnded={() => go(true)}
                onError={() => playing && go(true)}
              >
                <source src="/assets/manor-entry.webm" type="video/webm" />
                <source src="/assets/manor-entry.mp4" type="video/mp4" />
              </video>

              {playing && canSkip && (
                <div className="absolute bottom-8 right-8 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-label={muted ? "Turn sound on" : "Turn sound off"}
                    className="rounded-sm border border-white/25 bg-black/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition hover:border-brass-300 hover:text-brass-200"
                  >
                    {muted ? "Sound on" : "Sound off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => go(true)}
                    className="rounded-sm border border-white/25 bg-black/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition hover:border-brass-300 hover:text-brass-200"
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>

            {/* The lightning. Painted above the film so it can cover the film's own
                cuts, and above the page so it can cover the cut into the film. */}
            <div
              className={`pointer-events-none fixed inset-0 z-[110] bg-white ${
                flash ? "manor-flash" : "opacity-0"
              }`}
              aria-hidden="true"
            />
          </>,
          document.body
        )}
    </>
  );
}
