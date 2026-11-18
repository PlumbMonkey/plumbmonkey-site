#!/usr/bin/env python3
"""
Luminarium offline renderer — frame-exact music videos from The Luminarium.

The live page records in real time with MediaRecorder, so a 4-minute song
takes 4 minutes, frames can drop, and sync depends on the browser. This tool
instead:
  1. analyses the audio file the same way the page's AnalyserNode does
     (2048 FFT, Blackman window, 0.84 smoothing, -100..-30 dB bytes, the same
     bass/mid/treble bands, gains, smoothing and beat gate as getBands()),
     sampled at the page's natural 60 updates per second;
  2. serves a tiny harness page that loads the real public/visual/visual.js,
     builds a VisualEngine at the output size and steps it once per 60 Hz tick;
  3. pipes the captured frames (at the output fps) into FFmpeg with the audio.

Usage (from the repo root):
  python scripts/luminarium-render/render.py SONG.wav -o out.mp4 --mode flux
  python scripts/luminarium-render/render.py SONG.wav --stills 30,60,95 -o stills/   # PNG checks
Needs Python 3.9+, numpy, FFmpeg, and Microsoft Edge or Chrome (headless).
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
VISUAL = REPO / "public" / "visual"
SIM_FPS = 60
FFT = 2048
BINS = FFT // 2

MODES = ["firefly-nebula", "neural-strings", "geometric-pulse", "fractal-warp", "spectrum-ring",
         "wave-mirror", "particle-galaxy", "laser-grid", "liquid-ribbons", "aurora-curtains",
         "tunnel-flight", "starfield-pulse", "neon-comet", "flux"]
PALETTE_NAMES = ["Prism Cathedral (neon)", "Signal Garden", "Velvet Aurora", "Solar Choir",
                 "Midnight Bloom", "Ghost Glass"]


# ---------------------------------------------------------------------------
# Audio analysis — mirrors initAudioAnalyser() + getBands() in visual.js
# ---------------------------------------------------------------------------

def analyse(audio: Path, sr: int = 48000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", str(sr),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    duration = len(x) / sr
    n = int(math.ceil(duration * SIM_FPS))
    pad = np.concatenate([np.zeros(FFT, np.float32), x, np.zeros(FFT, np.float32)])
    a0, a1, a2 = 0.42, 0.5, 0.08                       # WebAudio's Blackman window
    i = np.arange(FFT)
    win = (a0 - a1 * np.cos(2 * np.pi * i / FFT) + a2 * np.cos(4 * np.pi * i / FFT)).astype(np.float32)

    fft_bytes = np.zeros((n, BINS), np.uint8)
    smooth = np.zeros(BINS, np.float64)
    nyq = sr / 2

    def band(lo_hz, hi_hz):
        s = int(BINS * min(1.0, lo_hz / nyq))
        e = max(s + 1, int(BINS * min(1.0, hi_hz / nyq)))
        return s, e

    rb, rm, rt = band(30, 180), band(180, 2600), band(2600, 12000)
    bands = []
    sb = sm = st = 0.0
    hist: list[float] = []
    last_beat = -1e9
    gains = (1.15, 1.0, 1.05)
    beat_threshold = 0.62
    chunk = 2048
    for c0 in range(0, n, chunk):
        idx = np.arange(c0, min(n, c0 + chunk))
        ends = (idx / SIM_FPS * sr).astype(np.int64) + FFT        # window ends at "now"
        frames = np.stack([pad[e - FFT:e] for e in ends]) * win
        mags = np.abs(np.fft.rfft(frames, axis=1))[:, :BINS] / FFT
        for j, k in enumerate(idx):
            smooth = 0.84 * smooth + 0.16 * mags[j]
            db = 20 * np.log10(smooth + 1e-12)
            b = np.clip((db + 100) / 70 * 255, 0, 255).astype(np.uint8)
            fft_bytes[k] = b

            def avg(r):
                return min(1.0, b[r[0]:r[1]].mean() / 255)
            raw_b = min(1.0, avg(rb) * gains[0])
            raw_m = min(1.0, avg(rm) * gains[1])
            raw_t = min(1.0, avg(rt) * gains[2])
            sb += (raw_b - sb) * 0.22
            sm += (raw_m - sm) * 0.16
            st += (raw_t - st) * 0.2
            overall = (sb + sm + st) / 3
            hist.append(sb)
            if len(hist) > 48:
                hist.pop(0)
            rolling = sum(hist) / len(hist)
            gate = max(0.075, rolling * (1.18 + (beat_threshold - 0.35) * 1.05))
            now = k * 1000 / SIM_FPS
            beat = sb > gate and sb > overall * 1.04 and now - last_beat > 210
            if beat:
                last_beat = now
            bands.append([round(sb, 4), round(sm, 4), round(st, 4), round(overall, 4), int(beat)])
    return duration, bands, fft_bytes


def onset_beats(fft_bytes: np.ndarray, sr: int = 48000, min_gap: float = 0.28, sens: float = 1.0) -> np.ndarray:
    """Kick/snare onsets from spectral flux — far more reliable on dense,
    compressed mixes than the page's live bass gate, which can go quiet."""
    spec = fft_bytes.astype(np.float32)
    flux = np.maximum(0, np.diff(spec, axis=0, prepend=spec[:1]))
    hz_per_bin = sr / 2 / BINS
    low = flux[:, 1:max(2, int(160 / hz_per_bin))].mean(1)
    full = flux.mean(1)
    nov = low / (np.percentile(low, 99) + 1e-6) * 0.65 + full / (np.percentile(full, 99) + 1e-6) * 0.35
    k = int(0.5 * SIM_FPS) | 1
    mean = np.convolve(nov, np.ones(k) / k, mode="same")
    thr = mean * (1.35 / sens) + 0.08 / sens
    out = np.zeros(len(nov), np.int8)
    last = -10 ** 9
    gap = int(min_gap * SIM_FPS)
    for i in range(1, len(nov) - 1):
        if nov[i] > thr[i] and nov[i] >= nov[i - 1] and nov[i] > nov[i + 1] and i - last >= gap:
            out[i] = 1
            last = i
    return out


# ---------------------------------------------------------------------------
# Harness page
# ---------------------------------------------------------------------------

HARNESS = r"""<!doctype html><html><head><meta charset="utf-8"><title>render</title></head>
<body style="margin:0;background:#000">
<canvas id="stage"></canvas><div id="stageWrap"></div>
<script src="/visual/visual.js?r=__STAMP__"></script>
<script>
(async () => {
  const log = m => fetch('/log', { method: 'POST', body: String(m) });
  window.addEventListener('error', e => log('page error (ignored): ' + e.message));
  try {
    const meta = await (await fetch('/meta.json')).json();
    const bands = await (await fetch('/bands.json')).json();
    const fft = new Uint8Array(await (await fetch('/fft.bin')).arrayBuffer());
    const W = meta.width, H = meta.height, bins = meta.bins;
    const canvas = document.createElement('canvas');
    const eng = new VisualEngine(canvas);
    eng.viewWidth = W; eng.viewHeight = H; eng.pixelRatio = 1;
    eng.setPalette(PALETTES[meta.palette]);
    Object.assign(eng.config, meta.config || {});
    eng.setOutputSize(W, H);
    eng.resolutionLock = true;
    eng.setMode(meta.mode);
    eng.transitionUntil = 0;
    for (const k in (meta.effects || {})) effectState[k] = meta.effects[k];
    const bloom = effectState.bloom;
    const caps = meta.capture;               // ascending sim-frame indices to capture
    let ci = 0, t0 = performance.now();
    for (let i = meta.firstSim; i <= caps[caps.length - 1]; i++) {
      const b = bands[Math.min(i, bands.length - 1)];
      const capture = i === caps[ci];
      effectState.bloom = capture ? bloom : false;   // bloom only touches the output frame
      const params = { warp: 1.2 + b[1] * 1.2, glow: 1 + b[2] * 0.8, pulse: b[0], intensity: 1 + b[3] * 0.8 };
      eng.render(params, !!b[4], fft.subarray(i * bins, (i + 1) * bins));
      if (capture) {
        const blob = await new Promise(r => canvas.toBlob(r, meta.format, meta.quality));
        await fetch('/frame?i=' + ci, { method: 'POST', body: blob });
        ci++;
        if (ci % 120 === 0) log('frame ' + ci + '/' + caps.length + '  ' +
          (ci / ((performance.now() - t0) / 1000)).toFixed(1) + ' fps');
      }
    }
  } catch (e) {
    await log('FATAL ' + (e && e.stack || e));
  }
  await fetch('/done', { method: 'POST' });
})();
</script></body></html>"""


class State:
    def __init__(self):
        self.files: dict[str, tuple[bytes, str]] = {}
        self.ffmpeg: subprocess.Popen | None = None
        self.still_dir: Path | None = None
        self.still_names: list[str] = []
        self.frames = 0
        self.done = threading.Event()


def make_handler(st: State):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, body=b"", ctype="text/plain"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path in st.files:
                body, ctype = st.files[path]
                return self._send(200, body, ctype)
            if path.startswith("/visual/"):
                f = (VISUAL / path[len("/visual/"):]).resolve()
                if f.is_file() and VISUAL in f.parents:
                    ctype = "application/javascript" if f.suffix == ".js" else "text/plain"
                    return self._send(200, f.read_bytes(), ctype)
            self._send(404)

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b""
            path = self.path.split("?")[0]
            if path == "/frame":
                if st.still_dir is not None:
                    name = st.still_names[st.frames]
                    (st.still_dir / name).write_bytes(body)
                else:
                    st.ffmpeg.stdin.write(body)
                st.frames += 1
            elif path == "/log":
                print("  [page]", body.decode("utf-8", "replace"), flush=True)
            elif path == "/done":
                st.done.set()
            self._send(200)
    return H


def find_browser(user: str | None) -> str:
    cands = [user] if user else []
    cands += [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              shutil.which("chromium") or "", shutil.which("google-chrome") or ""]
    for c in cands:
        if c and os.path.exists(c):
            return c
    sys.exit("No Edge/Chrome found; pass --browser PATH")


def main():
    ap = argparse.ArgumentParser(description="Frame-exact offline render of The Luminarium")
    ap.add_argument("audio", type=Path)
    ap.add_argument("-o", "--output", type=Path, required=True, help="MP4 file, or a folder with --stills")
    ap.add_argument("--mode", default="flux", choices=MODES)
    ap.add_argument("--palette", type=int, default=0, help="0-5: " + ", ".join(PALETTE_NAMES))
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--start", type=float, default=0.0, help="Start time in the song (s)")
    ap.add_argument("--duration", type=float, default=None, help="Length to render (s); default: to the end")
    ap.add_argument("--warmup", type=float, default=4.0, help="Seconds simulated before --start")
    ap.add_argument("--stills", help="Comma list of song times (s) to save as PNGs instead of a video")
    ap.add_argument("--config", default="{}", help="JSON engine config overrides, e.g. '{\"bloomStrength\":0.3}'")
    ap.add_argument("--effects", default="{}", help="JSON effect toggles, e.g. '{\"vignette\":true}'")
    ap.add_argument("--beats", choices=["onsets", "page"], default="onsets",
                    help="'onsets' = spectral-flux drum hits (default), 'page' = the live page's bass gate")
    ap.add_argument("--beat-sensitivity", type=float, default=1.0)
    ap.add_argument("--crf", type=int, default=14)
    ap.add_argument("--timecode", default="01:00:00:00", help="Start timecode stamped on the MP4")
    ap.add_argument("--browser")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--show", action="store_true", help="Show the browser window instead of headless")
    a = ap.parse_args()

    W, H = (int(v) for v in a.size.lower().split("x"))
    t_start = time.time()
    print(f"Analysing {a.audio.name} ...", flush=True)
    duration, bands, fft = analyse(a.audio)
    if a.beats == "onsets":
        ob = onset_beats(fft, sens=a.beat_sensitivity)
        for b, v in zip(bands, ob):
            b[4] = int(v)
    beats = sum(b[4] for b in bands)
    print(f"  {duration:.1f}s, {len(bands)} analysis frames, {beats} beats", flush=True)

    st = State()
    if a.stills:
        times = [float(t) for t in a.stills.split(",")]
        caps = sorted({min(len(bands) - 1, round(t * SIM_FPS)) for t in times})
        first = max(0, caps[0] - int(a.warmup * SIM_FPS))
        st.still_dir = a.output
        a.output.mkdir(parents=True, exist_ok=True)
        st.still_names = [f"{a.mode}_p{a.palette}_{c / SIM_FPS:07.2f}s.png" for c in caps]
        fmt, quality = "image/png", 1
    else:
        end = duration if a.duration is None else min(duration, a.start + a.duration)
        n_out = int(math.floor((end - a.start) * a.fps + 1e-6))
        caps = [round((a.start + k / a.fps) * SIM_FPS) for k in range(n_out)]
        first = max(0, caps[0] - int(a.warmup * SIM_FPS))
        fmt, quality = "image/jpeg", 0.95
        a.output.parent.mkdir(parents=True, exist_ok=True)
        st.ffmpeg = subprocess.Popen(
            ["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(a.fps), "-c:v", "mjpeg", "-i", "-",
             "-ss", f"{a.start:.3f}", "-t", f"{n_out / a.fps:.3f}", "-i", str(a.audio),
             "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf),
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k", "-timecode", a.timecode,
             "-movflags", "+faststart", str(a.output)], stdin=subprocess.PIPE)
        print(f"Rendering {n_out} frames ({n_out / a.fps:.1f}s) of '{a.mode}' at {W}x{H} {a.fps:g}fps", flush=True)

    meta = {"width": W, "height": H, "bins": BINS, "palette": a.palette, "mode": a.mode,
            "config": json.loads(a.config), "effects": json.loads(a.effects),
            "capture": caps, "firstSim": first, "format": fmt, "quality": quality}
    st.files = {
        "/harness.html": (HARNESS.replace("__STAMP__", str(int(time.time()))).encode(), "text/html"),
        "/meta.json": (json.dumps(meta).encode(), "application/json"),
        "/bands.json": (json.dumps(bands).encode(), "application/json"),
        "/fft.bin": (fft.tobytes(), "application/octet-stream"),
    }
    server = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(st))
    threading.Thread(target=server.serve_forever, daemon=True).start()

    profile = Path(tempfile.mkdtemp(prefix="lumrender_"))
    browser = subprocess.Popen(
        [find_browser(a.browser)] + ([] if a.show else ["--headless=new"]) +
        [f"--user-data-dir={profile}", "--no-first-run", "--disable-background-timer-throttling",
         "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
         f"--window-size={min(W, 1600)},{min(H, 900)}", f"http://127.0.0.1:{a.port}/harness.html"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        st.done.wait()
    finally:
        browser.terminate()
        server.shutdown()
        if st.ffmpeg:
            st.ffmpeg.stdin.close()
            st.ffmpeg.wait()
        shutil.rmtree(profile, ignore_errors=True)
    print(f"Captured {st.frames} frames in {time.time() - t_start:.0f}s -> {a.output}", flush=True)
    if st.frames != len(caps):
        sys.exit(f"Expected {len(caps)} frames but got {st.frames}")


if __name__ == "__main__":
    main()
