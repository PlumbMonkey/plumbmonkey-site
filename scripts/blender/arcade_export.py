"""Web export for the Spectral Arcade — writes public/arcade/arcade-web.glb.

Run headlessly against the authoring file, which it never modifies:

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background \
    --factory-startup "D:/Blender Data/Blender Projects/Blender Projects/Spectral Arcade.blend" \
    --python scripts/blender/arcade_export.py

`--factory-startup` is required on this PC (see scripts/blender/README.md).

This is the foyer's stage2 pattern with one simplification: the arcade needs no
bake stage. The foyer had to bake its arches and candles to emissive textures
because its mood came from 23 point lights that could not ship; the arcade's
mood comes from screens, marquees and neon that are already emissive materials,
so dropping the lights costs it nothing and the viewer hand-rigs a small rig for
the walls and carpet.

Three things happen here:

  * Each CAB_<slug> empty gets the site route for its game as a custom property.
    Empties export as transform-only nodes, so the viewer walks up from whatever
    mesh the ray hit to the cabinet's own node and reads the route off it —
    cheaper and far more robust than matching mesh names, since one cabinet is
    seven meshes (body, bezel, screen, marquee, button row, side art).

  * Lights are dropped. 35 of them, four AREA lights that glTF cannot represent
    at all, and 31 dynamic points would be a brutal shader compile on a phone.

  * FONT objects (the 16 marquee and signage texts) survive as geometry via
    export_apply, which evaluates modifiers and converts text to mesh. Without
    it they vanish silently and every marquee ships blank.
"""
import bpy, os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

log = []
def say(m):
    log.append(m)
    print("[arcade] " + m, flush=True)

scene = bpy.data.scenes["Arcade"]
bpy.context.window.scene = scene

# --------------------------------------------------------------- game routes
# The manifest names cabinets in PascalCase; the site's games live under their
# own kebab-case slugs. Most convert mechanically but two do NOT — Luno's Flight
# is served from "spectral-skyline" and House of the Hooded from the shortened
# "spectral-manor-hooded" — so the mapping is written out in full rather than
# derived. A missing or renamed game fails the export loudly below rather than
# shipping a cabinet that quietly goes nowhere.
GAMES = {
    "AmpRampage":       ("spectral-manor-amp-rampage",       "Amp Rampage"),
    "BeamMeUp":         ("spectral-manor-beam-me-up",        "Beam Me Up: Live!"),
    "Cruise":           ("spectral-manor-cruise",            "Cruise"),
    "CrystalDimension": ("spectral-manor-crystal-dimension", "Crystal Dimension"),
    "GraveyardShift":   ("spectral-manor-graveyard-shift",   "Graveyard Shift"),
    "HouseOfTheHooded": ("spectral-manor-hooded",            "House of the Hooded"),
    "Infestation":      ("spectral-manor-infestation",       "Infestation"),
    "LunosFlight":      ("spectral-skyline",                 "Luno's Flight"),
    "MessHall":         ("spectral-manor-mess-hall",         "Mess Hall"),
    "Revenger":         ("spectral-manor-revenger",          "Revenger"),
    "SoulCircuit":      ("spectral-manor-soul-circuit",      "Soul Circuit"),
    "Swarm":            ("spectral-manor-swarm",             "Swarm"),
}

problems = []
tagged = 0
for slug, (game, label) in GAMES.items():
    cab = scene.objects.get(f"CAB_{slug}")
    if cab is None:
        problems.append(f"no CAB_{slug} in the scene")
        continue
    # Verified against the working tree, not assumed: an export that ships a
    # dead route is worse than one that refuses to run.
    page = os.path.join(REPO, "public", "arcade", "games", game, "index.html")
    if not os.path.exists(page):
        problems.append(f"CAB_{slug} -> /arcade/games/{game}/ but {page} does not exist")
        continue
    cab["href"] = f"/arcade/games/{game}/index.html"
    cab["label"] = label
    cab["slug"] = slug
    cab["live"] = True
    tagged += 1

missing = [o.name for o in scene.objects
           if o.name.startswith("CAB_") and o.name[4:] not in GAMES]
if missing:
    problems.append(f"cabinets in the scene with no game mapped: {', '.join(missing)}")

if problems:
    for p in problems:
        print("[arcade] PROBLEM: " + p, flush=True)
    sys.exit("arcade export aborted: " + "; ".join(problems))

say(f"tagged {tagged} cabinets with their game routes")

# ------------------------------------------------------------------- cleanup
removed = []
for o in list(scene.objects):
    if o.type == 'LIGHT':
        removed.append(o.name)
        bpy.data.objects.remove(o, do_unlink=True)
say(f"removed {len(removed)} lights (4 of them AREA, which glTF cannot carry)")

hidden = [o.name for o in scene.objects if o.hide_render]
if hidden:
    say(f"{len(hidden)} render-hidden objects stay out of the export: {', '.join(hidden)}")

# -------------------------------------------------------------------- export
out = os.path.join(REPO, "public", "arcade", "arcade-web.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    use_visible=False,
    use_renderable=True,
    export_apply=True,           # bakes modifiers AND converts the 16 texts to mesh
    export_cameras=True,
    export_lights=False,
    export_extras=True,          # carries href/label/slug through to the viewer
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    # AUTO, not JPEG: the screens are 256x192 pixel art and the marquees are
    # hard-edged type. At this size the whole texture set is a rounding error
    # either way, so there is nothing to buy by smearing them through JPEG.
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
    "cabinets": tagged,
    "lightsRemoved": len(removed),
}), flush=True)
