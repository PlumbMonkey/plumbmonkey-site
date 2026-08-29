"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Enter the Manor" — the home page's entry cinematic into The Foyer.
 *
 * Clicking plays a 4.6 s film over the page and lands the visitor in the
 * interactive foyer. The foyer is NOT navigated to: it is mounted in a
 * full-viewport iframe underneath the film and builds itself while the film
 * plays, so when the film is taken away the room is already live and there is
 * no loading screen at any point.
 *
 *  1. The white flashes. The hero loop behind this button is at an
 *     unpredictable frame when the click lands, so cutting straight to the
 *     film would jump. A lightning flash covers that cut — and the same trick
 *     covers the three frames where the figure teleports closer, which is why
 *     Blender only has to move it rather than render a glitch.
 *
 *  2. The film IS the loading screen — now literally. The room costs about
 *     400 ms of Draco decode and scene build on top of a 2.3 MB fetch that
 *     starts on hover, against 4.6 s of film. It finishes with room to spare
 *     and waits for the film rather than the other way round.
 *
 *  3. The film's last frame is rendered from the camera the viewer opens on,
 *     so the cut from film to live room is a cut between two copies of the
 *     same picture.
 *
 * Why an iframe and not a navigation. Playing the film here keeps the click's
 * user activation, which is what lets it play WITH SOUND — a fresh document
 * after a navigation has no activation, and Chrome refuses unmuted autoplay
 * without it unless the visitor already has engagement on the domain. A
 * first-time visitor is exactly who this is for, and the lightning is cut to
 * the thunder, so a silent film is not an acceptable degradation.
 *
 * Why the iframe is covered rather than hidden: WebGL does not draw and
 * requestAnimationFrame does not fire in a hidden document, so a display:none
 * or offscreen frame would sit there doing nothing and hand over a cold room.
 * Being merely occluded by the film costs nothing — visibility is per-document,
 * not per-pixel.
 *
 * Everything degrades: no video, a stalled room, reduced motion or a second
 * visit all end up in the same foyer, just by ordinary navigation.
 */

const FOYER = "/foyer/viewer.html";
const MODEL = "/foyer/foyer-web.glb";
/** The film's OWN first frame, not the arrival still, which is its last.
 *  `poster` is what a <video> paints before it has decoded anything, so the
 *  arrival still used to put the end of the journey on screen for however long
 *  the film took to buffer. */
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
/** How long to hold on the film's last frame waiting for a room that has not
 *  reported in. It should never be reached — the room is ready in well under a
 *  second — so this exists only so a broken iframe cannot strand anyone. Past
 *  it we give up on the seamless path and navigate properly. */
const ROOM_WAIT_MS = 8000;
const SEEN_KEY = "pm-manor-entered";
const SOUND_KEY = "pm-manor-sound";

export default function ManorEntry({ className }: { className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [filmDone, setFilmDone] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [flash, setFlash] = useState(false);
  const [muted, setMuted] = useState(false);
  /* Gates the portal: document.body does not exist during the server render. */
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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

  /* Start the download on intent rather than on click, the same way
     EnterRoomLink warms the gallery: it buys the time between "thinking about
     it" and "clicking", which is most of the model's transfer on a good line.
     Not prefetched on page load — most home page visitors never click. */
  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.as = "fetch";
    l.href = MODEL;
    l.crossOrigin = "anonymous";
    document.head.appendChild(l);
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

  /** The ordinary way out: a real navigation. Used for every path that is not
   *  the cinematic — reduced motion, a repeat visit, or a room that failed. */
  const go = useCallback((arriving: boolean) => {
    if (leaving.current) return;
    leaving.current = true;
    clearTimers();
    window.location.href = arriving ? `${FOYER}?arrive=1` : FOYER;
  }, []);

  /* The handover. Both halves have to be true: the film has finished (or been
     skipped) AND the room has drawn a frame. Whichever is late, the other
     waits — the film holds on its own last frame, which is the arrival view,
     so waiting is invisible. */
  useEffect(() => {
    if (!playing || revealed || !filmDone || !roomReady) return;
    setRevealed(true);
    clearTimers();

    /* The address bar has been showing "/" throughout. Push rather than
       replace so Back returns to the home page instead of leaving the site. */
    try {
      window.history.pushState({ pmFoyer: true }, "", FOYER);
    } catch {}

    /* Nothing behind the room is visible any more; stop it costing frames. */
    document.querySelectorAll<HTMLVideoElement>("video.manor-hero-image").forEach((v) => v.pause());

    // Keyboard control (drag to look, portals) belongs to the room now.
    iframeRef.current?.focus();
  }, [playing, revealed, filmDone, roomReady]);

  /* Back out of the foyer. The room was never a document of its own, so the
     browser cannot restore the home page for us — we take the iframe down and
     put the hero back the way it was. */
  useEffect(() => {
    if (!revealed) return;
    const onPop = () => {
      setRevealed(false);
      setPlaying(false);
      setFilmDone(false);
      setRoomReady(false);
      setCanSkip(false);
      leaving.current = false;
      document
        .querySelectorAll<HTMLVideoElement>("video.manor-hero-image")
        .forEach((v) => void v.play().catch(() => {}));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [revealed]);

  /* The room reporting in. Same-origin by construction, but check anyway:
     postMessage is reachable by anyone who can get a frame onto this page. */
  useEffect(() => {
    if (!playing) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "foyer-ready") setRoomReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playing]);

  /* If the film is over and the room still has not reported, something is
     wrong with the frame rather than merely slow. Fall back to the ordinary
     navigation so nobody is left staring at a held frame. */
  useEffect(() => {
    if (!filmDone || roomReady || revealed) return;
    const t = window.setTimeout(() => go(true), ROOM_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [filmDone, roomReady, revealed, go]);

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
        // behind it must stay muted. This is the whole reason the film plays
        // on this page instead of on the foyer's: the activation dies with the
        // document, and with it the thunder. The film opens near full scale,
        // so a visitor who silenced it before is not made to discover that
        // twice — localStorage rather than session, because the film only
        // plays once per session and the preference would never be read back.
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
      /* Backstop for `ended`, which a stalled video may never fire. This only
         declares the FILM over — the reveal still waits on the room, and the
         room has its own backstop above. */
      timers.current.push(window.setTimeout(() => setFilmDone(true), FILM_MS + 900));
    },
    [go, warm, strike, syncFlashesToVideo]
  );

  useEffect(() => {
    if (!playing || revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilmDone(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, revealed]);

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
            {/* The room. Mounted on the click and left to build under the film.
                Covered, never hidden — see the note at the top of this file. */}
            {playing && (
              <iframe
                ref={iframeRef}
                src={`${FOYER}?embed=1`}
                title="The Foyer"
                className="fixed inset-0 z-[90] h-full w-full border-0"
                /* The foyer offers VR and fullscreen; both are gated on the
                   frame being allowed to ask for them. */
                allow="xr-spatial-tracking; fullscreen; gyroscope; accelerometer"
                onError={() => go(true)}
              />
            )}

            {/* The film. Portalled to <body>, which is the only place it can
                cover the page from.

                `fixed inset-0 z-[100]` was being resolved against two nested
                stacking contexts on the way up — the hero's own `z-10` copy
                block, inside the `isolate` on <section class="manor-hero"> —
                and that section paints at z-index auto. So the film's 100 and
                the lightning's 110 were competing inside the hero, not against
                the page, and the fixed NavBar (z-50, a sibling of the hero at
                the root) sat on top of the cinematic for its whole run.
                Portalling makes the two z-indices mean what they say.

                Kept mounted-but-hidden before the click so `load()` on hover
                has somewhere to buffer into. preload="none" until then: it is
                about a megabyte and most visitors never click. */}
            {!revealed && (
              <div
                /* Appears instantly rather than fading in: the first flash
                   fires on the same tick and covers it, whereas a fade would
                   show the home page dimming for a fifth of a second before
                   the film starts — the one moment the sequence cannot afford
                   to look like a page transition. */
                className={`fixed inset-0 z-[100] bg-black ${
                  playing ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                aria-hidden={!playing}
                inert={!playing}
              >
                {/* `cover`, matching the live canvas underneath it. The room
                    fills the viewport, so a `contain` film would sit
                    letterboxed and the handover would pop the same picture
                    from 1440x810 to 1600x900 — on a cut that is meant to be
                    invisible and has no flash over it. The entry cut can
                    afford a mismatch instead: the hero loop is the wide
                    establishing shot and the film opens pushed in, so nothing
                    matches on any fit, and the lightning covers it.
                    Match the exit; flash the entrance. */}
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  preload="none"
                  poster={FIRST_FRAME}
                  onEnded={() => setFilmDone(true)}
                  /* A film that cannot play should not also cost the room.
                     Declare it over and let the reveal wait on the room. */
                  onError={() => playing && setFilmDone(true)}
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
                      onClick={() => setFilmDone(true)}
                      className="rounded-sm border border-white/25 bg-black/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition hover:border-brass-300 hover:text-brass-200"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* The lightning. Painted above the film so it can cover the film's
                own cuts, and above the page so it can cover the cut into the
                film. */}
            {!revealed && (
              <div
                className={`pointer-events-none fixed inset-0 z-[110] bg-white ${
                  flash ? "manor-flash" : "opacity-0"
                }`}
                aria-hidden="true"
              />
            )}
          </>,
          document.body
        )}
    </>
  );
}
