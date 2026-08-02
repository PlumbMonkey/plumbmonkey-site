# Nav unification, hero polish, and VR — phased plan

Created 2026-08-01. Pick up at the first phase not marked DONE.
Each phase is independently shippable: finish one, commit, push. Nothing later depends on
anything later being started.

---

## The key fact that shapes all of this

`NavBar` is rendered in `app/layout.tsx` (line 105), above `{children}`. **Every one of the 25
Next.js routes already has the real site nav** — `/arcade`, `/music`, `/gallery`, `/screening-room`,
`/workshop`, `/contact`, `/pricing`, all the `/sales-hub/*` children, everything.

So "add the nav bar to the sub pages" is **not** about the Next.js pages. The pages missing it are
the **standalone HTML apps under `public/`**, which are served as static files and never pass
through the React layout. Those are the ones carrying bespoke navs.

### Current nav variants (the thing being removed)

| Variant | Where | Count |
|---|---|---|
| `.nav` bar from `public/music/shared/sound-stage.css` | drum-machine, song, stave (SY-2), stave/dm2 (DM-2) | 4 |
| `.pm-sandbox-nav` (its own markup + styles) | synth (SY-1) | 1 |
| `.tool-menu` dropdown (in-app topbar) | Light Lab `public/visual/index.html` | 1 |
| **nothing at all** | `public/arcade/games/*/index.html` | 10 |
| `room-nav.js` corner overlay | `public/gallery/viewer.html`, `public/theatre/viewer.html` | 2 |

Since Phase 5 there is a fifth consumer of the room list — the **world-space** panel in
`/shared/xr-room.js`, which reads `window.PM_ROOMS` at runtime rather than copying it. All navs on
the site now derive from `/shared/rooms.js`; `npm test` fails if any of them drift.

`public/shared/room-nav.js` still exists and is now referenced **only** by the two 3D viewers.
Once Phase 3 lands it has no callers and can be deleted.

---

## Phase 1 — one shared nav for the standalone pages  ✅ DONE (2026-08-01)

Shipped as `public/shared/site-nav.css` + `public/shared/site-nav.js`, now on all **six** non-game
standalone pages: the five music tools **and Light Lab** (the plan originally left Light Lab
unassigned; it belongs here, since only the two 3D viewers get the hamburger treatment).

`site-nav.js` is the single source of truth for the room list on static pages — mirror any change
into `app/components/NavBar.tsx` and vice versa.

**Why it is loaded synchronously as the first thing in `<body>`:** it emits the bar with
`document.write` during initial parse, so the markup lands at the top of the document with no
layout shift. Deferring it to the end of `<body>` would inject after first paint and visibly shove
every page down.

**Four things that bit during the rollout — expect them again in Phase 2:**
1. **`min-height` outranks a shorter `height`.** SY-1's bundle pins `min-height` to the full
   viewport, so `height: calc(100% - var(--pm-nav-h))` was silently ignored until `min-height: 0`
   was set alongside it.
2. **A stray `*/` kills every rule after it.** An edit left two comment terminators in SY-1's style
   block; the CSS parsed but the rules below were dead. If a rule "isn't applying", confirm the
   browser actually parsed it (`document.styleSheets` → `cssRules`) before assuming specificity.
3. **Source order beats intent.** A mobile override written *earlier* in the file than the base
   rule never wins. Page-level `.pm-nav` overrides must come after the base block.
4. **Pages that pad `<body>` and centre their children** (drum-machine, song) need the bar to
   `align-self: stretch` with negative horizontal margins, or it renders as a narrow inset box.

Original scope notes retained below for context.

Build a single drop-in nav for static pages that mirrors `app/components/NavBar.tsx`: the same
seven rooms in the same order, plus the "Work with me" CTA.

- New `public/shared/site-nav.css` + `public/shared/site-nav.js` (or one self-contained JS that
  injects both). One file to change when the room list changes — today the room list is duplicated
  across `NavBar.tsx`, `RoomDoors.tsx`, `room-nav.js` and several hand-written bars, which is
  exactly why "Sound Stage" vs "Music Sandbox" drifted before.
- Replace variants 1 and 2 (the 5 music tools) with it.
- Delete `.pm-sandbox-nav` and the per-page `.nav a` colour overrides once nothing uses them.

**Trap, already hit once:** the shared `.nav` uses a negative margin to bleed full width, sized
against a `<body>` padding of `2.5rem 1rem`. Pages without that padding (both Stave apps) must set
`--ss-pad-top` / `--ss-pad-x` to `0`, or the bar pulls up over the app. Whatever replaces it should
not repeat that coupling — prefer a bar that does not depend on the host page's padding at all.

## Phase 2 — arcade games  ✅ RESOLVED (2026-08-01) — deliberately NOT the full bar

**This phase was written on a wrong premise and is now closed.** The claim below that the games
have "no navigation" was incorrect: they have none in their *markup*, but
`public/arcade/games/leaderboard.js` — loaded by every game — injects a fixed corner nav
(`.sm-nav`) at runtime. It was always there; it just isn't greppable as an `<a>` in the HTML.

**Decision: games keep the lightweight corner nav.** The site now runs two tiers of chrome chosen
by mode — pages you *browse* (home, arcade hub, music tools, Light Lab) get the full bar; things
you are *inside* (the games, and the two 3D rooms in Phase 3) get minimal chrome plus a clear exit.
Reasons the full bar loses here: each game is a fixed-size canvas and several centre against the
viewport, so a 64px bar means re-centring ten bespoke layouts and risks exactly the clipping trap
noted below; it permanently eats play area; and "← Arcade" already lands on a page carrying the
full nav, so nothing is more than one extra click away.

Done in that spirit:
- Dropped the `/music` link — it singled out one of seven rooms and still read "Sound Stage".
  The corner nav is now just "← Arcade" and "Plumbmonkey Home".
- Restyled from the old arcade purple to the site's brass tokens, matching
  `/shared/site-nav.css` exactly (brass-200 `#e8c97e` text, brass-400 `#c4923a` hover,
  brass-500 `#a97829` border, moonlit-950 `#0a0c11` surface), plus uppercase/letter-spacing to
  match the bar's link treatment. One shared file, so all ten games change at once.

Still open if the games are ever revisited: 5 more copies live in the untracked
`public/arcade/wave-3-test/`; decide whether that folder is still wanted.

**The trap that made the full bar unattractive, kept for reference:** watch for the
viewport-clipping pattern (`height: 100vh/100dvh` + `overflow: hidden` on a wrapper). That is what
made the SY-1 sequencer unreachable — content pushed past a clipped boundary with no scrollbar able
to reach it. Anything added to a rigid full-height layout must come off the app's height
(`calc(100dvh - <bar height>)`), never be added as an extra row.

### Original text (superseded)
- 5 more copies live in the untracked `public/arcade/wave-3-test/`; decide whether that folder is
  still wanted before duplicating the work into it.

## Phase 3 — hamburger + exit for the 3D viewers  ✅ DONE (2026-08-01)

Shipped as `public/shared/room-menu.{css,js}`, on both viewers. Top-right (both viewers keep their
own controls along the bottom), z-index 35 — above each viewer's bars at 30, below the loading
screen at 40, so it does not show through while the model downloads.

- **Exit target is per-page** via `data-exit`: the gallery exits to `/gallery`, the theatre to
  `/screening-room` — the page the visitor entered from, so leaving reads as stepping back out of
  the room rather than being thrown home.
- **The current room is derived from the exit target**, not the URL. Path matching alone fails for
  the theatre: its viewer lives at `/theatre/viewer.html` but its room is `/screening-room`, so it
  highlighted nothing. `data-room` overrides if the two ever diverge.
- **`window.PM_ROOMS` is exposed** for Phase 5. A DOM overlay does not render inside an immersive
  XR session, so the in-headset menu must be rebuilt in world space from the same list.
- `public/shared/room-nav.js` is **deleted** — both viewers were its last callers. Verified zero
  references before removing it, and it is absent from the build output.

**Verified in both viewers** (1280x800, after the GLB finished loading): menu present at 12,12 from
the top-right; 8 links; correct room marked `aria-current`; panel opens on click, closes on outside
click and on Escape, and stays on screen. Critically, `document.elementFromPoint` at the viewport
centre still returns the CANVAS, so OrbitControls keeps receiving drags, and each viewer's own
bottom bar is still hit-testable — the theatre's mode buttons were clicked through and confirmed via
its `window.__sgt` hook (mode went to Concert).

**Follow-up worth doing:** the room list now exists in three places — `app/components/NavBar.tsx`,
`/shared/site-nav.js` and `/shared/room-menu.js`. Extract it to one `/shared/rooms.js` that all
three consume. Drift between copies is exactly what produced the "Sound Stage" vs "Music Sandbox"
inconsistency. Small job, worth doing before a fourth copy appears in Phase 5.

### Original scope (for reference)

- `public/gallery/viewer.html`, `public/theatre/viewer.html`.
- Remove their `room-nav.js` overlay; then delete `public/shared/room-nav.js` (no callers left).
- Must sit above the WebGL canvas and not steal pointer events from OrbitControls — the existing
  `.bar` elements in `theatre/viewer.html` are the pattern to copy (fixed, `z-index: 30`).
- This is also the menu VR needs in Phase 5, so build it as one component both paths can use.

## Phase 4 — gallery/theatre load time  📊 MEASURED (2026-08-01) — optimisation NOT yet done

**Measure first, and the measurement changed the plan.** The guesses below (KTX2, low-detail swap)
were mostly aimed at the wrong thing. Actual numbers:

### Where the time goes
- **Parse + Draco decode is NOT the problem: 200 ms** for the whole gallery, measured by fetching
  the GLB and timing `GLTFLoader.parse` directly with the decoder warm.
- **The first load of a browser session paid ~8 s**, almost all of it *after* the GLB had finished
  downloading (download completed at 56 ms). That is the **cold Draco WASM compile plus worker
  start-up**, not download and not parse — a second load in the same session finished before a
  25 ms poller could even catch it.
- Locally there is no network, so **real-world first visits are dominated by download**, which no
  local measurement can reproduce. Payload is therefore the lever that matters.

### What the payload is actually made of
Measured by parsing the GLB chunk headers directly (script pattern kept below).

| | Gallery | Theatre |
|---|---|---|
| Total | 4.15 MB | 3.57 MB |
| JSON (scene graph) | 0.69 MB (17%) | **1.48 MB (41%)** |
| Textures | **2.26 MB (54%)**, 21 images | 0.39 MB (11%), 9 images |
| Geometry | 1.21 MB (29%) | 1.70 MB (48%) |
| meshes / nodes | 824 / 1378 | 187 / 636 |
| accessors / bufferViews | 2411 / 1040 | 5642 / **9414** |

**Two different problems, so two different fixes:**

1. ~~**Gallery is textures.**~~ **✅ INVESTIGATED 2026-08-01 — deliberately left alone. Do not
   re-open this without new information.** The guess that the artwork was "generous for images
   viewed at distance" was wrong, and the measurement says the opposite.

   The canvases are **2.02–2.45 m wide** carrying ~1270 px textures — **6.3 px/cm, about 16 DPI**.
   That is already low for artwork a visitor can walk up to, not extravagant. There is no headroom
   to reclaim by downscaling.

   Quality is a weak lever too. Measured, same settings, only `export_image_quality` varying:

   | setting | size |
   |---|---|
   | committed build | 4253 KB |
   | q75 | 4387 KB |
   | q65 | 4171 KB |
   | q50 | 3970 KB |

   The committed build was already exported at roughly q68. Reaching a **6.7%** saving means
   dropping to q50 and visibly degrading the one thing people come to a gallery for. Not worth it.

   Morph targets (13 drum-head meshes, never driven — the gallery viewer has no morph code at all)
   cost a grand total of **21 KB**. Not worth a re-export on their own.

   `GAL_Fnt_MistVolume` and `GAL_DustMote` exist and are exactly the volume-only and
   particle-instance-source traps that bloated the theatre — but the shipped gallery build already
   excludes both. Verified by inspecting the committed GLB, not assumed.

   **Conclusion: the gallery model is already at its floor.** The theatre's 55% cut was possible
   because it carried genuine waste; the gallery does not. The only remaining model-side lever is
   the scene graph (824 meshes / 1378 nodes / 1.9 MB of non-texture data), which means merging
   objects — and that risks the per-exhibit rotation pivots, for a modest gain.

   **What was done instead** (no quality cost): both room pages now start downloading the model on
   hover/focus of their "Enter the …" button rather than on click — see
   `app/components/EnterRoomLink.tsx`. Deliberately not prefetched on page load, since these are
   multi-megabyte files and most visitors to a room page never click through.

2. ~~**Theatre is scene-graph bloat, and there is an anomaly.**~~ **✅ FIXED 2026-08-01 — 3.57 → 1.59 MB.**
   The morph-target suspicion was right, but not on the drapes. The **moving-light fixtures** owned
   it: 14 × `Spot Mover Images` (12 morph targets each, 864 verts) and 14 × `Spot Mover Shutter`
   (9 each) — **294 of the 296 morph targets in the file**, versus 2 for the drapes. They are the
   fixtures' gobo and shutter mechanism, sitting 8.07 m overhead inside the housings, every shape
   key at value 0, driven by Blender-only drivers the browser never runs.

   Excluded from the web export and the JSON chunk collapsed **1.48 → 0.19 MB**, bufferViews
   **9,414 → 232**, accessors **5,642 → 611**. Over the wire it is now **877 KB gzipped**.

   Also caught in the same pass: `SGT_DustMote`, the particle *instance source* for the dust system,
   parked at z = −80 so it never shows in Blender. Particles have no glTF representation, so it
   would have exported as a lone box 80 m under the theatre — the same failure mode as the
   Stage_Haze slab. The export now excludes any object used as a particle instance source.

   **The .blend was not modified.** The exclusion flips `hide_render` and restores it, so the
   fixtures keep their working shutter/gobo rig for Blender renders. Verified restored afterwards.
   Diffed against the committed build: exactly two mesh-node names dropped
   (`Spot Mover Images`, `Spot Mover Shutter`), nothing added. Mode rig re-verified in the browser
   at 1.0 / 0.72 / 0.72 / 0.0 with the screen dropping 9.6 → 0, all five viewpoints present.

   **Reusable export snippet** lives in the theatre's own HANDOFF.md — reuse it for any future
   re-export rather than reconstructing the flags.

**Both fixes require a Blender re-export**, so they need a session with the .blend files open via
MCP. Nothing here is fixable from the website repo alone — there is no image library on this machine
(no ffmpeg, cv2, PIL or sharp) to recompress textures in place.

### Checked and ruled out
- **Vendored three.js is already minified and correctly split** — `three.module.js` (331 KB) is the
  minified module that imports `three.core.min.js` (372 KB). Not redundant; omitting the core chunk
  fails silently, which has bitten this project before.
- `draco_decoder.js` (500 KB) ships but is **never fetched** — it is the non-WASM fallback. Dead
  weight on disk, not on the wire.
- gzip will not help much: the payload is already-compressed JPEG and Draco.

### Original notes (superseded by the measurements above)
Both viewers show a loading screen for a noticeable stretch. Neither loads instantly because of
raw payload: `gallery-web.glb` ≈ 4.36 MB, `theatre-web.glb` ≈ 3.74 MB, plus ~1.7 MB of shared
vendored three.js + Draco decoder on first visit.

Worth measuring before optimising — check whether the wait is download, Draco decode, or first-frame
shader compile, because the fix differs for each. Options: KTX2/Basis textures (usually the biggest
remaining win, since textures already dominated both exports), a low-detail model swapped for the
full one after first paint, or simply a better-communicated progress bar if the payload is near
its floor.

## Phase 5 — Quest browser / WebXR  🟡 BUILT (2026-08-01) — awaiting on-device test

Shipped as one module, `public/shared/xr-room.js`, imported by both viewers. Desktop behaviour is
verified unchanged; **nothing in the immersive path has run on a headset yet** — see §"On-device
test script" below, which is the remaining work.

### What it does

- **Entry**: an `Enter in VR` button, top-left, brass-token styled to match `/shared/room-menu.css`.
- **Locomotion**: teleport only — parabolic arc from either controller, trigger to commit, plus
  left-stick-forward as an alternate aim. Right stick left/right is a 30° snap turn.
- **Menu**: a world-space panel on the Y / B button, built from `window.PM_ROOMS`.
- **Rig**: the camera is parented to a `PM_XRRig` group; teleport and snap turn move the group.

### Two vendored files the plan called for, deliberately not added

1. **`VRButton.js`.** It always renders *something* — with no headset present it shows a
   `VR NOT SUPPORTED` pill at `bottom: 20px`, centred, which is exactly where both viewers already
   put their `#views` bar. Every desktop visitor would get a collision for a control they cannot
   use. The replacement button is created only after `isSessionSupported('immersive-vr')` resolves
   true, so desktop renders nothing at all. Verified: `.pm-xr-btn` is absent on both pages here.
2. **`XRControllerModelFactory.js`.** Its `DEFAULT_PROFILES_PATH` fetches controller meshes from
   `cdn.jsdelivr.net` at runtime. The site loads no CDN assets anywhere — that is why three is
   vendored in the first place — so the controllers get a locally-built grip and ray instead.

The vendored three **is 0.180.0, the same version as `node_modules`** (confirmed by the version
string in `three.core.min.js`), so if either file is ever wanted it can be copied straight across
with no compatibility risk.

### How "confined to the room" is actually enforced

**Not** a bounding box, and not the `NAV_*` anchors the original plan suggested. There is no
continuous locomotion, and the teleport arc raycasts against a *named whitelist of floor meshes*
only. Nothing else in either scene is a valid landing target, so there is nowhere outside the room
to land. The constraint then follows the geometry for free — the gallery's balcony decks and stair
flight are reachable because they are real walkable surfaces, with no anchor list to maintain.

Hits are additionally rejected unless the face normal is within ~44° of straight up (stops the arc
landing on the underside of a balcony deck) and within 22 m of the controller.

| | pattern | matched at runtime |
|---|---|---|
| Gallery | `^(GAL_Floor_\|GAL_Wing_\w+_Floor\|GAL_FloorTiles_\|GAL_Balc_Deck_\|GAL_Stair_Flight)` | **21 meshes** |
| Theatre | `^(Auditorium_Floor\|Stage_Deck\|Drum_Riser\|SGT_Balcony_Deck)$` | **4 meshes** |

Both patterns are anchored deliberately. The gallery's scale model of the manor contributes a
`Band_Floor` and a `Porch_Deck`; standing on those would drop the visitor into a doll's house.

**The theatre is auditorium-only, and this is a real open question.** `LOB_FloorBase`,
`LOB_Staircase`, `DR_Floor` and `PB_Floor` are excluded because their geometry is baked with a zero
node transform and their NAV anchors sit at z = −4 to −7 — i.e. *inside the stage house*. On the
numbers available they overlap the auditorium in world space, and adding them would let a visitor
teleport into a wall. Confirm where those sets actually sit before opening them up.

### Verified here (desktop, 1280×800, both viewers)

- Walkable sets resolve to the counts above; `xr.debug.goTo()` at NAV_Entrance, the hall centre,
  the wing, NAV_Orchestra, the stage and the balcony all land on floor. Probes at z = 60 and
  x = 40 — outside both buildings — return `null`, so the bounds hold.
- Floor heights come out of the raycast, not hard-coded: the theatre's raked house gives y = 2.16
  at the spawn, y = 1.0 at the stage, y = 11.0 on the balcony.
- The world-space panel builds 9 rows from `PM_ROOMS` + Home + Exit, and its canvas textures
  contain drawn glyphs (1.7–3.5% bright pixels on dark ground). Panel is 0.56 × 0.80 m at 0.85 m.
- **No regression**: both viewers load clean, OrbitControls still orbits (synthetic drag moved the
  theatre camera from `0,8,22` to `-3.19,8,21.63`), the mode rig still reports Concert, both bars
  and the room menu are intact, no console errors, no VR button on desktop.
- `npm run build` and `npm test` pass.

### Two traps worth keeping

1. **OrbitControls and the XR pose fight over the same properties.** three decomposes the headset
   pose into `camera.position`/`.quaternion` every frame; OrbitControls writes those too. The
   module disables `controls` and snapshots the desktop camera + target on session start, restoring
   both on end — without that, the camera keeps whatever pose the headset last had. The viewer
   still has to skip its own `controls.update()` call, because damping runs regardless of
   `.enabled`. Both viewers now guard it with `if (!xr.presenting)`.
2. **`window.PM_ROOMS` does not exist when the viewer's module runs.** `/shared/rooms.js` is a
   classic deferred script and the inline module executes before it. The panel is therefore built
   on first open, not at import. Do not move that read to module scope.

### Console hook

`window.__pmxr`, in the spirit of the theatre's `window.__sgt` — this phase cannot be exercised in
a desktop browser at all, so the Quest's remote inspector is the only place most of it can be
checked. `__pmxr.debug` exposes `rig`, `hands`, `menu`, `walkable` (matched names), `landing`
(current arc target), `goTo(x, z)`, `toggleMenu()` and `snapTurn(±1)`.

### On-device test script — the remaining work

Serve over HTTPS (WebXR requires a secure context; `localhost` counts, a LAN IP does not) and open
each viewer in the Quest browser.

1. `Enter in VR` appears at top-left, and only on the headset.
2. Spawn: gallery at the entrance facing down the hall; theatre mid-orchestra facing the stage.
   Feet on the floor, not sunk or floating.
3. Point at the floor and pull the trigger — arc goes brass when the landing is valid, dim when it
   is not. Confirm it refuses to land on walls, artwork, seats and the ceiling.
4. Gallery only: teleport up the stair flight onto the balcony deck.
5. Right stick left/right snaps 30° per push, one turn per push, and turns about your head rather
   than swinging you through an arc.
6. Y or B opens the panel an arm's length ahead at eye height, upright. Rows highlight on point.
   Check the labels are legible at that size — this is the one thing that could not be verified
   here.
7. Selecting a room navigates and ends the session; `✕ Exit` returns to `/gallery` and
   `/screening-room` respectively.
8. **Framerate.** Both scenes are lit with a hand-placed rig (the gallery has 4 point lights and a
   directional, the theatre 4 points, a spot and a directional) over ~300k and ~200k triangles,
   now rendered twice per frame. If it will not hold 72 Hz, the first lever is dropping point
   lights in XR, not reducing geometry. Foveation is already at max.

### Not attempted

Hand tracking, controller model meshes, teleport-anchor snapping to the `NAV_*` empties, and any
in-XR use of the viewpoint or mode bars (they are DOM, so they do not exist inside the session —
the theatre's mode rig can only be changed before entering).

---

## Related state at time of writing

- Hero: fixed. `app/components/HeroLoop.tsx` now owns the home page loop, carries no poster, and
  pauses on frame one for reduced-motion users. `spectral-manor-poster.jpg` is no longer referenced
  by the home page and is a candidate for deletion once nothing else uses it.
- **No still of the current hero loop exists**, and this machine has no ffmpeg/cv2/PIL to cut one.
  If a poster is ever wanted again, grab a frame in the browser (draw the video to a canvas,
  `toDataURL`) or re-render one from Blender.
- Dead assets still present: `spectral-manor-hero.webp`, `spectral-manor-fog-loop.webp`,
  `hero-loop.jpg` (an unrelated DAW screenshot despite the name), and `app/components/HeroVideo.tsx`
  (an old YouTube-based hero, unreferenced).
- SY-1 sequencer: reachable again via a CSS stopgap in `public/music/synth/index.html`. The real
  fix belongs in the Stave source and is written up in that repo's `HANDOFF.md`.
