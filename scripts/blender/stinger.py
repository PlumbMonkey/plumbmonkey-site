"""The entry cinematic — "Enter the Manor" on the home page.

Two shots, rendered separately and joined in ffmpeg:

  A. Exterior (HauntedNight). The cloaked figure snaps closer to camera in
     three hard steps while the camera drifts toward the house.
  B. Interior (Foyer). The front doors swing open toward camera and the camera
     pushes through them, ending exactly on FoyerHeroCam — the same transform
     the web viewer opens on, so the film's last frame and the 3D room's first
     frame are the same picture.

The lightning flashes are NOT rendered here. They are a white CSS overlay on
the home page, for two reasons: the page needs one anyway to hide the cut from
the looping hero video (which is at an unpredictable frame when the visitor
clicks), and a flash that covers a hard jump is exactly what sells the figure's
teleport. So Blender moves the figure; the page hides the move.

Usage:  blender -b <file> --python stinger.py -- [--preview | --final]
"""
import bpy, os, sys, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--final" not in argv

FPS = 24
SHOT_A_FRAMES = 60          # 2.5 s
SHOT_B_FRAMES = 48          # 2.0 s
# The three steps the figure teleports through. Each is held with CONSTANT
# interpolation so it snaps rather than slides, and the page flashes on the
# same frames.
FIGURE_STEPS = (1, 15, 28)

def say(m): print("[stinger] " + m, flush=True)


def fcurves(obj):
    """Every F-curve on an object's action.

    Blender 5 moved to slotted actions and dropped Action.fcurves entirely —
    curves now live at action.layers[].strips[].channelbags[].fcurves. The old
    attribute is gone, not deprecated, so this is not optional.
    """
    act = obj.animation_data and obj.animation_data.action
    if not act:
        return []
    if hasattr(act, "fcurves"):          # pre-5.x
        return list(act.fcurves)
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def set_interp(obj, interpolation, easing='EASE_IN_OUT', only_frame=None):
    for fc in fcurves(obj):
        for kp in fc.keyframe_points:
            if only_frame is not None and kp.co[0] != only_frame:
                continue
            kp.interpolation = interpolation
            kp.easing = easing


def setup_render(scene, w, h, samples):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.eevee.taa_render_samples = samples
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    # EEVEE runs out of shadow atlas on these scenes at the default 2048.
    try:
        scene.eevee.shadow_pool_size = '4096'
    except Exception:
        pass


# =============================================================== shot A setup
def build_shot_a():
    s = bpy.data.scenes["HauntedNight"]
    bpy.context.window.scene = s

    cam = bpy.data.objects.new("StingerCam_A", bpy.data.cameras.new("StingerCam_A"))
    s.collection.objects.link(cam)
    s.camera = cam
    cam.data.sensor_width = 36
    cam.data.lens = 32

    # Matches the framing of the looping hero video on the home page: house
    # right of centre, moon upper left. Taken from the season scenes' Camera,
    # which HauntedNight does not have one of.
    start = Vector((-11.0, -33.5, -3.0))
    rot = (1.828, 0.0, -0.3253)
    cam.rotation_euler = rot

    # A slow drift toward the house across the whole shot, so the frame is
    # always moving under the figure's hard cuts.
    forward = Vector((math.sin(-rot[2]) * 0.0 + 0.0, 1.0, 0.0))
    forward = Vector((0.32, 0.94, 0.06)).normalized()
    cam.location = start
    cam.keyframe_insert("location", frame=1)
    # Kept short on purpose. At 3.2 m the camera drove into the figure and the
    # last second of the shot was a featureless black slab; this drifts just
    # enough to keep the frame alive and tighten the loom.
    cam.location = start + forward * 0.9
    cam.keyframe_insert("location", frame=SHOT_A_FRAMES)
    set_interp(cam, 'SINE', 'EASE_IN_OUT')

    fig = s.objects["Figure"]

    # The scene's Figure is a glowing pale apparition (GhostPale is a bare
    # Emission shader). The figure in the home page's hero loop is a dark
    # cloaked silhouette, and that is the one the visitor just watched, so it
    # is re-shaded here to match. Copied first: GhostPale may be doing its
    # intended job elsewhere in the author's scene.
    cloak = bpy.data.materials.new("Stinger_Cloak")
    cloak.use_nodes = True
    nt = cloak.node_tree
    nt.nodes.clear()
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (300, 0)
    bsdf.inputs["Base Color"].default_value = (0.012, 0.010, 0.018, 1)
    bsdf.inputs["Roughness"].default_value = 0.62
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    fig.data.materials.clear()
    fig.data.materials.append(cloak)
    say("figure re-shaded to a dark cloak to match the hero loop")

    # The figure's mesh sits at absolute world coordinates with the object at
    # the origin, so its "position" is an offset added on top.
    co = [Vector(v.co) for v in fig.data.vertices]
    base = Vector((sum(c.x for c in co) / len(co),
                   sum(c.y for c in co) / len(co),
                   min(c.z for c in co)))
    height = max(c.z for c in co) - base.z
    say(f"figure stands at {[round(v, 2) for v in base]}, {height:.2f} m tall")

    def frame_half_height(d):
        sensor_h = cam.data.sensor_width * H / W
        return d * (sensor_h / 2.0) / cam.data.lens

    def place_looming(d, at_frame, u_frac=-0.30, top_frac=0.88):
        """Put the figure d metres in front of the lens, framed so its hood
        sits just below the top edge.

        Stepping it along the camera's view axis instead (the obvious move)
        lifts it off the ground, because this camera is pitched down — at
        close range the figure ended up floating mid-air and half out of
        frame. Placing it in camera space and solving for the framing is what
        keeps the hood where it belongs at any distance."""
        hh = frame_half_height(d)
        hw = hh * W / H
        v = top_frac * hh - height / 2.0
        # Read the camera where it actually is on the frame being placed: it
        # is animated, so matrix_basis still holds its end-of-shot position.
        s.frame_set(at_frame)
        bpy.context.view_layer.update()
        world = cam.matrix_world @ Vector((u_frac * hw, v, -d))
        return world - Vector((base.x, base.y, base.z + height / 2.0))

    far, mid, loom = FIGURE_STEPS
    fig.location = Vector((0, 0, 0))
    fig.keyframe_insert("location", frame=far)
    # Mid step sits low in frame so it still reads as someone standing out on
    # the hill. Sliding it along the ground instead put it above the downslope,
    # where it appeared to be standing on the roof.
    fig.location = place_looming(9.0, mid, u_frac=-0.22, top_frac=0.20)
    fig.keyframe_insert("location", frame=mid)
    fig.location = place_looming(3.4, loom)
    fig.keyframe_insert("location", frame=loom)
    # Hold the loom through the end of the shot: the camera keeps drifting, so
    # a second key stops the figure sliding out of frame as it passes.
    fig.keyframe_insert("location", frame=SHOT_A_FRAMES)

    set_interp(fig, 'CONSTANT')

    s.frame_start, s.frame_end = 1, SHOT_A_FRAMES
    return s


# =============================================================== shot B setup
def hinge(door, sign):
    """Parent a door to an empty at its outer edge so it swings on that edge
    rather than pivoting through its own middle."""
    scene = bpy.data.scenes["Foyer"]
    w = door.dimensions.x
    piv = bpy.data.objects.new(f"HINGE_{door.name}", None)
    scene.collection.objects.link(piv)
    piv.location = door.matrix_basis.translation + Vector((sign * w / 2.0, 0, 0))
    piv.location.z = 0
    mw = door.matrix_basis.copy()
    door.parent = piv
    door.matrix_parent_inverse = piv.matrix_basis.inverted()
    door.matrix_basis = mw
    return piv


def build_shot_b():
    s = bpy.data.scenes["Foyer"]
    bpy.context.window.scene = s
    bpy.context.view_layer.update()

    hero = s.objects["FoyerHeroCam"]
    cam = bpy.data.objects.new("StingerCam_B", hero.data.copy())
    s.collection.objects.link(cam)
    s.camera = cam
    cam.rotation_euler = hero.rotation_euler.copy()

    end = hero.matrix_basis.translation.copy()
    # Start outside the closed doors (they sit at y = -6.04) and push through
    # to land precisely on the hero camera.
    start = Vector((end.x, -8.4, end.z - 0.25))
    cam.location = start
    cam.keyframe_insert("location", frame=1)
    cam.location = end
    cam.keyframe_insert("location", frame=SHOT_B_FRAMES)
    set_interp(cam, 'SINE', 'EASE_IN')

    L = s.objects["Front_Door_L"]
    R = s.objects["Front_Door_R"]
    pl, pr = hinge(L, -1), hinge(R, +1)

    # Closed, then swung inward away from camera. They start opening a few
    # frames in so the shot opens on a shut door.
    for piv, sign in ((pl, +1), (pr, -1)):
        piv.rotation_euler = (0, 0, 0)
        piv.keyframe_insert("rotation_euler", frame=1)
        piv.keyframe_insert("rotation_euler", frame=6)
        piv.rotation_euler = (0, 0, sign * math.radians(88))
        piv.keyframe_insert("rotation_euler", frame=34)
        set_interp(piv, 'SINE', 'EASE_OUT')
        set_interp(piv, 'BACK', 'EASE_OUT', only_frame=34)

    s.frame_start, s.frame_end = 1, SHOT_B_FRAMES
    return s


# ==================================================================== render
W, H = (960, 540) if PREVIEW else (1920, 1080)
SAMPLES = 24 if PREVIEW else 64
KEYS_ONLY = "--keys" in argv

a = build_shot_a()
b = build_shot_b()
setup_render(a, W, H, SAMPLES)
setup_render(b, W, H, SAMPLES)

for scene, tag, nframes in ((a, "A", SHOT_A_FRAMES), (b, "B", SHOT_B_FRAMES)):
    bpy.context.window.scene = scene
    outdir = os.path.join(HERE, f"shot{tag}")
    os.makedirs(outdir, exist_ok=True)
    if KEYS_ONLY:
        frames = sorted(set(list(FIGURE_STEPS) + [nframes])) if tag == "A" else [1, 12, 24, 36, nframes]
        for f in frames:
            scene.frame_set(f)
            scene.render.filepath = os.path.join(outdir, f"key_{f:04d}.png")
            bpy.ops.render.render(write_still=True)
            say(f"shot {tag} key frame {f}")
    else:
        scene.render.filepath = os.path.join(outdir, "f_")
        bpy.ops.render.render(animation=True)
        say(f"shot {tag}: rendered {nframes} frames to {outdir}")

say("done")
