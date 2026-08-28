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

## stinger.py → `shotA/`, `shotB/`

The 4.6 s entry cinematic, in two shots:

- **A** (`HauntedNight`, 60 frames) — the cloaked figure snaps closer in three
  hard steps while the camera drifts. Placed in *camera space*, not along the
  view axis: this camera is pitched down, so stepping the figure along the axis
  lifted it off the ground and out of frame.
- **B** (`Foyer`, 48 frames) — the front doors swing open toward camera and it
  pushes through, landing exactly on `FoyerHeroCam`.

The scene's `Figure` uses `GhostPale`, a bare Emission shader that renders a pale
apparition. The home page's hero loop shows a dark cloaked silhouette, so the
script re-shades a copy to match. The author's material is untouched.

Lightning is **not** rendered — it is a white CSS overlay in `ManorEntry.tsx`,
timed to `FIGURE_STEPS`. The page needs a flash anyway to hide the cut from the
looping hero video, and a flash over a hard jump is what sells the teleport.

### Encoding

Shot B dissolves into `public/foyer/arrival-frame.jpg` over its last 0.35 s.
That still is captured from the **running three.js viewer**, not from Blender:
Blender bounces light off the emissive arches and three.js does not, so a Blender
frame would visibly pop on handover. Ending on the viewer's own output makes the
film, the loader still and the first live frame the same picture.

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
