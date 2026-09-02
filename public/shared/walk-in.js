/* ============================================================
   Plumbmonkey — the arriving half of a room transition.

   /shared/room-transition.js sends you to a room with ?walk=<film>. This runs
   IN THE ROOM and wears that film over the room's own loader while the scene
   builds, so the walk and the load are the same three seconds instead of one
   after the other.

   WHY THE FILM MOVED HERE

   It used to play back in the Foyer, covering only the destination's download,
   on the assumption that the build behind it was a few hundred milliseconds and
   would pass unnoticed. Measured, it is not: the Arcade takes ~990 ms from
   navigation to first frame with its .glb already a 304 from cache — module
   parse, Draco decode, scene build and shader compile, none of which a prefetch
   can do early. So the film ended and then a loading bar appeared, which is
   exactly the seam the film existed to hide.

   Playing it here instead means the room is downloading and building behind the
   film from the first paint, and the film is lifted only once BOTH are done. If
   the room wins, the film plays out. If the film wins, it holds on its own last
   frame, which is black by construction — see hall_flythrough.py.

   Load it SYNCHRONOUSLY in <head>, before the loader markup, so the loader's
   own text and progress bar never get a frame to themselves.
   ============================================================ */
(function (root, doc) {
  "use strict";

  var params;
  try { params = new URLSearchParams(root.location.search); } catch (e) { return; }
  var film = params.get("walk");

  /* The value lands in a URL, so it is whitelisted by shape rather than
     trusted. Anything else and the room simply loads the ordinary way. */
  if (!film || !/^[a-z0-9-]{1,40}$/.test(film)) return;

  /* Embedded rooms already hand their loading to the parent (see the ?embed
     contract in each viewer); a film here would fight it. */
  if (params.has("embed")) return;

  var MAX_MS = 12000;      // never strand anyone behind a film that will not end
  var FADE_MS = 420;

  /* Synchronous, so it applies before the loader has ever been painted. The
     loader is kept in the DOM and merely hidden -- its `done` class is how we
     learn the room is live. */
  var css = doc.createElement("style");
  css.textContent =
    "#loader > * { visibility: hidden !important; }" +
    "#loader { background: #000 !important; }" +
    "#pm-walk { position: fixed; inset: 0; z-index: 2147483000; background: #000;" +
    "  opacity: 1; transition: opacity " + FADE_MS + "ms ease; }" +
    "#pm-walk.off { opacity: 0; pointer-events: none; }" +
    "#pm-walk video { width: 100%; height: 100%; object-fit: cover; display: block; }" +
    "@media (prefers-reduced-motion: reduce) { #pm-walk { transition: none; } }";
  doc.head.appendChild(css);

  var wrap, vid, timer, filmDone = false, roomDone = false, lifted = false;

  function lift() {
    if (lifted) return;
    lifted = true;
    root.clearTimeout(timer);
    if (wrap) {
      wrap.classList.add("off");
      root.setTimeout(function () {
        if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, FADE_MS + 60);
    }
    // hand the room's own loader back, in case it has not finished yet
    if (css.parentNode) css.parentNode.removeChild(css);
  }

  function maybeLift() { if (filmDone && roomDone) lift(); }

  /* Bail out completely: the room shows its ordinary loader, which is a far
     better outcome than a black rectangle that never goes away. */
  function abort() {
    filmDone = roomDone = true;
    lift();
  }

  function start() {
    wrap = doc.createElement("div");
    wrap.id = "pm-walk";
    wrap.setAttribute("role", "presentation");

    vid = doc.createElement("video");
    vid.muted = true;               // muted autoplay needs no user activation,
    vid.autoplay = true;            // which a freshly navigated document has none of
    vid.playsInline = true;
    vid.setAttribute("playsinline", "");
    vid.preload = "auto";
    ["webm", "mp4"].forEach(function (ext) {
      var s = doc.createElement("source");
      s.src = "/assets/transit-" + film + "." + ext;
      s.type = ext === "webm" ? "video/webm" : "video/mp4";
      vid.appendChild(s);
    });
    vid.addEventListener("ended", function () { filmDone = true; maybeLift(); });
    vid.addEventListener("error", abort);
    wrap.appendChild(vid);
    doc.body.appendChild(wrap);

    timer = root.setTimeout(abort, MAX_MS);

    var p = vid.play();
    if (p && p.catch) p.catch(abort);

    watchLoader();
  }

  /* "The room is ready" arrives one of two ways, because a room is reached one
     of two ways.

       · THIS document IS the room (/artroom/viewer.html). Every viewer reveals
         itself with loaderEl.classList.add('done'), so watching that class
         needs no change inside any of them.

       · This document FRAMES the room (/arcade and /music are thin pages whose
         only content is an iframe of the viewer, with the nav bar supplied
         here). Then the loader lives in the child document, and the room tells
         us directly with a `<room>-ready` postMessage.

     A page that is neither — no loader, no frame — counts itself ready at once
     and simply lets the film play out. */
  function watchLoader() {
    var el = doc.getElementById("loader");
    if (el) {
      if (el.classList.contains("done")) { roomDone = true; return maybeLift(); }
      new MutationObserver(function (recs, obs) {
        if (el.classList.contains("done")) {
          obs.disconnect();
          roomDone = true;
          maybeLift();
        }
      }).observe(el, { attributes: true, attributeFilter: ["class"] });
      return;
    }

    var frames = doc.getElementsByTagName("iframe");
    if (!frames.length) { roomDone = true; return maybeLift(); }

    root.addEventListener("message", function onMsg(e) {
      // Same-origin by construction, but a message port is reachable by anyone
      // who can get a frame onto this page, so check rather than assume.
      if (e.origin !== root.location.origin) return;
      if (!e.data || typeof e.data.type !== "string") return;
      if (!/-ready$/.test(e.data.type)) return;
      root.removeEventListener("message", onMsg);
      roomDone = true;
      maybeLift();
    });
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window, document);
