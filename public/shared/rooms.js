/* ============================================================
   Plumbmonkey — THE canonical room list. Single source of truth.

   Every navigation on the site reads from this file:
     · app/components/NavBar.tsx   (React, all 25 Next.js routes) — imports it
     · /shared/site-nav.js         (the bar on standalone pages)  — reads globals
     · /shared/room-menu.js        (the 3D rooms' hamburger)      — reads globals

   Add, rename, reorder or remove a room HERE and all three follow. The list
   used to be copied into each of them, which is how the same room ended up
   labelled "Sound Stage" in some navs and "Music Sandbox" in others.

   It works two ways on purpose, because its consumers load differently:
     · as a plain <script src>, it assigns window.PM_ROOMS / window.PM_CTA
       (the static pages cannot use ES modules — site-nav.js has to run
       synchronously during parse, and `type="module"` is always deferred)
     · as a CommonJS module, so the bundled React side can import it

   `label` is the short nav name. The home page grid (RoomDoors.tsx) shows
   longer display names ("The Arcade") plus its own taglines and artwork, so it
   keeps that presentation data — but it must cover exactly these hrefs, and
   `npm test` fails if it drifts.

   `room3d` is optional, and means "this room has an immersive entrance". The
   Luminarium and the Art Room are 2D tools that each now also have a 3D space,
   and the Foyer's arch leads into the space rather than straight to the tool —
   you walk into the room, and the room hands you the tool (the Luminarium's
   console screens and the Art Room's easel both link onward). The navs still
   use `href`, so the tools stay one click away for anyone who wants them
   directly. `npm test` accepts a foyer arch pointing at either, and checks the
   file is really there.
   ============================================================ */
(function (root) {
  "use strict";

  var ROOMS = [
    { href: "/arcade", label: "Arcade" },
    { href: "/music", label: "Music Sandbox" },
    { href: "/visual/index.html", label: "Luminarium", room3d: "/luminarium/viewer.html" },
    { href: "/natural-media-lab", label: "Art Room", room3d: "/artroom/viewer.html" },
    { href: "/screening-room", label: "Theatre" },
    { href: "/gallery", label: "Gallery" },
    { href: "/workshop", label: "Workshop" }
  ];

  var CTA = { href: "/onboarding/orientation", label: "Work with me" };

  root.PM_ROOMS = ROOMS;
  root.PM_CTA = CTA;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ROOMS: ROOMS, CTA: CTA };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
