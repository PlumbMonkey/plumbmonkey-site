/* ============================================================
   Plumbmonkey — reconciles the Stave app's own header with the site's.

   The SY-2/DM-2 bundle (main-*.js) ships its own bar:

     [• PLUMBMONKEY]        SY-2 / POLYPHONIC SYNTHESIZER  [OPEN DM-2]  [GEN 02]

   Standalone that is right — it is the only chrome the page has. But /music/sy1
   and /music/dm1 embed these pages in a React route that already renders
   NavBar.tsx, so it landed as a second brand bar 64px under the first: two
   "Plumbmonkey" wordmarks, one on top of the other, which is the double nav bar
   you see in the Music Sandbox. (/shared/site-nav.js was drawing a third; it
   now skips itself inside a frame.)

   Framed, this file:
     · hides the duplicate wordmark — the parent bar carries the brand
     · retargets the remaining links at the TOP window and at the React routes,
       so "OPEN DM-2" swaps the whole page to /music/dm1 rather than loading the
       raw standalone tool inside the frame while the address bar still reads
       /music/sy1

   Standalone it does nothing at all.

   Load it AFTER the app bundle; it does not care when the bar renders, because
   the CSS applies whenever it does and the link handling is delegated off
   document. Editing the bundle instead is not an option here — it is a build
   artifact copied in from the Stave project.
   ============================================================ */
(function () {
  "use strict";

  if (window.top === window.self) return;

  /* Where each standalone instrument URL lives on the React side. The bundle's
     links point at the raw pages; inside the frame those have to become the
     wrapping routes or the visitor ends up on a page with no site nav at all
     and a URL that describes a different one. */
  var ROUTES = {
    "/music/stave/": "/music/sy1",
    "/music/stave/index.html": "/music/sy1",
    "/music/stave/dm2/": "/music/dm1",
    "/music/stave/dm2/index.html": "/music/dm1",
    "/music/": "/music",
    "/music/index.html": "/music"
  };

  /* The bar keeps its instrument name, switch and generation pill, so it stays
     useful — it just stops presenting as the site's masthead and shrinks from
     72px to a title strip. Two full-height brand bars stacked was 136px of
     chrome above the instrument. Safe to resize: the app's own rule is a plain
     `min-height:72px` with nothing measuring against it. */
  var style = document.createElement("style");
  style.textContent =
    ".site-nav .wordmark{display:none!important}" +
    ".site-nav{min-height:44px!important;justify-content:flex-end!important}";
  document.head.appendChild(style);

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest(".site-nav a[href]");
    if (!a) return;

    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;   // in-page anchor, leave it

    var target = ROUTES[href] || ROUTES[href.replace(/\/?$/, "/")];
    if (!target) return;                            // unknown link, leave it

    e.preventDefault();
    // Same origin by construction — every ROUTES value is a site-relative path.
    window.top.location.href = target;
  });
})();
