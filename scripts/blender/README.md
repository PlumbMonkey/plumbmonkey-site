# The Foyer — Blender build pipeline

How `public/foyer/foyer-web.glb` and `public/assets/manor-entry.*` are produced.
Nothing here runs at build time; re-run it only when the Blender scene changes.

**Source:** `D:\Blender Projects\VictorianHouse\VictorianHousev6 foyer portals.blend`
— the `Foyer` scene (the hub) and `HauntedNight` (the exterior).

Always run these against a **copy** of the .blend. Stage 1 rewrites materials and
stage 2 deletes every light; neither is something you want landing in the master
file. None of the scripts save over their input.

```bash
cp "<master>.blend" foyer_src.blend
blender -b --factory-startup foyer_src.blend --python stage1_bake.py
blender -b --factory-startup foyer_stage1.blend --python stage2_export.py
blender -b --factory-startup foyer_src.blend --python stinger.py -- --final
```

## stage1_bake.py → `foyer_stage1.blend` + `tex/`

glTF carries image textures and a Principled BSDF, nothing else, and the foyer's
character lives in ~18 procedural node materials. Two tiers:

- **Flattened** — `FOY_WoodDark` (108 objects) and `FOY_WoodRail` (124). Muntins,
  balusters and rails a few centimetres wide, whose wave-texture grain is
  sub-pixel on the web. They become the ColorRamp's midpoint colour. 232 objects
  handled with no UVs and no textures.
- **Baked** — the ~26 that read clearly: floor, rug, the 11 wallpapered walls,
  the moonlit backdrop, and the 10 portal arches. Smart-UV-projected, then baked
  DIFFUSE/COLOR (albedo, no lighting) or EMIT for the glowing surfaces.

Resolution comes from each object's real size at ~110 px/m, so a 9 m wall and a
1 m sill land at the same texel density. Portals get a 512 floor — at 256 their
inner gradient banded.

`Door_Hallway` fails to unwrap because the author hid it from render. That is
correct: it is excluded from the export anyway.

## stage2_export.py → `foyer-web.glb`

Adds a `NAV_P01..P10` empty per portal carrying `href` / `label` / `live` as
glTF `extras`, and `CAM_Arrival` (a copy of `FoyerHeroCam`) — the camera the
entry cinematic ends on and the web viewer opens on. Drops all 25 lights; the
viewer hand-rigs about seven, which is only safe because stage 1 baked the
mood-carrying surfaces to emissive textures.

**Do not delete the portal cutter boxes before exporting.** All ten are boolean
operands on the walls, wainscoting and rails, and `export_apply` evaluates those
modifiers at export time. Removing them first turns the booleans into no-ops, so
no arch openings are cut and solid wall covers all ten portals — which renders as
black holes rather than as any kind of error. They are filtered out of the output
by `use_renderable=True` instead.

`scripts/check-room-lists.mjs` reads the `NAV_` extras back out of the .glb and
asserts the live portals match `public/shared/rooms.js`, so adding a room without
re-exporting the foyer fails `npm test`.

## foyer_retarget.py → patches `foyer-web.glb` in place

**Plain Python, not a Blender script.** Run `python scripts/blender/foyer_retarget.py`
to push the `PORTALS` table above into the shipped .glb, or `--check` to report
drift without writing.

A portal's destination is only an `extras` string on a transform-only empty, so
changing one touches no geometry, material or texture. But stage 2 reads
`foyer_stage1.blend`, a build intermediate that was not kept — re-exporting for
the sake of two strings would mean re-running `stage1_bake.py` and re-baking
about eighteen procedural materials, which is slow and risks the foyer coming
back subtly different.

So this rewrites the JSON chunk and leaves the BIN chunk byte-identical. It
reads its truth from `PORTALS`, so the script and the asset cannot drift: edit
the table, run it, and a future full re-export produces the same result.
`--check` is the guard that proves that, and is what to run if the foyer's
arches ever look out of date.

Portals P06 and P09 lead to the **3D rooms** (`/luminarium/viewer.html`,
`/artroom/viewer.html`) rather than to the 2D tools they used to open — you walk
into a room, and the room hands you the tool. `rooms.js` records that with an
optional `room3d` field, and `check-room-lists.mjs` accepts an arch pointing at
either a room's `href` or its `room3d` while still failing if a room has no arch
at all.

## The entry cinematic

Three shots, rendered separately and joined in ffmpeg. 4.625 s total at 24 fps.

| Shot | Frames | Time | Source | What happens |
|---|---|---|---|---|
| A1 | 1-36 | 0.000-1.458 | `hero video.blend` | 2D figure glitches, then snaps closer |
| A2 | 37-60 | 1.500-2.458 | `phantom_cloaked_v2.blend` | cut to the 3D phantom, head and shoulders |
| B | 1-48 | 2.500-4.625 | `VictorianHousev6` Foyer scene | doors open, push through to the foyer |

**Shot A1 — `shotA1.py`, run against `hero video.blend`.**
This is the actual hero-video project: four painted layers as billboards, one
camera, a volumetric fog sim. Building the stinger *here* is the whole point —
it cannot drift from the loop because it is the loop's scene. An earlier version
rendered the exterior from the 3D `HauntedNight` scene and never matched.

The beat-2 jump moves the figure **along the camera ray**, not along an axis, so
it grows without sliding across frame — it arrives closer in the same place,
which reads as a teleport rather than a walk. The fog blocker and vortex move
with it or the fog hole stays where the figure was.

**Shot A2 — `shotA2.py`, run against `phantom_cloaked_v2.blend`.**
Sweeps camera positions raycasting to both eyes and picks the nearest clear one
to the framing set by hand; the hood's inner edge crosses the sight line at
close range and occludes one eye.

**Shot B — `stinger.py` (`build_shot_b` only).** The rest of that script built
the superseded 3D exterior.

### Lightning

Real, in the render — not the white overlay the page used to rely on. The hero
layers are lit by a sun and the world, so a flash is an animated spike on both,
and unlike an overlay it lights the house, the fog, the treeline and the figure
together.

The profile is deliberately not a ramp: `[7.0, 4.0, 8.5, 5.0, 2.6, 1.6, 1.15]`
over consecutive frames. Real strikes flicker — hard leading edge, dip, brighter
second stroke, fast fall — and that shape is most of what separates lightning
from someone switching a lamp on.

On the phantom the strike comes from **behind**, not the front. A frontal flash
floodlit the face and destroyed the void the character depends on; from behind
it rims the hood and shoulders and leaves the face unlit. It also matches the
storm's position, since the house is behind him. Keep the world lift small
(0.30x) — ambient is flat light, and at 1.6x it floodlit the face anyway and
undid the point of striking from behind.

## looprender.py

Re-renders the 10 s hero loop (240 frames) from the same scene as shot A1, so
the loop and the film share a camera and the cut between them matches frame for
frame. The published loop before this was a wide shot and the stinger was tight;
cutting between them read as a jump to a different scene.

Wraps seamlessly — frame 240 against frame 1 is 0.11/255.

## unbake_checker.py

The mansion and forest layers lost their alpha at some point and were flattened
onto a transparency checkerboard. Those materials wire `Image.Alpha` into the
shader, so the project renders checkerboards without this. See the file header
for the matte maths; the short version is that coverage for dark art on a white
background *is* the darkening, `a = 1 - C/B`, and it must be applied only to the
antialiased rim or grey areas of the artwork go see-through.

### Encoding

Shot B dissolves into `public/foyer/arrival-frame.jpg` over its last 0.35 s.
That still is captured from the **running three.js viewer**, not from Blender.

The two must match in level as well as framing. They already matched
geometrically — a 50/50 blend is sharp, no ghosting — but Blender's frame was
mean RGB (47, 36, 32) against the viewer's (31, 20, 17), because Blender has
global illumination lifting the shadows and the viewer does not. Across the
dissolve that reads as the picture jumping. The viewer is therefore graded to
the film in `viewer.html` (exposure 1.75, lights x1.38, red x0.78, fitted on
per-channel means). Re-check the handover if you touch any of those.

```bash
ffmpeg -framerate 24 -i shotA/f_%04d.png -vf format=yuv420p,setsar=1 -crf 16 segA.mp4
ffmpeg -framerate 24 -i shotB/f_%04d.png -loop 1 -t 0.45 -i arrival-frame.jpg \
  -filter_complex "[0:v]format=yuv420p,setsar=1,fps=24[b];[1:v]scale=1920:1080,format=yuv420p,setsar=1,fps=24[s];[b][s]xfade=transition=fade:duration=0.35:offset=1.65[v]" \
  -map "[v]" -crf 16 segB.mp4
printf "file 'segA.mp4'\nfile 'segB.mp4'\n" > concat.txt
ffmpeg -f concat -safe 0 -i concat.txt -c copy master.mp4
```

Then transcode to `public/assets/manor-entry.mp4` (h264 crf 23, `+faststart`) and
`.webm` (vp9 crf 34). If the duration changes, update `FILM_MS` in
`app/components/ManorEntry.tsx` — it is measured off the encode, not assumed.

### Sound

Built from the single source clap at `public/assets/audio/thunderclap.wav`,
whose transient is at **2.15 s** (found by scanning peak level in 10 ms windows;
the file is 13.5 s of 96 kHz/24-bit and mostly quiet rumble either side).

The mix is not that clap repeated four times. It is five layers cut to the
picture: three cracks that **escalate** onto the flash marks as the figure gets
closer (−8.6, −3.6, −1.5 dB peak), a low bed under the opening, and a lowpassed
rumble that fades in at the 2.5 s door cut and decays to near-silence — so the
storm goes muffled the moment we are inside, and the foyer arrives quiet.

Two traps worth knowing:

- **`alimiter` auto-levels by default.** Its `level` option defaults to enabled,
  which gains the output back up to the ceiling — every attempt at transient
  shaping flattened the whole mix to 0 dB until `level=0` was set.
- **Don't reach for `loudnorm` here.** The mix has a ~28 dB crest, so dynamic
  mode crushes the loudness range to 0.8 LU and the payoff crack ends up level
  with the first one, destroying the escalation. Linear mode true-peak limits
  and does the same thing more subtly. The mix is left at about −25 LUFS with
  peaks at −1.5 dBFS: quiet by web-video convention, but the transients are at
  the ceiling and the dynamics are the whole point.

```bash
ffmpeg -i ../../public/assets/audio/thunderclap.wav -filter_complex "
[0:a]asplit=5[a1][a2][a3][a4][a5];
[a1]atrim=2.15:2.62,asetpts=PTS-STARTPTS,highpass=f=170,volume=-12dB,afade=t=out:st=0.32:d=0.15[s1];
[a2]atrim=2.15:2.52,asetpts=PTS-STARTPTS,asetrate=107520,aresample=48000,highpass=f=240,volume=-7dB,afade=t=out:st=0.20:d=0.13,adelay=583|583[s2];
[a3]atrim=2.15:5.90,asetpts=PTS-STARTPTS,asetrate=84480,aresample=48000,volume=-1dB,adelay=1125|1125[s3];
[a4]atrim=0.55:3.05,asetpts=PTS-STARTPTS,aresample=48000,lowpass=f=700,volume=-11dB,afade=t=in:st=0:d=0.5[bed];
[a5]atrim=3.60:8.00,asetpts=PTS-STARTPTS,aresample=48000,lowpass=f=300,volume=-5dB,adelay=2500|2500,afade=t=in:st=2.50:d=0.18,afade=t=out:st=3.85:d=0.775[inside];
[s1][s2][s3][bed]amix=inputs=4:normalize=0:duration=longest[dry];
[dry]afade=t=out:st=2.42:d=0.34[outside];
[outside][inside]amix=inputs=2:normalize=0:duration=longest,atrim=0:4.625,asetpts=PTS-STARTPTS,
alimiter=level=0:limit=0.55:attack=2:release=150,volume=5dB,
alimiter=level=0:limit=0.84:attack=4:release=60,aresample=48000[mix]
" -map "[mix]" -c:a pcm_s16le -ar 48000 -ac 2 mix_final.wav
```

`asetrate=107520` is 96000 × 1.12 (the second crack pitched up, nearer and
sharper); `84480` is 96000 × 0.88 (the payoff pitched down for weight, which
lengthens its tail usefully). Both need the `aresample` that follows.

Muxed in with `-c:v copy`, AAC 128k for mp4 and Opus 96k for webm.

**The source WAV is 7.7 MB and ships in the static export**, since Next copies
all of `public/`. Nothing references it — the mix is baked into the video. Move
it out of `public/` if that matters for the deploy.

## Known scene quirks (not export bugs)

- **`PRT_P07_Room` shows through the tall left window.** The Workshop portal's
  recess box protrudes past the exterior wall, so its green glow is visible
  through the glass. Present in Blender's own render too. Fix in the scene by
  pulling the recess inward or extending `Foy_Wall_Left_B`.
- **No preset camera sees `PRT_P02_Room` (The Theatre).** It is on the wall the
  visitor enters through; reachable by orbiting, but a camera facing the front
  wall would help.
- **EEVEE reports "Shadow buffer full" on the Foyer** at 25 lights. Pre-existing;
  affects some shadows in Blender renders only, not the export.
