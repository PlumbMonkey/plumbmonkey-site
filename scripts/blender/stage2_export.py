"""Stage 2 — nav anchors, cleanup, and the Draco glTF export.

Reads foyer_stage1.blend (baked materials) and writes foyer-web.glb.

Three things happen here:

  * Every portal gets a NAV_ empty carrying the site route it leads to as a
    custom property. Empties export as transform-only nodes, so the viewer
    raycasts cheap invisible targets instead of the arch geometry — the same
    pattern the Gallery already uses.

  * Objects the author disabled for render are deleted rather than exported.
    Door_Hallway is the notable one: hide_render is True on it deliberately.

  * Lights are dropped. The scene uses 25, two of them area lights that glTF
    cannot represent at all, and 23 dynamic point lights would be a heavy
    shader compile on mobile. The viewer hand-rigs about seven instead. This
    is safe here specifically because the mood-carrying surfaces — portal
    arches, candle flames, the moonlit backdrop — were baked to emissive
    textures in stage 1 and glow with no lights present at all.
"""
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
scene = bpy.data.scenes["Foyer"]
bpy.context.window.scene = scene

log = []
def say(m):
    log.append(m)
    print("[stage2] " + m, flush=True)


# --------------------------------------------------------------- nav anchors
# Portal number -> (site route, label, whether it is actually built yet).
# The labels mirror the PlateText already modelled on each arch.
#
# P06 and P09 lead to the 3D rooms, not to the 2D tools they used to open.
# Walking through an arch should put you in a room, the way P05 does for the
# Arcade — and both rooms carry the tool on the other side: the Luminarium's
# console screens open /visual/index.html, the Art Room's easel opens
# /natural-media-lab, and each viewer has a standing link besides. The nav in
# public/shared/rooms.js still points straight at the tools for anyone who
# wants them directly, so nothing became unreachable.
PORTALS = {
    "P01": ("/music",            "The Music Sandbox", True),
    "P02": ("/screening-room",   "The Theatre",       True),
    "P03": ("",                  "Coming Soon",       False),
    "P04": ("/gallery",          "The Gallery",       True),
    "P05": ("/arcade",           "The Arcade",        True),
    "P06": ("/luminarium/viewer.html", "The Luminarium", True),
    "P07": ("/workshop",         "The Workshop",      True),
    "P08": ("",                  "The Library",       False),
    "P09": ("/artroom/viewer.html", "The Art Room",   True),
    "P10": ("",                  "The Science Lab",   False),
}

nav_coll = bpy.data.collections.new("FOY_Nav")
scene.collection.children.link(nav_coll)

made = 0
for key, (href, label, live) in PORTALS.items():
    room = scene.objects.get(f"PRT_{key}_Room")
    if not room:
        say(f"no PRT_{key}_Room, skipped")
        continue
    e = bpy.data.objects.new(f"NAV_{key}", None)
    e.empty_display_type = 'SPHERE'
    e.empty_display_size = 0.6
    # Sit the anchor at the arch's centre, nudged into the room so the empty is
    # never buried inside the wall it is mounted on.
    e.matrix_world.translation = room.matrix_world.translation.copy()
    e.location.z += room.dimensions.z * 0.5
    e["href"] = href
    e["label"] = label
    e["live"] = bool(live)
    nav_coll.objects.link(e)
    made += 1
say(f"created {made} NAV_ anchors")

# Where the visitor stands when the entry cinematic hands over. Matching this
# to the camera the stinger's last frame is rendered from is what makes the
# video-to-3D handover read as one continuous move rather than a cut.
hero = scene.objects.get("FoyerHeroCam")
if hero:
    arrival = hero.copy()
    arrival.data = hero.data.copy()
    arrival.name = "CAM_Arrival"
    nav_coll.objects.link(arrival)
    say(f"CAM_Arrival at {[round(v, 2) for v in arrival.matrix_world.translation]} "
        f"lens {arrival.data.lens}mm")


# ------------------------------------------------------------------- cleanup
# Only the lights are actually deleted. Everything the author hid from render —
# the 10 portal cutter boxes and the hall glow card — is left in place and
# filtered out by use_renderable at export instead.
#
# Deleting them here was wrong and silently broke every portal: all 10 cutters
# are boolean operands on the walls, wainscoting and rails, and export_apply
# evaluates those modifiers at export time. With the operands gone the booleans
# became no-ops, no arch openings were cut, and solid wall covered all ten
# glowing arches — which rendered as black holes rather than as an error.
operands = {m.object.name for o in scene.objects for m in o.modifiers
            if getattr(m, "object", None) is not None}
say(f"{len(operands)} objects are modifier operands and must survive to export: "
    f"{', '.join(sorted(operands))}")

removed_lights = []
for o in list(scene.objects):
    if o.type == 'LIGHT':
        removed_lights.append(o.name)
        bpy.data.objects.remove(o, do_unlink=True)
say(f"removed {len(removed_lights)} lights")

hidden = [o.name for o in scene.objects if o.hide_render]
say(f"{len(hidden)} render-hidden objects stay in the file but out of the export: "
    f"{', '.join(hidden)}")


# -------------------------------------------------------------------- export
out = os.path.join(HERE, "foyer-web.glb")
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    # Filter by RENDER visibility, not viewport: the cutters must reach the
    # modifier evaluation and must not reach the output.
    use_visible=False,
    use_renderable=True,
    export_apply=True,           # bake modifiers (booleans, arrays, text->mesh)
    export_cameras=True,
    export_lights=False,
    export_extras=True,          # carries the href/label custom props through
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_image_format='JPEG',
    export_jpeg_quality=82,
    export_animations=False,
)
say(f"exported {out} — {os.path.getsize(out) / 1e6:.2f} MB")

tris = 0
for o in scene.objects:
    if o.type in ('MESH', 'FONT', 'CURVE'):
        try:
            ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
            m = ev.to_mesh()
            if m:
                m.calc_loop_triangles()
                tris += len(m.loop_triangles)
                ev.to_mesh_clear()
        except Exception:
            pass
say(f"exported scene is ~{tris} triangles across {len(scene.objects)} objects")
