import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spectral Manor Arcade | Plumbmonkey Media",
  description:
    "Step into the manor's arcade in 3D. Twelve original games from the Ghost Circuit universe, each in its own cabinet.",
  keywords: [
    "spectral manor arcade",
    "ghost circuit games",
    "plumbmonkey arcade",
    "browser games",
    "indie games",
  ],
  openGraph: {
    title: "Spectral Manor Arcade",
    description: "Twelve original games set inside the Ghost Circuit universe.",
    type: "website",
  },
};

/**
 * The arcade is now the 3D room, framed the same way /music/dm1 frames a Stave
 * instrument: a standalone page inside a React route, inheriting the site
 * chrome. The room's own hamburger and EXIT opt out when framed
 * (room-menu.js checks window.top !== window.self), so there is one nav, not
 * two — the same reason the instruments are embedded rather than linked.
 *
 * Framing it rather than moving the room to this route keeps `/arcade` as the
 * room's identity. rooms.js, RoomDoors and the Foyer's ten portal arches all
 * name that href, and the Foyer's copy is baked into foyer-web.glb as glTF
 * extras — so pointing the nav at /arcade/viewer.html instead would strand the
 * hub's own arch on the old page and fail the drift guard, and correcting it
 * would mean re-running the foyer's bake. That bake is not worth disturbing:
 * its light rig was fitted by hand to match the entry film's closing frame.
 *
 * The flat game list, with its leaderboards, lives on at /arcade/list and is
 * linked from the room. It is also where anyone without WebGL is sent.
 */
export default function ArcadePage() {
  return (
    <main className="min-h-screen bg-[#07040f] pt-16">
      <iframe
        src="/arcade/viewer.html"
        title="The Spectral Manor Arcade in 3D"
        className="block h-[calc(100svh-4rem)] min-h-[520px] w-full border-0"
        allow="xr-spatial-tracking; fullscreen; gyroscope; accelerometer"
      />
      <p className="sr-only">
        If the 3D arcade does not load,{" "}
        <a href="/arcade/list">open the full game list</a>.
      </p>
    </main>
  );
}
