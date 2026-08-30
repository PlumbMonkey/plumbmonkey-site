/* ============================================================
   Plumbmonkey — THE canonical room list. Single source of truth.

   Every navigation on the site reads from this file:
     · app/components/NavBar.tsx   (React, all 25 Next.js routes) — imports it
     · app/components/Footer.tsx   (the footer's "The rooms" column) — imports it
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
   and you walk into the space rather than straight into the tool — the room
   hands you the tool once you are inside (the Luminarium's console screens and
   the Art Room's easel both link onward), which is how the Foyer's arch has
   always treated them.

   Read `room3d` through entrance() below rather than reaching for the field,
   and mark the current room with roomPaths(). Every nav does, so the arch and
   the menus agree on where a room's door is. They did not always: `room3d`
   started as data that nothing rendered, which left the rotunda live on the
   site and unreachable from any menu on it.

   `npm test` accepts a foyer arch pointing at either address, and checks the
   room3d file is really there.
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

  /* Where a nav link for this room points. A room with an immersive entrance is
     entered through it — building the space and then routing every menu past it
     is the one way to have it and not show it. */
  function entrance(room) {
    return (room && (room.room3d || room.href)) || "/";
  }

  /* Every address that means "you are in this room", for current-page marking.
     A room with a 3D space answers to both: the nav now sends you to
     /luminarium/viewer.html, but /visual/index.html is still the Luminarium and
     should still light up in the bar. */
  function roomPaths(room) {
    if (!room) return [];
    return room.room3d ? [room.href, room.room3d] : [room.href];
  }

  root.PM_ROOMS = ROOMS;
  root.PM_CTA = CTA;
  root.PM_ENTRANCE = entrance;
  root.PM_ROOM_PATHS = roomPaths;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ROOMS: ROOMS, CTA: CTA, entrance: entrance, roomPaths: roomPaths };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
