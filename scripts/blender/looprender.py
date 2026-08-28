"""Re-render the hero loop from the same scene the stinger comes from, so the
two share a camera and the flash covers a cut between identical compositions.
Frames 1-240 (10 s at 24 fps), figure at its authored position — this is the
idle loop, so none of the stinger's glitch or jump animation applies.
"""
import bpy, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
A = r"D:\Brand Imagery\Brand Imagery\Hero Video Assets"
SWAP = {"Eerie forest path at night.png": "Eerie forest path at night_alpha.png",
        "Haunted Victorian mansion with eerie glow.png":
            "Haunted Victorian mansion with eerie glow_alpha.png"}
for i in bpy.data.images:
    if i.source != 'FILE': continue
    b = os.path.basename(i.filepath.replace("\\","/"))
    i.filepath = os.path.join(A, SWAP.get(b, b)); i.reload()
s = bpy.context.scene
s.render.resolution_x, s.render.resolution_y = 1920, 1080
s.render.resolution_percentage = 100
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGB'
s.frame_start, s.frame_end = 1, 240
out = os.path.join(HERE, "loop"); os.makedirs(out, exist_ok=True)
s.render.filepath = os.path.join(out, "f_")
t0 = time.time()
bpy.ops.render.render(animation=True)
print("[loop] 240 frames in %.0fs" % (time.time()-t0), flush=True)
