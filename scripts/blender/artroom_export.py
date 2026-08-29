"""Web export for the Spectral Art Room — writes public/artroom/artroom-web.glb.

Run headlessly against the authoring file, which it never modifies:

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background \
    --factory-startup "D:/Blender Data/Blender Projects/Blender Projects/Spectral Art Room.blend" \
    --python scripts/blender/artroom_export.py

`--factory-startup` is required on this PC (see scripts/blender/README.md).

Sibling of luminarium_export.py, and the notes there apply here too: the single
scene is still called "Scene" so it is taken from the window rather than named,
and the textures are re-encoded as WEBP rather than kept as PNG.

The mix is different, though. This room's eleven textures are not all soft: the
pinned elevations and the swatch board are drawn with array slicing and are all
hard 1px lines, which is exactly what lossy compression smears. They are small
(768px and under) and stay at authoring size — only the 1024px floor planks are
downscaled. At q90 the whole set is still a rounding error next to the geometry.
"""
import bpy, os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

MAX_TEX = 768          # longest edge after downscale
WEBP_QUALITY = 90      # higher than the Luminarium: this set has line work


def say(m):
    print("[artroom] " + m, flush=True)


scene = bpy.context.window.scene if bpy.context.window else bpy.data.scenes[0]
say(f"scene: {scene.name}")

# ------------------------------------------------------------------- targets
# slug -> (route, label, the meshes that should carry it)
# The three things a painter would actually reach for. Routes are checked
# against the working tree below, so a rename on the site fails the export
# rather than shipping a dead hotspot.
TARGETS = {
    "Paint":     ("/natural-media-lab", "Natural Media Lab — paint in the browser",
                  ["ART_Canvas", "ART_CanvasFrame"]),
    "Portfolio": ("/portfolio", "Portfolio",
                  ["ART_DeskLightBox", "ART_DeskSheet"]),
    "Gallery":   ("/gallery", "The Gallery",
                  ["ART_WallArt"]),
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
        print("[artroom] PROBLEM: " + p, flush=True)
    sys.exit("artroom export aborted: " + "; ".join(problems))

say(f"tagged {tagged} targets with their routes")

# ------------------------------------------------------------------- cleanup
removed = [o.name for o in list(scene.objects) if o.type == 'LIGHT']
for name in removed:
    bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
say(f"removed {len(removed)} lights (7 of them AREA, which glTF cannot carry); "
    "the room is lit by emissive material and is rebuilt in the viewer")

scaled = []
for img in bpy.data.images:
    if img.type != 'IMAGE':
        continue
    # Reading .size is what forces a file-backed image to load. Testing
    # img.has_data first reads False for every one of them in --background and
    # silently skips the whole loop.
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
out = os.path.join(REPO, "public", "artroom", "artroom-web.glb")
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
