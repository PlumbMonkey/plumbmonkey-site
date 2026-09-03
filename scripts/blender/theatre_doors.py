"""Put exit doors in the back wall of the Spectral Grand Theatre.

    blender -b --factory-startup -P scripts/blender/theatre_doors.py

WHY THIS WORKS ON THE .GLB AND NOT ON A .BLEND

The theatre is the one room with no source blend on this machine. Its web build
came from a "Spectral Grand Theatre" file whose SGT_ naming appears in no .blend
here -- `D:\\Blender Projects\\Theatre\\Theatre.blend` is a DIFFERENT theatre
(TH_/GR_ naming, links Performance_Theatre.blend, carries the Green Room), and
the path in the notes no longer exists.

So this edits the shipped .glb directly: import it, add the doors, export it
back. That is not a workaround so much as the right move -- the committed .glb
is the *optimised* room. Commit 1045abd cut it 3.57 -> 1.59 MB by excluding the
moving-light morph targets (294 of its 296) and the dust-mote particle source,
and a round trip preserves all of that: 217 unique meshes, 165,853 tris, and
1.65 MB back out against 1.66 MB in.

Geometry notes, in Blender's Z-up (the glTF importer rotates Y-up on the way in,
so these are NOT the numbers a three.js inspector reports):

    Wall_AudBack     x +-17,  y -30.4 .. -30.0,  z 0 .. 20
    Auditorium_Floor rakes from z 0 at the stage to z 5.40 at the back wall
    SGT_Balcony_Deck z 10.6 .. 11.0  -- 5.2 m of headroom over the rear stalls

Materials are the room's own, so the doors match what is already there.
"""
import bpy, bmesh, math, os, sys

GLB_IN = r"D:\DEV Projects 2026 V2\projects\plumbmonkey-site\public\theatre\theatre-web.glb"
GLB_OUT = r"D:\DEV Projects 2026 V2\projects\plumbmonkey-site\public\theatre\theatre-web-v2.glb"

WALL_IN_Y = -30.00          # inner face of the back wall
WALL_OUT_Y = -30.40
FLOOR_Z = 5.40              # where the raked floor meets that wall
OPEN_W, OPEN_H = 2.30, 2.45
DOOR_X = (-6.20, 6.20)      # a pair of exits, clear of the centre aisle
PREFIX = "SGT_Exit"


def wipe():
    for o in [o for o in bpy.data.objects if o.name.startswith(PREFIX)]:
        bpy.data.objects.remove(o, do_unlink=True)


def box(name, size, loc, mat=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    if mat:
        me.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def emissive(name, colour, strength):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (colour[0] * 0.2, colour[1] * 0.2, colour[2] * 0.2, 1)
    b.inputs["Emission Color"].default_value = (colour[0], colour[1], colour[2], 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


def cut(target, cutter):
    m = target.modifiers.new("ExitCut", 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cutter
    m.solver = 'EXACT'
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(target.evaluated_get(dg))
    old = target.data
    target.data = me
    target.modifiers.remove(m)
    if old.users == 0:
        bpy.data.meshes.remove(old)


def build():
    wipe()
    M = bpy.data.materials
    walnut = M.get("SGT_DarkWalnut")
    brass = M.get("SGT_Brass")
    plaster = M.get("SGT_Plaster")
    sign = emissive("SGT_ExitSign", (0.16, 1.0, 0.35), 6.0)
    void = M.get("SGT_Void") or M.new("SGT_Void")
    void.use_nodes = True
    vb = void.node_tree.nodes.get("Principled BSDF")
    vb.inputs["Base Color"].default_value = (0.01, 0.01, 0.012, 1)
    vb.inputs["Roughness"].default_value = 0.95

    wall = bpy.data.objects["Wall_AudBack"]
    made = []

    for i, cx in enumerate(DOOR_X):
        zc = FLOOR_Z + OPEN_H * 0.5

        # 1. hole through the wall
        cutter = box("%s_CUT%d" % (PREFIX, i), (OPEN_W, 1.2, OPEN_H),
                     (cx, (WALL_IN_Y + WALL_OUT_Y) * 0.5, zc))
        cut(wall, cutter)
        bpy.data.objects.remove(cutter, do_unlink=True)

        # 2. a dark recess behind it, so the opening is not a hole in the set
        made.append(box("%s_Void%d" % (PREFIX, i), (OPEN_W + 0.5, 0.7, OPEN_H + 0.4),
                        (cx, WALL_OUT_Y - 0.33, zc), void))

        # 3. lining and a moulded architrave on the house side
        t = WALL_OUT_Y - WALL_IN_Y
        for sx in (-1, 1):
            made.append(box("%s_Jamb%d%s" % (PREFIX, i, "LR"[sx > 0]),
                            (0.06, abs(t), OPEN_H),
                            (cx + sx * (OPEN_W * 0.5 - 0.03),
                             (WALL_IN_Y + WALL_OUT_Y) * 0.5, zc), walnut))
        made.append(box("%s_Head%d" % (PREFIX, i), (OPEN_W, abs(t), 0.06),
                        (cx, (WALL_IN_Y + WALL_OUT_Y) * 0.5,
                         FLOOR_Z + OPEN_H - 0.03), walnut))
        aw = 0.17
        made.append(box("%s_ArcL%d" % (PREFIX, i), (aw, 0.07, OPEN_H + aw),
                        (cx - OPEN_W * 0.5 - aw * 0.5, WALL_IN_Y + 0.035,
                         FLOOR_Z + (OPEN_H + aw) * 0.5), walnut))
        made.append(box("%s_ArcR%d" % (PREFIX, i), (aw, 0.07, OPEN_H + aw),
                        (cx + OPEN_W * 0.5 + aw * 0.5, WALL_IN_Y + 0.035,
                         FLOOR_Z + (OPEN_H + aw) * 0.5), walnut))
        made.append(box("%s_ArcT%d" % (PREFIX, i), (OPEN_W + aw * 2, 0.07, aw),
                        (cx, WALL_IN_Y + 0.035, FLOOR_Z + OPEN_H + aw * 0.5), walnut))

        # 4. the leaves -- a pair per exit, shut, with brass push bars
        lw = OPEN_W * 0.5 - 0.03
        for sx in (-1, 1):
            lx = cx + sx * (lw * 0.5 + 0.015)
            made.append(box("%s_Leaf%d%s" % (PREFIX, i, "LR"[sx > 0]),
                            (lw, 0.055, OPEN_H - 0.06),
                            (lx, WALL_IN_Y - 0.06, FLOOR_Z + (OPEN_H - 0.06) * 0.5),
                            walnut))
            made.append(box("%s_Bar%d%s" % (PREFIX, i, "LR"[sx > 0]),
                            (lw * 0.72, 0.05, 0.075),
                            (lx, WALL_IN_Y - 0.11, FLOOR_Z + 1.05), brass))

        # 5. an illuminated EXIT box over the opening
        made.append(box("%s_Sign%d" % (PREFIX, i), (0.72, 0.10, 0.26),
                        (cx, WALL_IN_Y - 0.06, FLOOR_Z + OPEN_H + aw + 0.22), sign))
        made.append(box("%s_SignCase%d" % (PREFIX, i), (0.80, 0.13, 0.34),
                        (cx, WALL_IN_Y - 0.045, FLOOR_Z + OPEN_H + aw + 0.22), brass))

    return made


def export(path=GLB_OUT):
    """Drop the cameras the shipped build does not expose.

    The committed .glb puts five cameras in its scene graph -- the CAM_* set the
    viewer turns into viewpoint buttons.  Re-importing revives DR_Cam, LOB_Cam
    and PB_Cam (dressing room, lobby, projection booth), which are in the file
    but not in that graph, and exporting them back would silently grow the
    viewpoint bar from five buttons to eight.
    """
    for c in [o for o in bpy.data.objects
              if o.type == 'CAMERA' and not o.name.startswith("CAM_")]:
        bpy.data.objects.remove(c, do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=False,
                              export_draco_mesh_compression_enable=True,
                              export_cameras=True, export_lights=False,
                              export_apply=False)
    return path, os.path.getsize(path)


if __name__ == "__main__":
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=GLB_IN)
    made = build()
    sc = bpy.context.scene
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in sc.objects if o.type == 'MESH')
    p, n = export()
    print("### added=%d objects  scene_tris=%d  out=%s  bytes=%d  (in %d)"
          % (len(made), tris, os.path.basename(p), n, os.path.getsize(GLB_IN)))
