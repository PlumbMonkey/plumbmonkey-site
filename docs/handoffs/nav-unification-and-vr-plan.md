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

## Phase 3 — hamburger + exit for the 3D viewers  ⬜ NOT STARTED

Gallery and Theatre are immersive and should **not** get the full bar. They get a hamburger
dropdown (the seven rooms + Home) and a clearly marked **Exit**.

- `public/gallery/viewer.html`, `public/theatre/viewer.html`.
- Remove their `room-nav.js` overlay; then delete `public/shared/room-nav.js` (no callers left).
- Must sit above the WebGL canvas and not steal pointer events from OrbitControls — the existing
  `.bar` elements in `theatre/viewer.html` are the pattern to copy (fixed, `z-index: 30`).
- This is also the menu VR needs in Phase 5, so build it as one component both paths can use.

## Phase 4 — gallery/theatre load time  ⬜ NOT STARTED

Both viewers show a loading screen for a noticeable stretch. Neither loads instantly because of
raw payload: `gallery-web.glb` ≈ 4.36 MB, `theatre-web.glb` ≈ 3.74 MB, plus ~1.7 MB of shared
vendored three.js + Draco decoder on first visit.

Worth measuring before optimising — check whether the wait is download, Draco decode, or first-frame
shader compile, because the fix differs for each. Options: KTX2/Basis textures (usually the biggest
remaining win, since textures already dominated both exports), a low-detail model swapped for the
full one after first paint, or simply a better-communicated progress bar if the payload is near
its floor.

## Phase 5 — Quest browser / WebXR  ⬜ NOT STARTED

Goal: walk both rooms in VR on the Quest browser with motion controllers, confined to the room,
with the Phase 3 exit menu reachable in-headset.

- three.js is already vendored, so `renderer.xr.enabled = true` + `VRButton` is the entry point.
  Confirm the vendored copy includes `VRButton.js` and `XRControllerModelFactory.js` under
  `/gallery/vendor/jsm/` — **if not, they must be added to the local vendor bundle**, since the
  site deliberately loads no CDN scripts.
- Locomotion: teleport arc + snap-turn is the safe default for Quest and avoids motion sickness.
- "Confined to the room" needs a real bounds check — a floor/collision volume or a clamp on the
  XR rig position. The gallery already has `NAV_*` empties and the theatre has 10 more, which can
  seed teleport anchors instead of inventing new ones.
- The exit menu must be a **world-space** panel in XR (DOM overlays do not render inside an
  immersive session), so Phase 3's menu needs an in-scene equivalent.
- Test target is the Quest browser specifically; the MCP preview browser cannot enter an immersive
  session, so this phase needs on-device testing by the user.

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
