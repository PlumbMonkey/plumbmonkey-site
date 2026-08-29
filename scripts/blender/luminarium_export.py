"""Web export for the Spectral Luminarium — writes public/luminarium/luminarium-web.glb.

Run headlessly against the authoring file, which it never modifies:

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background \
    --factory-startup "D:/Blender Data/Blender Projects/Blender Projects/Spectral Luminarium.blend" \
    --python scripts/blender/luminarium_export.py

`--factory-startup` is required on this PC (see scripts/blender/README.md).

Same shape as music_export.py, with two differences.

The authoring file has a single scene still called "Scene", so this takes the
window's scene rather than naming one. Nothing here depends on the name, and
looking it up by name would only add a way to break when the file is re-saved.

Textures are the whole payload. The room's look is five baked nebula PNGs, four
of them 1024x2048, and at authoring size the GLB lands at 7.0 MB — larger than
any room the site currently ships (the Gallery, at 4.2 MB, is the ceiling).

So this departs from the arcade's and the music room's `AUTO`. Those keep PNG
because their textures are painted UI: hard edges and small type, where lossy
ringing shows. These are soft nebula clouds with neither, which is the best case
for lossy compression — halving the longest edge and re-encoding as WEBP takes
the file from 5.8 MB to 0.36 MB with nothing visible lost. The vendored
GLTFLoader handles `EXT_texture_webp` (public/gallery/vendor).

Both the downscale and the pack happen on the in-memory copy: the PNGs on disk
are untouched and the .blend is never saved.
"""
import bpy, os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

MAX_TEX = 1024         # longest edge after downscale
WEBP_QUALITY = 85


def say(m):
    print("[luminarium] " + m, flush=True)


scene = bpy.context.window.scene if bpy.context.window else bpy.data.scenes[0]
say(f"scene: {scene.name}")

# ------------------------------------------------------------------- targets
# slug -> (route, label, the meshes that should carry it)
# The console is the room's instrument: its three upright screens and the three
# desk pads under them are the only things a visitor can click. Routes are
# checked against the working tree below, so a rename on the site fails the
# export rather than shipping a dead hotspot.
TARGETS = {
    "Visual": ("/visual/index.html", "Luminarium — live visuals",
               ["LUM_Screen_C", "LUM_Deskpad_C"]),
    "Music":  ("/music", "Music Sandbox",
               ["LUM_Screen_L", "LUM_Deskpad_L"]),
    "Studio": ("/music/studio", "The Studio",
               ["LUM_Screen_R", "LUM_Deskpad_R"]),
}

problems = []
tagged = 0
for slug, (route, label, meshes) in TARGETS.items():
    # Verified against the working tree, not assumed. A route that 404s is
    # worse than an export that refuses to run.
    page = route.split("#")[0].strip("/")
    if page.endswith(".html"):
        disk = os.path.join(REPO, "public", *page.split("/"))
    else:
        # a Next route: it has no file in public/, so check for the app dir
        disk = os.path.join(REPO, "app", *page.split("/"), "page.tsx")
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

if problems:
    for p in problems:
        print("[luminarium] PROBLEM: " + p, flush=True)
    sys.exit("luminarium export aborted: " + "; ".join(problems))

say(f"tagged {tagged} targets with their routes")

# ------------------------------------------------------------------- cleanup
removed = [o.name for o in list(scene.objects) if o.type == 'LIGHT']
for name in removed:
    bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
say(f"removed {len(removed)} lights (13 of them AREA, which glTF cannot carry); "
    "the room is lit by emissive material and is rebuilt in the viewer")

scaled = []
for img in bpy.data.images:
    if img.type != 'IMAGE':
        continue
    # Reading .size is what forces a file-backed image to load. Testing
    # img.has_data first reads False for every one of them in --background and
    # silently skips the whole loop, which is how this shipped at 5.8 MB once.
    w, h = img.size
    if not w or not h or max(w, h) <= MAX_TEX:
        continue
    f = MAX_TEX / max(w, h)
    img.scale(max(int(w * f), 1), max(int(h * f), 1))
    img.pack()          # so the exporter takes the resized buffer, not the file
    scaled.append(f"{img.name} {w}x{h}->{img.size[0]}x{img.size[1]}")
for s in scaled:
    say("downscaled " + s)

# -------------------------------------------------------------------- export
out = os.path.join(REPO, "public", "luminarium", "luminarium-web.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    use_visible=False,
    use_renderable=True,
    export_apply=True,
    export_cameras=True,
    export_lights=False,
    export_extras=True,          # carries href/label/slug through to the viewer
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_image_format='WEBP',
    export_image_quality=WEBP_QUALITY,
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
    "texturesScaled": len(scaled),
}), flush=True)
