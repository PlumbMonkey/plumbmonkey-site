"""Restore the alpha channel on artwork that was flattened onto a transparency
checkerboard.

The hero-video assets were cut out correctly, then exported without an alpha
channel — so the editor's grey/white checkerboard preview got baked in as real
pixels. The cutout is not lost, it is just encoded as "these pixels are the
checker colour" instead of "these pixels are transparent".

This is not a chroma key. Recovering it properly means treating the checker as
a known background and solving the compositing equation:

    C = a*F + (1-a)*B        (what we have is C; B is the checker)
    F = (C - (1-a)*B) / a    (what we want is F, the true colour)

Skipping that un-premultiply step is what leaves a pale halo around soft edges,
because every antialiased edge pixel is part artwork and part white checker.

Chromatic pixels are held fully opaque regardless of brightness, so lit windows
and warm glows are never eaten by the matte.

    python unbake_checker.py <in.png> [<in.png> ...] --outdir DIR
"""
import subprocess, sys, os
import numpy as np

# Sampled from the corners of both assets: the checker alternates between these
# two near-whites, with a couple of levels of noise from resampling.
CHECK_HI, CHECK_LO = 254.0, 243.0
CHECK_MID = (CHECK_HI + CHECK_LO) / 2.0

# Typical luminance of the artwork itself once the background is gone. Used as
# the point at which the matte reaches fully opaque.
DARK_REF = 45.0
CHROMA_FULL = 30.0      # colour saturation that forces full opacity
FLOOR = 0.05            # kills the last of the checker noise


def read_rgb(path):
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
        capture_output=True, check=True).stdout
    dims = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", path], capture_output=True, check=True).stdout.decode().strip()
    w, h = (int(v) for v in dims.split(",")[:2])
    return np.frombuffer(out, np.uint8).reshape(h, w, 3).astype(np.float32)


def write_rgba(path, rgba):
    h, w = rgba.shape[:2]
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{w}x{h}", "-i", "-", "-frames:v", "1", path],
        input=rgba.astype(np.uint8).tobytes(), check=True)


def unbake(rgb):
    value = rgb.max(axis=2)
    chroma = value - rgb.min(axis=2)

    # Coverage from darkening, assuming the artwork is near-black.
    #
    #   C = a*F + (1-a)*B,  and with F ~= 0  ->  a = 1 - C/B
    #
    # This is exact for black-on-white and self-consistent with the
    # un-premultiply below, so edge pixels resolve to the true dark colour
    # instead of a lightened one. The earlier version interpolated alpha
    # between the checker's value and an assumed artwork value of 45, which
    # over-estimated coverage on every edge pixel and left the pale halo that
    # only became visible once the layers were composited over a night sky.
    a_raw = 1.0 - value / CHECK_MID
    # Artwork interiors are dark but not pure black, so full coverage lands a
    # little short of 1. The knee pushes anything near-opaque to fully opaque
    # without touching the partial edge values.
    alpha = np.clip(a_raw / 0.92, 0.0, 1.0)
    # Bright *coloured* pixels are artwork however bright — lit windows, the
    # warm porch glow, the moon.
    alpha = np.maximum(alpha, np.clip(chroma / CHROMA_FULL, 0.0, 1.0))
    alpha = np.clip((alpha - FLOOR) / (1.0 - FLOOR), 0.0, 1.0)

    # The coverage model is right at the boundary and wrong inside it: any part
    # of the artwork that is merely grey rather than black reads as partly
    # covered, and the layer goes see-through. So it is applied only to the thin
    # antialiased rim. Everything clearly inside the cutout is forced opaque.
    core = (value < 205) | (chroma > 12.0)
    inner = core.copy()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        inner &= np.roll(core, (dy, dx), axis=(0, 1))     # 1 px erosion
    alpha = np.where(inner, 1.0, alpha)

    a3 = alpha[..., None]
    safe = a3 > 0.05
    fg = np.where(safe, (rgb - (1.0 - a3) * CHECK_MID) / np.maximum(a3, 0.05), rgb)

    rgba = np.concatenate([np.clip(fg, 0, 255), alpha[..., None] * 255.0], axis=2)
    return rgba, alpha


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    outdir = "."
    if "--outdir" in sys.argv:
        outdir = sys.argv[sys.argv.index("--outdir") + 1]
        args = [a for a in args if a != outdir]
    os.makedirs(outdir, exist_ok=True)

    for path in args:
        rgb = read_rgb(path)
        rgba, alpha = unbake(rgb)
        name = os.path.splitext(os.path.basename(path))[0] + "_alpha.png"
        dest = os.path.join(outdir, name)
        write_rgba(dest, rgba)
        pct = 100.0 * float((alpha > 0.5).mean())
        edge = 100.0 * float(((alpha > 0.02) & (alpha < 0.98)).mean())
        print(f"{os.path.basename(path)}  ->  {name}"
              f"   opaque={pct:.1f}%  soft-edge={edge:.2f}%")
