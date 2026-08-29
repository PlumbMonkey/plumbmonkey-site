"""Web export for the Spectral Music Room — writes public/music/music-web.glb.

Run headlessly against the authoring file, which it never modifies:

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background \
    --factory-startup "D:/Blender Data/Blender Projects/Blender Projects/Spectral Music Room.blend" \
    --python scripts/blender/music_export.py

`--factory-startup` is required on this PC (see scripts/blender/README.md).

The arcade's export with one difference in how targets are marked.

There, a cabinet was a parent empty with its parts beneath it, so tagging the
parent and walking up from the ray hit covered all thirteen meshes. Here the
room authors `HOT_<slug>` empties that sit exactly on their `SCR_<slug>` screen
but are NOT its parent — they are markers, the way the foyer's NAV_ empties are.
Rather than ship both and make the viewer pair them up by position, this writes
the route straight onto the meshes a visitor can actually click. The viewer then
reads `href` off whatever the ray hit and needs no lookup at all.

Screens are the right granularity, not consoles: each console carries TWO apps
(the drum station opens DM-1 and DM-2), so a console-sized target could not say
which one was meant.

Lights are dropped — 19 of them, five AREA lights glTF cannot represent. Safe
here for the same reason as the arcade: the room's mood is emissive material
rather than lamps. Thirty materials glow on their own, including the neon at
3.0-3.2, the drum pads at 2.4 and the candle flames at 16.
"""
import bpy, os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

def say(m):
    print("[music] " + m, flush=True)

scene = bpy.data.scenes["MusicRoom"]
bpy.context.window.scene = scene

# ------------------------------------------------------------------- targets
# slug -> (route, label, the meshes that should carry it)
# Taken from spectral_music_room_manifest.json, which the .blend writes itself.
# Export Song is the odd one out: it has no screen, so its plaque is the target.
# Every route names index.html rather than ending in a directory slash. The
# manifest writes the slash form, and it 404s under `next dev`, which serves
# public/ by exact path and does not resolve a directory to its index — the
# same trap already documented in app/music/InstrumentEmbed.tsx. GitHub Pages
# would have resolved it and hidden this until someone ran the site locally.
TARGETS = {
    "DM1":        ("/music/drum-machine/index.html", "DM-1 Rhythm Machine",         ["SCR_DM1"]),
    "DM2":        ("/music/stave/dm2/index.html",    "DM-2 Rhythm Machine",         ["SCR_DM2"]),
    "SY1":        ("/music/synth/index.html",        "SY-1 Synthesizer",            ["SCR_SY1"]),
    "SY2":        ("/music/stave/index.html",        "SY-2 Polyphonic Synthesizer", ["SCR_SY2"]),
    "SongView":   ("/music/song/index.html",         "Song View",                   ["SCR_SongView"]),
    "ExportSong": ("/music/song/index.html#export",  "Export Song",
                   ["EXP_Plaque", "EXP_Rim", "EXP_Text"]),
}

problems = []
tagged = 0
for slug, (route, label, meshes) in TARGETS.items():
    # Verified against the working tree, not assumed. A route that 404s is
    # worse than an export that refuses to run.
    page = route.split("#")[0].strip("/")
    disk = os.path.join(REPO, "public", *page.split("/"))
    if not page.endswith(".html"):
        disk = os.path.join(disk, "index.html")
    if not os.path.exists(disk):
        problems.append(f"{slug} -> {route} but {disk} does not exist")
        continue

    hit = 0
    for name in meshes:
        o = scene.objects.get(name)
        if o is None:
            problems.append(f"{slug}: no object named {name}")
            continue
        o["href"] = route
        o["label"] = label
        o["slug"] = slug
        o["live"] = True
        hit += 1
    if hit:
        tagged += 1

missing = [o.name for o in scene.objects
           if o.name.startswith("HOT_") and o.name[4:] not in TARGETS]
if missing:
    problems.append(f"hotspots in the scene with no route mapped: {', '.join(missing)}")

if problems:
    for p in problems:
        print("[music] PROBLEM: " + p, flush=True)
    sys.exit("music export aborted: " + "; ".join(problems))

say(f"tagged {tagged} targets with their routes")

# ------------------------------------------------------------------- cleanup
removed = []
for o in list(scene.objects):
    if o.type == 'LIGHT':
        removed.append(o.name)
        bpy.data.objects.remove(o, do_unlink=True)
say(f"removed {len(removed)} lights (5 of them AREA, which glTF cannot carry)")

hidden = [o.name for o in scene.objects if o.hide_render]
if hidden:
    say(f"{len(hidden)} render-hidden objects stay out of the export: {', '.join(hidden)}")

# -------------------------------------------------------------------- export
out = os.path.join(REPO, "public", "music", "music-web.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    use_visible=False,
    use_renderable=True,
    export_apply=True,           # bakes modifiers AND converts the 9 texts to mesh
    export_cameras=True,
    export_lights=False,
    export_extras=True,          # carries href/label/slug through to the viewer
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    # AUTO, like the arcade: the app screens are painted UI, all hard edges and
    # small type, and the whole texture set is a rounding error at this size.
    export_image_format='AUTO',
    export_animations=False,
)
say(f"exported {out} — {os.path.getsize(out) / 1e6:.2f} MB")

tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in scene.objects:
    if o.type in ('MESH', 'FONT', 'CURVE'):
        try:
            ev = o.evaluated_get(dg)
            m = ev.to_mesh()
            if m:
                m.calc_loop_triangles()
                tris += len(m.loop_triangles)
                ev.to_mesh_clear()
        except Exception:
            pass
say(f"exported scene is ~{tris} triangles across {len(scene.objects)} objects")

print("EXPORT_RESULT " + json.dumps({
    "glb": out,
    "bytes": os.path.getsize(out),
    "triangles": tris,
    "targets": tagged,
    "lightsRemoved": len(removed),
}), flush=True)
