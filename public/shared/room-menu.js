/* ============================================================
   Plumbmonkey — minimal chrome for the immersive 3D rooms.

   Pair with /shared/room-menu.css. Load at the END of <body> (unlike
   site-nav.js): these pages have no document flow to shift — the viewer is a
   full-screen canvas — so there is no layout-shift reason to inject during
   parse, and deferring keeps it out of the way of the WebGL bootstrap.

     <link rel="stylesheet" href="/shared/room-menu.css" />
     ...
     <script src="/shared/room-menu.js" data-exit="/gallery" defer></script>

   data-exit       where the Exit control goes. Should be the page the visitor
                   entered from, so leaving feels like stepping back out of the
                   room rather than being thrown to the home page.
   data-exit-label optional override for the Exit label.

   Exposes window.PM_ROOMS so Phase 5 (WebXR) can build a world-space panel
   from the same list — a DOM overlay does not render inside an immersive
   session, so the in-headset menu has to be rebuilt in the scene, and it must
   not fall out of sync with this one.

   ROOM LIST: this mirrors app/components/NavBar.tsx and
   /shared/site-nav.js. There are now three copies; the list wants extracting
   into one /shared/rooms.js that all three consume. Until then, change all
   three together — a drifted copy is exactly how the same room ended up called
   "Sound Stage" in some navs and "Music Sandbox" in others.
   ============================================================ */
(function () {
  "use strict";

  var ROOMS = [
    { href: "/arcade", label: "Arcade" },
    { href: "/music", label: "Music Sandbox" },
    { href: "/visual/index.html", label: "Light Lab" },
    { href: "/natural-media-lab", label: "Art Room" },
    { href: "/screening-room", label: "Theatre" },
    { href: "/gallery", label: "Gallery" },
    { href: "/workshop", label: "Workshop" }
  ];
  window.PM_ROOMS = ROOMS;

  var script = document.currentScript;
  var exitHref = (script && script.dataset.exit) || "/";
  var exitLabel = (script && script.dataset.exitLabel) || "Exit";

  /* Which room the visitor is currently standing in. Defaults to the exit
     target, which is already "the page this room belongs to" — so the gallery
     viewer marks Gallery and the theatre viewer marks Theatre with no extra
     configuration. Path matching alone is not enough: the theatre viewer lives
     at /theatre/viewer.html but its room is /screening-room, so it would
     highlight nothing. data-room overrides if the two ever diverge. */
  var currentHref = (script && script.dataset.room) || exitHref;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function segment(path) {
    var m = String(path).replace(/^\/+/, "").split("/")[0];
    return m ? m.toLowerCase() : "";
  }

  function build() {
    if (document.querySelector(".pm-room-menu")) return;
    var here = segment(currentHref);

    var links = ROOMS.map(function (r) {
      var current = r.href === currentHref || segment(r.href) === here;
      return '<a href="' + esc(r.href) + '"' + (current ? ' aria-current="page"' : "") +
        ">" + esc(r.label) + "</a>";
    }).join("");

    var el = document.createElement("div");
    el.className = "pm-room-menu";
    el.innerHTML =
      '<a class="pm-room-menu__exit" href="' + esc(exitHref) + '"' +
        ' title="Leave this room">&#10005; ' + esc(exitLabel) + '</a>' +
      '<div class="pm-room-menu__wrap">' +
        '<button class="pm-room-menu__btn" type="button" aria-label="Open room menu"' +
          ' aria-expanded="false" aria-controls="pm-room-panel">&#9776;</button>' +
        '<div class="pm-room-panel" id="pm-room-panel">' +
          '<div class="pm-room-panel__label">Spectral Manor</div>' + links +
          '<hr /><a href="/">Plumbmonkey Home</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    var btn = el.querySelector(".pm-room-menu__btn");
    function setOpen(open) {
      el.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!el.classList.contains("is-open"));
    });
    /* Close on outside click and on Escape. Both matter more here than on an
       ordinary page: the canvas behind is draggable, and a panel left open
       sits over the scene the visitor came to look at. */
    document.addEventListener("click", function (e) {
      if (!el.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
