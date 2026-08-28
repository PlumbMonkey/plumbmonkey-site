"""Shot A1 of the entry cinematic — the exterior, built in the real hero project.

Frames 1-36 (0.000-1.458 s). The 2D figure glitches on beat 1 and snaps closer
on beat 2; beat 3 is the 3D phantom close-up and is a separate shot.

The jump moves the figure ALONG THE CAMERA RAY rather than along an axis, so it
grows without sliding across frame — it arrives closer in the same place, which
is what makes it read as a teleport rather than a walk.

Everything else in the file is untouched: same camera, same layers, same fog
sim. That is the whole point of building here — the stinger cannot drift from
the loop because it IS the loop's scene.
"""
import bpy, os, time
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
def say(m): print("[A1] " + m, flush=True)

A = r"D:\Brand Imagery\Brand Imagery\Hero Video Assets"
SWAP = {
    "Eerie forest path at night.png": "Eerie forest path at night_alpha.png",
    "Haunted Victorian mansion with eerie glow.png":
        "Haunted Victorian mansion with eerie glow_alpha.png",
}
for i in bpy.data.images:
    if i.source != 'FILE':
        continue
    base = os.path.basename(i.filepath.replace("\\", "/"))
    i.filepath = os.path.join(A, SWAP.get(base, base))
    i.reload()

scene = bpy.context.scene
cam = scene.objects["Camera"]
fig = scene.objects["Plane.003"]
blocker = scene.objects.get("Figure Fog Blocker")
vortex = scene.objects.get("Figure Vortex")

base = fig.location.copy()
to_cam = cam.location - base
say(f"figure {[round(v,2) for v in base]}, {to_cam.length:.1f} m from camera")

# 0.24 of the way to camera ~= 1.31x apparent size: "a bit closer", not a leap.
near = base + to_cam * 0.24
say(f"beat 2 position {[round(v,2) for v in near]}")

# Two-frame displacement under the flash reads as the image tearing rather than
# the figure moving.
glitch = base + Vector((0.0, 0.28, 0.14))

fig.animation_data_clear()
for f, loc in ((1, base), (3, glitch), (5, base), (19, near)):
    fig.location = loc
    fig.keyframe_insert("location", frame=f)

# The fog blocker and vortex are parented to the figure's position in the
# original scene; move them with it or the fog hole stays where the figure was.
for helper in (blocker, vortex):
    if not helper:
        continue
    hbase = helper.location.copy()
    helper.animation_data_clear()
    for f, loc in ((1, hbase), (3, hbase + Vector((0.0, 0.28, 0.0))), (5, hbase),
                   (19, hbase + Vector((near.x - base.x, near.y - base.y, 0.0)))):
        helper.location = loc
        helper.keyframe_insert("location", frame=f)

def const(ob):
    act = ob.animation_data and ob.animation_data.action
    if not act:
        return
    # Blender 5 dropped Action.fcurves for slotted actions.
    curves = []
    if hasattr(act, "fcurves"):
        curves = list(act.fcurves)
    else:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'CONSTANT'

for ob in (fig, blocker, vortex):
    if ob:
        const(ob)

# ---- the lightning itself -----------------------------------------------------
# Until now the "lightning" was only a white overlay on the web page. These
# layers are lit by a sun and the world, so a real flash is an animated spike on
# both — and unlike an overlay it lights the HOUSE, the fog, the treeline and
# the figure together, which is what actually sells it.
#
# The profile is not a single ramp: real strikes flicker, with a hard leading
# edge, a dip, a brighter second stroke, then a fast fall. That shape is most of
# what separates lightning from someone switching a lamp on.
sun = scene.objects["Light"]
bgnode = scene.world.node_tree.nodes["Background"]
SUN0 = sun.data.energy
WORLD0 = bgnode.inputs[1].default_value
FLASH = [(0, 7.0), (1, 4.0), (2, 8.5), (3, 5.0), (4, 2.6), (5, 1.6), (6, 1.15), (7, 1.0)]
sun.data.animation_data_clear()
scene.world.node_tree.animation_data_clear()

def flash_key(frame, mult):
    sun.data.energy = SUN0 * mult
    sun.data.keyframe_insert("energy", frame=frame)
    bgnode.inputs[1].default_value = WORLD0 * (1.0 + (mult - 1.0) * 0.55)
    bgnode.inputs[1].keyframe_insert("default_value", frame=frame)

flash_key(1, 1.0)
for beat in (1, 19):                      # beats 1 and 2; beat 3 is shot A2
    if beat > 1:
        flash_key(beat - 1, 1.0)
    for off, mult in FLASH:
        flash_key(beat + off, mult)
say(f"lightning keyed on frames 1 and 19 (sun base {SUN0}, world base {WORLD0})")

scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.frame_start, scene.frame_end = 1, 36
outdir = os.path.join(HERE, "shotA1")
os.makedirs(outdir, exist_ok=True)
scene.render.filepath = os.path.join(outdir, "f_")
t0 = time.time()
bpy.ops.render.render(animation=True)
say(f"rendered 36 frames in {time.time()-t0:.0f}s")
