"""Shot A2 — beat 3, the phantom close-up. Frames 37-60 (1.500-2.458 s).

Solves the one-eye problem first. The hood's inner edge crosses the sight line
from the camera position that was set up by hand, so one eye is occluded; this
sweeps camera height and distance, raycasts to BOTH eyes, and picks the nearest
position to the original framing where neither is blocked.

Lit as the exterior is: a cold rim from behind, almost nothing from the front,
so the cloak goes to silhouette and the eyes are the only bright thing.
"""
import bpy, os, math, time
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
def say(m): print("[A2] " + m, flush=True)

scene = bpy.context.scene
eye = bpy.data.objects["CC_Base_Eye"]
dg = bpy.context.evaluated_depsgraph_get()
ev = eye.evaluated_get(dg); me = ev.to_mesh()
co = [eye.matrix_world @ v.co for v in me.vertices]
ev.to_mesh_clear()
def ctr(p):
    n = len(p) or 1
    return Vector((sum(q.x for q in p)/n, sum(q.y for q in p)/n, sum(q.z for q in p)/n))
EL, ER = ctr([c for c in co if c.x > 0]), ctr([c for c in co if c.x < 0])
say(f"eyes at L{[round(v,3) for v in EL]} R{[round(v,3) for v in ER]}")

def blocked(origin):
    out = []
    for t in (EL, ER):
        d = t - origin
        hit, loc, _, _, obj, _ = scene.ray_cast(dg, origin, d.normalized(), distance=d.length*0.98)
        out.append(obj.name if hit else None)
    return out

ORIG = Vector((-0.024, -0.743, 1.731))
best = None
for dz in (0.00, -0.02, -0.04, -0.06, -0.08, -0.10, -0.12, 0.02):
    for dy in (0.0, -0.06, -0.12, -0.20, -0.30):
        o = ORIG + Vector((0.0, dy, dz))
        b = blocked(o)
        if b == [None, None]:
            cost = abs(dz)*2.0 + abs(dy)
            if best is None or cost < best[0]:
                best = (cost, o, dz, dy)
if best is None:
    say("no clear camera found in sweep — falling back to a wider pull")
    CAM = ORIG + Vector((0.0, -0.45, -0.10))
else:
    _, CAM, dz, dy = best
    say(f"both eyes clear at dz={dz:+.2f} dy={dy:+.2f} -> {[round(v,3) for v in CAM]}")

cam = bpy.data.objects.get("PREVIEW_Cam")
scene.camera = cam
cam.data.lens = 85
TGT = Vector((0.0, 0.0, EL.z - 0.02))

# Slow push over the shot: the figure keeps closing even after it has arrived.
START = CAM
END = CAM + (TGT - CAM).normalized() * 0.075
cam.animation_data_clear()
for f, loc in ((37, START), (60, END)):
    cam.location = loc
    cam.rotation_euler = (TGT - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)

# The lightning itself, striking on beat 3. This is the whole point of the
# shot: the strike is what REVEALS him, and then it dies and leaves a
# silhouette with two lights in it. A cold hard sun from front-left, matching
# the storm side of the exterior plate, so the cloak's folds and the hood's
# brow catch a rim and the face stays a void.
flash = bpy.data.objects.get("PHA_Flash")
if flash is None:
    flash = bpy.data.objects.new("PHA_Flash", bpy.data.lights.new("PHA_Flash", 'SUN'))
    scene.collection.objects.link(flash)
flash.data.color = (0.70, 0.80, 1.0)
flash.data.angle = math.radians(6.0)
# From BEHIND and above-left, not the front. A frontal strike floodlit the face
# and destroyed the void that the whole character depends on; from behind it
# rims the hood's edge and the cloak's shoulders and leaves the face unlit.
# It also matches the storm's position — the lightning is over the house, and
# the house is behind him.
flash.rotation_euler = (math.radians(-62), 0.0, math.radians(34))
flash.data.animation_data_clear()
scene.world.node_tree.animation_data_clear()
wbg = scene.world.node_tree.nodes["Background"]
WORLD0 = 0.12
# Same two-stroke flicker as the exterior, so the two shots read as one strike.
PROFILE = [(0, 9.0), (1, 5.0), (2, 11.0), (3, 6.5), (4, 3.2), (6, 1.2), (9, 0.25), (14, 0.0)]
flash.data.energy = 0.0
flash.data.keyframe_insert("energy", frame=36)
wbg.inputs[1].default_value = WORLD0
wbg.inputs[1].keyframe_insert("default_value", frame=36)
for off, mult in PROFILE:
    flash.data.energy = 9.0 * mult
    flash.data.keyframe_insert("energy", frame=37 + off)
    # Keep the world lift small. Ambient is flat light: at 1.6 the peak pushed it
    # to 2.2 and floodlit the face, undoing the whole point of striking from
    # behind. The rim sun carries the flash; the world only stops the shadows
    # going absolutely black.
    wbg.inputs[1].default_value = WORLD0 * (1.0 + mult * 0.30)
    wbg.inputs[1].keyframe_insert("default_value", frame=37 + off)

fill = bpy.data.objects.get("PHA_FlashFill")
if fill is None:
    fill = bpy.data.objects.new("PHA_FlashFill", bpy.data.lights.new("PHA_FlashFill", 'SUN'))
    scene.collection.objects.link(fill)
fill.data.color = (0.66, 0.76, 1.0)
fill.data.angle = math.radians(20.0)
fill.rotation_euler = (math.radians(74), 0.0, math.radians(-30))
fill.data.animation_data_clear()
fill.data.energy = 0.0
fill.data.keyframe_insert("energy", frame=36)
for off, mult in PROFILE:
    fill.data.energy = 0.30 * mult      # ~6% of the rim: shape, not exposure
    fill.data.keyframe_insert("energy", frame=37 + off)

key = bpy.data.objects["PREVIEW_Key"]; rim = bpy.data.objects["PREVIEW_Rim"]
key.data.energy = 8;  key.data.color = (0.55, 0.62, 0.85)
rim.data.energy = 260; rim.data.color = (0.55, 0.68, 1.0)
rim.location = (-2.4, 2.6, 2.6)
bg = scene.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.012, 0.016, 0.028, 1)
bg.inputs[1].default_value = 0.12  # animated above by the strike

scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.eevee.taa_render_samples = 96
try: scene.eevee.shadow_pool_size = '4096'
except Exception: pass
scene.frame_start, scene.frame_end = 37, 60
outdir = os.path.join(HERE, "shotA2")
os.makedirs(outdir, exist_ok=True)
scene.render.filepath = os.path.join(outdir, "f_")
t0 = time.time()
bpy.ops.render.render(animation=True)
say(f"rendered frames 37-60 in {time.time()-t0:.0f}s")
