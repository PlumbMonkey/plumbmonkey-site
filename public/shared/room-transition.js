/* ============================================================
   Plumbmonkey — room transitions.

   Leaving a room plays a short film of the manor's own hallways and stairs
   while the destination's model downloads, then navigates. The films are
   rendered from VictorianHouse_Interiors.blend (five modular sets: a straight
   corridor, an L that turns each way, a flight of stairs and the spiral), so
   the walk between two rooms is a real walk through the same house.

   WHY A FILM AND THEN A NAVIGATION, rather than the entry cinematic's trick of
   holding the room in an iframe underneath.

   ManorEntry can do that because the home page is a real page with a real nav
   bar, and /shared/site-nav.js and /shared/room-menu.js both deliberately draw
   NO chrome inside a frame — "the framed page inherits the parent's bar, which
   is the one the visitor can actually use". A bare film page has no bar to
   inherit, so a room left living in one would strand the visitor with no menu,
   no address bar, and a Back button pointing at the wrong document.

   So the film covers the DOWNLOAD instead of the whole load. That is the part
   worth covering: the models are 2-4 MB against roughly 400 ms of decode and
   scene build. By the time we navigate the .glb is in the HTTP cache, and the
   few hundred milliseconds of building that remain land behind the film's
   fade-out on the destination's own dark loader — black to black, which is the
   same reason the films end by pushing into an unlit doorway.

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
  function warm(url) {
    if (!url) return;
    try {
      fetch(url, { credentials: "omit", mode: "same-origin" }).catch(function () {});
    } catch (e) { /* no fetch: the room simply loads normally */ }
  }

  function styles() {
    if (doc.getElementById("pm-transit-css")) return;
    var s = doc.createElement("style");
    s.id = "pm-transit-css";
    s.textContent =
      "#pm-transit{position:fixed;inset:0;z-index:2147483000;background:#000;" +
      "opacity:0;transition:opacity " + FADE_MS + "ms ease}" +
      "#pm-transit.on{opacity:1}" +
      "#pm-transit video{width:100%;height:100%;object-fit:cover;display:block}" +
      "#pm-transit p{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);" +
      "margin:0;font:600 11px/1 system-ui,sans-serif;letter-spacing:.16em;" +
      "text-transform:uppercase;color:rgba(207,200,222,.5);pointer-events:none}";
    doc.head.appendChild(s);
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

  root.PM_TRANSITION = { play: play, routeFor: routeFor };
})(typeof globalThis !== "undefined" ? globalThis : this, document);
