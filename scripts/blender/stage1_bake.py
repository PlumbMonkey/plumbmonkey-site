"""Stage 1 — make the Foyer scene exportable to glTF.

glTF carries image textures and Principled BSDF, nothing else. The foyer's
character lives in ~18 procedural node materials (noise/voronoi/wave), which
would export as flat grey-brown. This bakes the ones that matter and flattens
the ones that don't.

Two tiers, because the cost/benefit is wildly different across the 258 objects
that carry a procedural:

  * FOY_WoodDark (108 objects) and FOY_WoodRail (124) are window muntins,
    balusters, corbels and rails — a few centimetres wide. Their wave-texture
    grain is sub-pixel on the web. They are flattened to the ramp's midpoint
    colour: 232 objects handled for free, no UVs, no textures.

  * The remaining ~26 objects are large and read clearly — floor, rug, the
    11 wallpapered walls, the moonlit backdrop seen through the window, the
    hall corridor glow and the 10 portal arches. Those get unwrapped and baked.

Writes foyer_stage1.blend next to this script.
"""
import bpy, os, math, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "tex")
os.makedirs(TEX, exist_ok=True)

log = []
def say(m):
    log.append(m)
    print("[stage1] " + m, flush=True)


# ---------------------------------------------------------------- scene setup
# Drop the four exterior season scenes; only the Foyer is being exported and
# they carry a thunderstorm rig, tree scatters and a 100+ object house each.
foyer = bpy.data.scenes["Foyer"]
bpy.context.window.scene = foyer
for s in list(bpy.data.scenes):
    if s is not foyer:
        bpy.data.scenes.remove(s)
say("kept Foyer scene, removed the season scenes")

view_layer = bpy.context.view_layer


def ramp_mid(mat):
    """Representative colour of a procedural: its ColorRamp at the midpoint.

    Every material flattened here drives a Principled base colour through a
    single ColorRamp, so the midpoint is the grain's average tone rather than
    either extreme.
    """
    for n in mat.node_tree.nodes:
        if n.type == 'VALTORGB':
            return tuple(n.color_ramp.evaluate(0.5))
    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    return tuple(bsdf.inputs["Base Color"].default_value) if bsdf else (0.5, 0.5, 0.5, 1.0)


# ------------------------------------------------------- tier 2: flatten trim
for name in ("FOY_WoodDark", "FOY_WoodRail"):
    mat = bpy.data.materials.get(name)
    if not mat:
        continue
    col = ramp_mid(mat)
    old = mat.node_tree
    src_bsdf = next((n for n in old.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    rough = float(src_bsdf.inputs["Roughness"].default_value) if src_bsdf else 0.5
    metal = float(src_bsdf.inputs["Metallic"].default_value) if src_bsdf else 0.0

    old.nodes.clear()
    bsdf = old.nodes.new("ShaderNodeBsdfPrincipled")
    out = old.nodes.new("ShaderNodeOutputMaterial")
    out.location = (300, 0)
    bsdf.inputs["Base Color"].default_value = col
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    old.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    say(f"flattened {name} -> rgb({col[0]:.3f}, {col[1]:.3f}, {col[2]:.3f})")


# --------------------------------------------------------------- bake targets
# (object, bake type). Emissive surfaces bake EMIT so the glow survives as an
# emissiveTexture; everything else bakes DIFFUSE/COLOR, i.e. albedo with no
# lighting baked in, which is what a PBR web material wants.
EMIT_OBJS = ["Foy_Backdrop", "Door_Hallway"] + [f"PRT_P{i:02d}_Room" for i in range(1, 11)]
DIFF_OBJS = ["Foy_Floor", "GLOW_HallFloor", "Rug"] + [
    o.name for o in foyer.objects
    if o.type == 'MESH' and o.data and any(
        m and m.name == "FOY_Wallpaper" for m in o.data.materials)
]

targets = [(n, 'EMIT') for n in EMIT_OBJS] + [(n, 'DIFFUSE') for n in DIFF_OBJS]
say(f"{len(targets)} objects to bake")


def texel_size(obj, px_per_m=110, lo=256, hi=1024):
    """Resolution from the object's real size, so a 9 m wall and a 1 m sill
    both land near the same texel density instead of one being mush."""
    d = sorted(obj.dimensions)[1:]           # ignore the thin axis
    span = max(max(d), 0.5)
    n = 2 ** round(math.log2(max(lo, min(hi, span * px_per_m))))
    return int(max(lo, min(hi, n)))


def unwrap(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    view_layer.objects.active = obj
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')


# Baking is Cycles-only; the scene authors in EEVEE.
foyer.render.engine = 'CYCLES'
foyer.cycles.device = 'CPU'
foyer.cycles.samples = 16
foyer.cycles.use_denoising = True
bake = foyer.render.bake
bake.use_selected_to_active = False
bake.margin = 8

done, failed = [], []
for obj_name, bake_type in targets:
    obj = foyer.objects.get(obj_name)
    if not obj or obj.type != 'MESH' or not obj.data.materials:
        failed.append((obj_name, "missing or has no material"))
        continue
    try:
        unwrap(obj)

        # The portal arches are the hero elements and the only thing a visitor
        # actually clicks, so they get a higher floor than their 2.8 m span
        # would otherwise earn — at 256 the inner gradient banded visibly.
        res = texel_size(obj, lo=512 if obj_name.startswith("PRT_") else 256)
        # One material copy per object: several objects share FOY_Wallpaper, and
        # rewiring the shared one would point them all at the first bake.
        mat = obj.data.materials[0].copy()
        mat.name = f"{obj.data.materials[0].name}_{obj_name}_web"
        obj.data.materials[0] = mat

        img = bpy.data.images.new(f"BK_{obj_name}", res, res, alpha=False)
        img.filepath_raw = os.path.join(TEX, f"BK_{obj_name}.png")
        img.file_format = 'PNG'

        tex_node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex_node.image = img
        tex_node.location = (-900, 400)
        tex_node.select = True
        mat.node_tree.nodes.active = tex_node

        if bake_type == 'DIFFUSE':
            bake.use_pass_direct = False
            bake.use_pass_indirect = False
            bake.use_pass_color = True
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8, use_clear=True)
        else:
            bpy.ops.object.bake(type='EMIT', margin=8, use_clear=True)

        img.save()

        # Rewire: the baked image is now the whole material. Carry the source
        # BSDF's roughness and metallic across rather than picking a house
        # value — the bake only replaces base colour, and substituting a
        # different roughness visibly changes how the sconces bounce off the
        # walls even though the albedo is identical.
        nt = mat.node_tree
        src = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        src_rough = float(src.inputs["Roughness"].default_value) if src else 0.62
        src_metal = float(src.inputs["Metallic"].default_value) if src else 0.0
        nt.nodes.clear()
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        t.location = (-400, 0)
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        out.location = (300, 0)
        if bake_type == 'EMIT':
            # Base colour stays black so the glow is not also lit as a surface.
            bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
            nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = 1.0
        else:
            nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
            bsdf.inputs["Roughness"].default_value = src_rough
            bsdf.inputs["Metallic"].default_value = src_metal
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

        done.append(f"{obj_name} @ {res}px {bake_type}")
        say(f"baked {obj_name} @ {res}px {bake_type}")
    except Exception as e:
        failed.append((obj_name, repr(e)))
        say(f"FAILED {obj_name}: {e!r}")

foyer.render.engine = 'BLENDER_EEVEE'

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "foyer_stage1.blend"))
say(f"saved foyer_stage1.blend — {len(done)} baked, {len(failed)} failed")
for n, e in failed:
    say(f"  failure: {n}: {e}")
