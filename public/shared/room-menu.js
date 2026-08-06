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
   data-exit-icon  optional override for its glyph (✕ for "Exit", ← otherwise).
   data-room       which room to mark current, when it differs from data-exit.
   data-side       "left" moves the menu to the top-left corner.
   data-z          override the stacking order (see room-menu.css).

   The arcade games load this at runtime from /arcade/games/leaderboard.js
   rather than a <script> tag, with data-side="left" and data-z="9998" — see
   the injectNav() comment there.

   Exposes window.PM_ROOMS so Phase 5 (WebXR) can build a world-space panel
   from the same list — a DOM overlay does not render inside an immersive
   session, so the in-headset menu has to be rebuilt in the scene, and it must
   not fall out of sync with this one.

   ROOM LIST: comes from /shared/rooms.js, the one place every nav reads.
   ============================================================ */
(function () {
  "use strict";

  /* Framed pages get no chrome, matching site-nav.js. The arcade lobby runs
     every game as a muted attract-mode iframe, and a menu drawn over a tile in
     the cabinet grid is decoration the visitor cannot use. leaderboard.js also
     gates on ?attract=1; this is the guard that does not depend on the embedder
     remembering the query string. */
  if (window.top !== window.self) return;

  /* The room list comes from /shared/rooms.js, which also defines
     window.PM_ROOMS for the WebXR panel in Phase 5. Load it first:
       <script src="/shared/rooms.js" defer></script>
       <script src="/shared/room-menu.js" data-exit="..." defer></script>
     Deferred scripts run in document order, so that ordering holds. */
  var ROOMS = window.PM_ROOMS;
  if (!ROOMS) {
    console.error("room-menu.js: /shared/rooms.js must load first");
    return;
  }

  var script = document.currentScript;
  var exitHref = (script && script.dataset.exit) || "/";
  var exitLabel = (script && script.dataset.exitLabel) || "Exit";
  /* ✕ when the label is the generic "Exit" — you are closing the room you are
     in. When the label names where you land ("Arcade", as the games set it),
     ✕ reads as "close Arcade"; ← reads as "back to Arcade", which is what the
     control actually does. */
  var exitIcon = (script && script.dataset.exitIcon) ||
    (exitLabel === "Exit" ? "✕" : "←");

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
    el.className = "pm-room-menu" +
      (script && script.dataset.side === "left" ? " pm-room-menu--left" : "");
    if (script && script.dataset.z) {
      el.style.setProperty("--pm-room-menu-z", script.dataset.z);
    }
    el.innerHTML =
      '<a class="pm-room-menu__exit" href="' + esc(exitHref) + '"' +
        ' title="Leave this room">' + esc(exitIcon) + ' ' + esc(exitLabel) + '</a>' +
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
