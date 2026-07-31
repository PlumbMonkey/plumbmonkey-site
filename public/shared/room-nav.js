/*
 * Plumbmonkey — shared room navigation for standalone apps under /public.
 *
 * Next.js routes get <NavBar> from app/layout.tsx. The static apps in /public
 * (arcade games, music tools, light lab) live outside that tree, so they get
 * this instead. Collapsed to a small corner button by default so it never
 * covers a game's playfield.
 *
 * Usage: <script src="/shared/room-nav.js" defer></script>
 * Opt out of a page with: <body data-room-nav="off">
 */
(function () {
  "use strict";
  if (window.__pmRoomNav) return;
  window.__pmRoomNav = true;

  var ROOMS = [
    { href: "/", label: "Home" },
    { href: "/arcade", label: "Arcade" },
    { href: "/music", label: "Sound Stage" },
    { href: "/visual/index.html", label: "Light Lab" },
    { href: "/natural-media-lab", label: "Art Room" },
    { href: "/screening-room", label: "Theatre" },
    { href: "/gallery", label: "Gallery" },
    { href: "/workshop", label: "Workshop" }
  ];

  function build() {
    if (document.body.getAttribute("data-room-nav") === "off") return;
    if (document.getElementById("pm-room-nav")) return;

    var css = document.createElement("style");
    css.textContent = [
      "#pm-room-nav{position:fixed;top:10px;left:10px;z-index:2147483000;",
      "font:600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
      "#pm-room-nav .pm-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;",
      "background:rgba(12,10,20,.82);color:#f0c274;border:1px solid rgba(240,194,116,.38);",
      "border-radius:8px;padding:7px 11px;backdrop-filter:blur(6px);user-select:none}",
      "#pm-room-nav .pm-toggle:hover{background:rgba(20,16,32,.94);color:#ffd9a0}",
      "#pm-room-nav ul{list-style:none;margin:6px 0 0;padding:6px;display:none;",
      "background:rgba(12,10,20,.94);border:1px solid rgba(240,194,116,.28);",
      "border-radius:8px;min-width:150px;backdrop-filter:blur(6px)}",
      "#pm-room-nav.pm-open ul{display:block}",
      "#pm-room-nav li a{display:block;padding:7px 10px;border-radius:6px;",
      "color:#e6e2f0;text-decoration:none}",
      "#pm-room-nav li a:hover{background:rgba(240,194,116,.16);color:#ffd9a0}",
      "@media print{#pm-room-nav{display:none}}"
    ].join("");
    document.head.appendChild(css);

    var wrap = document.createElement("nav");
    wrap.id = "pm-room-nav";
    wrap.setAttribute("aria-label", "Plumbmonkey rooms");

    var btn = document.createElement("button");
    btn.className = "pm-toggle";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = "<span aria-hidden='true'>◀</span><span>Manor</span>";

    var list = document.createElement("ul");
    ROOMS.forEach(function (r) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = r.href;
      a.textContent = r.label;
      li.appendChild(a);
      list.appendChild(li);
    });

    function setOpen(v) {
      wrap.classList.toggle("pm-open", v);
      btn.setAttribute("aria-expanded", v ? "true" : "false");
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!wrap.classList.contains("pm-open"));
    });
    document.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    wrap.appendChild(btn);
    wrap.appendChild(list);
    document.body.appendChild(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
