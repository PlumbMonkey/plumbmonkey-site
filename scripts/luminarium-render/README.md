# Luminarium offline renderer

Renders The Luminarium (`public/visual`) to a frame-exact music video, with no real-time recording.

```bash
python scripts/luminarium-render/render.py "song.wav" -o out.mp4 --mode flux --palette 0
```

How it works:
1. **Audio analysis.** The song is analysed exactly as the page's `AnalyserNode` and `getBands()` would
   see it (2048 FFT, Blackman window, 0.84 smoothing, the same bands, gains and smoothing),
   at the page's natural 60 updates per second.
2. **Beats.** By default they come from spectral-flux drum onsets (`--beats onsets`). The page's live bass
   gate (`--beats page`) can go almost silent on dense, compressed mixes.
3. **Rendering.** A headless Edge or Chrome loads the real `visual.js` through a tiny harness page. It steps
   one `VisualEngine` 60 times per second of song and captures frames at `--fps`.
4. **Encoding.** Frames are piped into FFmpeg (H.264, CRF 14) with the audio, stamped with timecode
   `01:00:00:00` so the file lines up with a Resolve timeline.

Useful options:
- `--mode` picks any Luminarium mode, including the new `flux`.
- `--palette 0-5` picks the colour scheme.
- `--size 1920x1080` and `--fps 24` set the output format.
- `--start 30 --duration 12` renders a short test clip.
- `--stills 20,36,52` saves PNG checks instead of a video.
- `--config '{"bloomStrength":0.3}'` and `--effects '{"vignette":true}'` override engine settings.

Speed is about 5 output frames per second at 1080p24 for Flux, so a 4-minute song takes about 20 minutes.
Requires numpy, FFmpeg and Edge or Chrome.
