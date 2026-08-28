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

# The ramp has to start BELOW the checker's darker square, not at its lighter
# one: ramping from 254 leaves every dark checker pixel (243) sitting at alpha
# 0.55, i.e. half the background survives as a haze.
BG_AT = 241.0           # value at/above which a pixel is certainly background
OPAQUE_BELOW = 230.0    # value at/below which a pixel is certainly artwork
CHROMA_FULL = 12.0      # colour saturation that forces full opacity


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

    # Alpha from brightness: at the checker's brightness the pixel is fully
    # background, and it ramps to opaque over the antialiasing range.
    a_bright = np.clip((BG_AT - value) / (BG_AT - OPAQUE_BELOW), 0.0, 1.0)
    # ...but any pixel with real colour in it is artwork, however bright.
    a_chroma = np.clip(chroma / CHROMA_FULL, 0.0, 1.0)
    alpha = np.maximum(a_bright, a_chroma)

    # Lift the black point. Resampling left checker pixels scattered a couple
    # of levels either side of their nominal greys, so the background carries a
    # faint non-zero alpha that reads as a haze of the checker pattern once
    # composited. Anything under this is background, not a soft edge.
    alpha = np.clip((alpha - 0.14) / (1.0 - 0.14), 0.0, 1.0)

    # Un-premultiply against the checker to strip the white fringe. Guarded so
    # near-transparent pixels (where F is unrecoverable) are left alone.
    a3 = alpha[..., None]
    safe = a3 > 0.02
    fg = np.where(safe, (rgb - (1.0 - a3) * CHECK_MID) / np.maximum(a3, 0.02), rgb)

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
