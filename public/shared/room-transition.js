/* ============================================================
   Plumbmonkey — room transitions.

   Leaving a room walks you there, through the manor's own hallways and stairs.
   The films come from VictorianHouse_Interiors.blend (five modular sets: a
   straight corridor, an L that turns each way, a flight of stairs and the
   spiral), so the trip between two rooms is a real trip through the house.

   There are two ways it can play, and which one a room gets depends on how
   long that room takes to appear.

   1. HEAVY 3D ROOMS — anything with a `model` in rooms.js — dip to black, and
      the film travels WITH the visitor as ?walk=<film>, played over the
      destination's own loader by /shared/walk-in.js. The room downloads and
      builds behind it, and the film lifts only when both are done.

      This is not where it started. The film used to play here and then
      navigate, covering the download only, on the assumption that the build
      behind it was a few hundred milliseconds. Measured, the Arcade takes
      ~990 ms from navigation to first frame with its .glb already served from
      cache — module parse, Draco decode, scene build, shader compile — none of
      which a prefetch can do early. So the film ended and a loading bar
      appeared, which is precisely the seam the film existed to hide.

   2. ORDINARY PAGES — the Workshop, the Theatre's page — have nothing to load
      and appear immediately, so there is nothing at the far end for a film to
      cover. Those play it here and navigate when it finishes, with the
      destination warmed in the background while it runs.

   Everything degrades to a plain navigation: reduced motion, no video codec, a
   missing film, a stalled fetch, an impatient click, or a room with no film
   mapped all end up in the same place by the same href.
   ============================================================ */
(function (root, doc) {
  "use strict";

  var BASE = "/assets/transit-";
  var FADE_MS = 260;          // matches the CSS transition below
  var MAX_MS = 6000;          // never hold a visitor on a film that will not end

  /* Which walk leads to which room lives in /shared/rooms.js with the rest of
     the room data, not in a second table here. That file is the single source
     of truth precisely because copies of the room list drift — it is how the
     same room ended up labelled "Sound Stage" in one nav and "Music Sandbox"
     in another. Load it first:
       <script src="/shared/rooms.js" defer></script>
       <script src="/shared/room-transition.js" defer></script> */
  function routeFor(href) {
    var filmFor = root.PM_FILM_FOR;
    if (!filmFor) {
      console.error("room-transition.js: /shared/rooms.js must load first");
      return null;
    }
    return filmFor(href);
  }

  /* One reason at a time, so a bug here is a plain navigation and never a
     visitor stuck on a black screen. */
  function shouldSkip() {
    try {
      if (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return true;
      }
    } catch (e) { /* matchMedia is ancient; if it throws, carry on */ }
    var v = doc.createElement("video");
    return !(v.canPlayType && (v.canPlayType("video/mp4") || v.canPlayType("video/webm")));
  }

  /* Warm the HTTP cache for the destination's model. A bare fetch() is used
     rather than <link rel=prefetch> because prefetch is a hint browsers are
     free to drop, and this one has a deadline: it is worth nothing if it has
     not landed by the time the film ends. `credentials: omit` keeps it the
     same request the viewer will make, so it hits the same cache entry. */
  var warmed = {};
  function warm(url) {
    if (!url || warmed[url]) return;
    warmed[url] = true;
    try {
      fetch(url, { credentials: "omit", mode: "same-origin" }).catch(function () {});
    } catch (e) { /* no fetch: the room simply loads normally */ }
  }

  /* Start a room's download the moment the pointer rests on its door, the way
     the entry cinematic already warms the foyer on hover. A hovered arch is a
     strong signal, the fetch is idempotent, and by click time the film usually
     has only the scene build left to cover rather than several megabytes. */
  function prefetch(href) {
    var route = routeFor(href);
    if (route) warm(route.model);
  }

  function styles() {
    if (doc.getElementById("pm-transit-css")) return;
    var s = doc.createElement("style");
    s.id = "pm-transit-css";
    s.textContent =
      "#pm-transit{position:fixed;inset:0;z-index:2147483000;background:#000;" +
      "opacity:0;transition:opacity " + FADE_MS + "ms ease}" +
      "#pm-transit.on{opacity:1}" +
      "#pm-transit.dip{transition:opacity 170ms ease}" +
      "#pm-transit video{width:100%;height:100%;object-fit:cover;display:block}" +
      "#pm-transit p{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);" +
      "margin:0;font:600 11px/1 system-ui,sans-serif;letter-spacing:.16em;" +
      "text-transform:uppercase;color:rgba(207,200,222,.5);pointer-events:none}";
    doc.head.appendChild(s);
  }

  /** Send the film with the visitor, for a room heavy enough to need it. */
  function handOff(href, film, leave) {
    var url = href + (href.indexOf("?") < 0 ? "?" : "&") + "walk=" +
              encodeURIComponent(film);
    /* A short dip to black first: the destination opens black and its film
       fades up from black, so without this the lit room we are leaving cuts
       straight to it. */
    styles();
    var wrap = doc.createElement("div");
    wrap.id = "pm-transit";
    wrap.className = "dip";
    doc.body.appendChild(wrap);
    void wrap.offsetWidth;
    wrap.classList.add("on");
    root.setTimeout(function () { leave(url); }, 170);
  }

  /**
   * Walk to `href`, then hand over to `leave(href)`.
   *
   * `leave` is the caller's own navigation — the foyer passes one that sets
   * window.top.location, because the foyer is itself embedded in the home page
   * after the entry cinematic and must break out rather than nest.
   */
  function play(href, leave) {
    leave = leave || function (h) { root.location.href = h; };
    var route = routeFor(href);
    if (!route || shouldSkip()) { leave(href); return; }

    /* Any room with a model is a heavy 3D load, and every one of them can wear
       the film itself — whether it IS the viewer (/artroom/viewer.html) or
       merely frames one (/arcade). walk-in.js handles both, and is loaded on the
       viewers directly and on every Next page through app/layout.tsx. */
    if (route.model) { handOff(href, route.film, leave); return; }

    warm(route.model);
    styles();

    var done = false;
    var timer = 0;
    function finish() {
      if (done) return;
      done = true;
      root.clearTimeout(timer);
      leave(href);
    }

    var wrap = doc.createElement("div");
    wrap.id = "pm-transit";
    wrap.setAttribute("role", "presentation");

    var vid = doc.createElement("video");
    vid.autoplay = true;
    vid.muted = true;            // a repeated transition should not shout
    vid.playsInline = true;
    vid.setAttribute("playsinline", "");
    vid.preload = "auto";
    ["webm", "mp4"].forEach(function (ext) {
      var s = doc.createElement("source");
      s.src = BASE + route.film + "." + ext;
      s.type = ext === "webm" ? "video/webm" : "video/mp4";
      vid.appendChild(s);
    });
    vid.addEventListener("ended", finish);
    vid.addEventListener("error", finish);

    var skip = doc.createElement("p");
    skip.textContent = "Click to skip";

    wrap.appendChild(vid);
    wrap.appendChild(skip);
    wrap.addEventListener("click", finish);
    doc.body.appendChild(wrap);

    /* A film that never fires `ended` — a codec stall, a tab backgrounded
       mid-play, a truncated file — must not become a dead end. */
    timer = root.setTimeout(finish, MAX_MS);

    var onKey = function (e) { if (e.key === "Escape") finish(); };
    doc.addEventListener("keydown", onKey);

    /* Force layout, then fade in. This deliberately does NOT wait for a
       requestAnimationFrame: rAF does not fire in a hidden document, so a
       visitor who clicks an arch and immediately switches tabs would come back
       to a film playing underneath an overlay still stuck at opacity 0.
       Reading offsetWidth gives the transition a start value synchronously,
       which is all the rAF was ever there for. */
    void wrap.offsetWidth;
    wrap.classList.add("on");

    /* A rejected play() means the film cannot start at all — no codec, an
       autoplay policy we did not satisfy, a decode error. Going straight to the
       room is a better answer than holding a black rectangle. */
    var p = vid.play();
    if (p && p.catch) p.catch(finish);
  }

  /* ---------------------------------------------------------------- links
     Every way into a room should walk you there, not just the Foyer's arches:
     the nav bar, the footer's room column, the home page's door grid, the
     hamburger inside a 3D room, and any link added later. Rather than teach
     each of those about transitions — five files that have drifted apart
     before — one delegated listener on the document covers all of them and
     anything written next.

     Capture phase, because next/link attaches its own click handler and would
     otherwise start a client-side route change first. A full navigation is
     required regardless: walk-in.js runs on document load, and a soft route
     change never gives it one.

     A hovered room door starts downloading too, for the same reason the Foyer
     does it — by click time the film usually has only the build left to hide. */
  function isPlainLeftClick(e) {
    return !e.defaultPrevented && e.button === 0 &&
           !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }

  function roomLinkFrom(node) {
    var a = node && node.closest ? node.closest("a[href]") : null;
    if (!a) return null;
    if (a.target && a.target !== "_self") return null;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-walk")) return null;
    var url;
    try { url = new URL(a.getAttribute("href"), root.location.href); }
    catch (err) { return null; }
    if (url.origin !== root.location.origin) return null;
    // Already standing in it: let the link behave normally rather than
    // walking someone down a corridor back to where they are.
    if (url.pathname === root.location.pathname) return null;
    return routeFor(url.pathname) ? url.pathname + url.search : null;
  }

  function attach() {
    doc.addEventListener("click", function (e) {
      if (!isPlainLeftClick(e)) return;
      var href = roomLinkFrom(e.target);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      play(href, function (h) { root.top.location.href = h; });
    }, true);

    var warmOn = function (e) {
      var href = roomLinkFrom(e.target);
      if (href) prefetch(href);
    };
    doc.addEventListener("pointerover", warmOn, true);
    doc.addEventListener("focusin", warmOn, true);
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }

  root.PM_TRANSITION = { play: play, routeFor: routeFor, prefetch: prefetch,
                         roomLinkFrom: roomLinkFrom };
})(typeof globalThis !== "undefined" ? globalThis : this, document);
