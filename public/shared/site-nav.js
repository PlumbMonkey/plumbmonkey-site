/* ============================================================
   Plumbmonkey — shared site nav for STANDALONE pages.

   Pair with /shared/site-nav.css. Load this as the FIRST thing inside <body>,
   synchronously (no defer, no async):

     <link rel="stylesheet" href="/shared/site-nav.css" />
     ...
     <body>
       <script src="/shared/site-nav.js"></script>

   Synchronous and first means the bar is written before the rest of the body
   parses, so it lands at the top of the document with no layout shift. Loading
   it deferred at the end of <body> would inject the bar after the page had
   already painted and visibly shove everything down.

   The room list lives in /shared/rooms.js, which every nav on the site reads.
   Load it before this file.

   Opt out on a page that must not have it:  <body data-site-nav="off">
   ============================================================ */
(function () {
  "use strict";

  /* The room list comes from /shared/rooms.js — load it first:
       <script src="/shared/rooms.js"></script>
       <script src="/shared/site-nav.js"></script>
     Both must be synchronous and in that order, because this script writes the
     bar during parse. If rooms.js is missing the bar is skipped rather than
     rendered wrong. */
  var ROOMS = window.PM_ROOMS;
  var CTA = window.PM_CTA;
  if (!ROOMS || !CTA) {
    console.error("site-nav.js: /shared/rooms.js must load first");
    return;
  }

  var script = document.currentScript;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Which room are we in? Compare on the first path segment so that
     /music/synth/index.html still marks "Music Sandbox", and /visual/index.html
     matches the Light Lab entry that carries a filename. */
  function segment(path) {
    var m = String(path).replace(/^\/+/, "").split("/")[0];
    return m ? m.toLowerCase() : "";
  }
  var here = segment(location.pathname);

  function link(room, cls) {
    var current = segment(room.href) === here;
    return '<a href="' + esc(room.href) + '"' +
      (cls ? ' class="' + cls + '"' : "") +
      (current ? ' aria-current="page"' : "") +
      ">" + esc(room.label) + "</a>";
  }

  var links = ROOMS.map(function (r) { return link(r, ""); }).join("");

  var html =
    '<header class="pm-nav">' +
      '<a class="pm-nav__brand" href="/">' +
        '<span class="pm-nav__mark">P</span>' +
        '<span class="pm-nav__name"><strong>Plumbmonkey</strong><small>Spectral Manor</small></span>' +
      '</a>' +
      '<nav class="pm-nav__links" aria-label="Rooms">' + links + '</nav>' +
      '<a class="pm-nav__cta" href="' + esc(CTA.href) + '">' + esc(CTA.label) + '</a>' +
      '<button class="pm-nav__toggle" type="button" aria-label="Open navigation"' +
        ' aria-expanded="false" aria-controls="pm-nav-drawer">&#9776;</button>' +
    '</header>' +
    '<div class="pm-nav__drawer" id="pm-nav-drawer">' + links +
      '<a class="pm-nav__cta" href="' + esc(CTA.href) + '">' + esc(CTA.label) + '</a>' +
    '</div>';

  function wire() {
    var toggle = document.querySelector(".pm-nav__toggle");
    var drawer = document.getElementById("pm-nav-drawer");
    if (!toggle || !drawer) return;

    function setOpen(open) {
      drawer.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      toggle.innerHTML = open ? "&times;" : "&#9776;";
    }

    toggle.addEventListener("click", function () {
      setOpen(!drawer.classList.contains("is-open"));
    });
    // Matches NavBar.tsx, which closes the mobile menu on resize.
    addEventListener("resize", function () { setOpen(false); });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  if (document.body && document.body.getAttribute("data-site-nav") === "off") return;

  /* document.write is deliberate: it is the one way to emit markup at this exact
     point in the parse, which is what keeps the bar from shifting the layout.
     It is safe here only because the script is synchronous and runs during
     initial parsing — never call this after load. */
  document.write(html);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  void script;
})();
