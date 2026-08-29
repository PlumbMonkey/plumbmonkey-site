import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Music Room | Plumbmonkey",
  description:
    "Step into the manor's music room in 3D. Two consoles and a song desk, each one opening a real instrument you can play in the browser.",
  keywords: ["Stave", "SY-2 synthesizer", "DM-2 drum machine", "browser synth", "browser drum machine", "3D music room"],
  openGraph: {
    title: "The Music Room — The Spectral Manor",
    description: "Summon a beat. Shape your sound. Build a complete song.",
    type: "website",
  },
};

/**
 * The music room, framed exactly the way /arcade frames its own 3D room and
 * /music/dm1 frames a Stave instrument: a standalone page inside a React route,
 * inheriting the site chrome. The room's hamburger and EXIT opt out when framed
 * (room-menu.js checks window.top !== window.self), so there is one nav.
 *
 * Framing rather than moving the room to this route keeps `/music` as the
 * room's identity. rooms.js, RoomDoors and the Foyer's arches all name that
 * href, and the Foyer's copy is baked into foyer-web.glb as glTF extras with
 * scripts/check-room-lists.mjs asserting the three agree — so pointing the nav
 * at /music/viewer.html would strand the hub's own arch and fail that guard.
 *
 * The sandbox page — the tool cards, the project-resume, the Luminarium
 * handoff and the store — lives on at /music/studio, linked from inside the
 * room and from the WebGL failure message. It is a landing page rather than a
 * lobby, so unlike the arcade's game grid it is not superseded by the room;
 * both are worth having.
 */
export default function MusicPage() {
  return (
    <main className="min-h-screen bg-[#07060c] pt-16">
      <iframe
        src="/music/viewer.html"
        title="The Spectral Manor music room in 3D"
        className="block h-[calc(100svh-4rem)] min-h-[520px] w-full border-0"
        allow="xr-spatial-tracking; fullscreen; gyroscope; accelerometer"
      />
      <p className="sr-only">
        If the 3D music room does not load,{" "}
        <a href="/music/studio">open the music sandbox</a>.
      </p>
    </main>
  );
}
