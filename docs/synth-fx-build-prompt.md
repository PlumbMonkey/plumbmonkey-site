# Build prompt — Ghost Circuit Soft Synth: FX rack + visual upgrade

You are working in the Plumbmonkey website repo at `D:\DEV Projects 2026 V2\projects\plumbmonkey-site`.
Your task is to add an effects rack and visual upgrades to the browser Soft Synth at
`public/music/synth/` (`synth.js` + `index.html`). Vanilla JS + Web Audio only — no
libraries, no sample/asset files, no backend. Do **not** commit or push; the user
handles git.

Before coding, read:
- `public/music/synth/synth.js` and `index.html` (the instrument you're extending)
- `public/music/shared/export-utils.js` (WAV/MIDI helpers — do not modify)
- The auto-memory file `music-sandbox.md` in the Claude memory directory (verification
  workflow + known gotchas). If unavailable, the essentials are repeated below.
- Optional prior art: the user's Stave app has a tuned version of this exact FX rack at
  `D:\DEV Projects 2026 V2\projects\Stave\ui\src\audio\effects.ts` (different codebase — read for
  parameter feel only, don't port code).

## Current architecture (as built — verify before assuming)

- Polyphonic: each note-on builds `osc → lowpass filter → ADSR gain → master` in the
  **live** AudioContext (`initAudio()`, `noteOn/noteOff`, `voices` map).
- `patch` object holds wave/cutoff/resonance/ADSR/volume; sliders bind via `bindControls()`
  (`bind(id, key, fmt)` — sliders pair with a `<span id="<id>Val">` readout and an
  optional `data-scale` attribute).
- **Recording**: note-ons push `{midi, onT, offT, snap: {...patch}}` into `recordedEvents`.
- **Export does NOT capture live audio.** `renderRecordingToBuffer()` re-synthesizes the
  take into an `OfflineAudioContext` via `scheduleVoice(ctx, dest, midi, onT, offT, snap)`
  (analytic ADSR; release starts at max(offT, decay end) — keep that simplification).
  WAV is encoded from that buffer. MIDI export is notes-only and must stay unaffected.

## THE core constraint — dual audio graphs

Live playback and WAV export are two separate graphs. Any effect wired only into the live
chain will be silently missing from exports. Requirement:

- Implement one constructor: `makeFxChain(ctx, fx) → { input, output }` that builds the
  full bus chain for a given context. Call it in BOTH `initAudio()` (live: `output` →
  master) and `renderRecordingToBuffer()` (offline: voices → `input`, `output` → offline
  master gain, which must keep mirroring the live master gain value as it does today).
- The reverb impulse response must be generated **inside** `makeFxChain` — AudioBuffers
  are per-context and sample-rate dependent.
- Acceptance test (mandatory): render the same recorded take once with all FX wet at 0
  and once with delay+reverb clearly wet; the two buffers must differ substantially.
  Missing-from-offline is a silent failure — prove it's there.

## FX scope (v1) and parameter specs

Bus chain order: `voices → drive → chorus → delay(dry/wet) → reverb(dry/wet) → master`.
Vibrato is per-voice, not on the bus.

1. **Vibrato** (per-voice): one LFO per voice (`osc` sine) → gain → `voice.osc.frequency`
   (detune is fine too). Controls: rate 3–8 Hz (default 5), depth 0–25 cents (default 0).
   Vibrato settings live in `patch` and ARE part of the per-note recording snapshot —
   `scheduleVoice` must reproduce them offline.
2. **Drive**: `WaveShaperNode`, tanh-style curve, with input gain scaled by amount and
   output trimmed to roughly unity loudness. Control: amount 0–100% (default 0 = bypass;
   at 0 the shaper should be transparent or bypassed).
3. **Chorus**: modulated `DelayNode` (base ~18 ms, LFO 0.2–1 Hz modulating ±4–8 ms),
   wet mixed with dry. Control: single "chorus" amount 0–100% mapping depth+wet
   (default 0).
4. **Delay**: `DelayNode` + feedback `GainNode` + wet `GainNode`. Controls: time
   60–800 ms (default 320), feedback 0–0.75 **hard-clamped in code below 0.9 no matter
   what the UI sends**, wet 0–60% (default 0).
5. **Reverb**: `ConvolverNode` with generated IR — stereo noise burst with exponential
   decay. Controls: size = IR length 0.8–3.5 s (default 1.8), wet 0–50% (default 0).
   Regenerate the IR only when size changes (live ctx); offline always generates fresh.

FX settings live in a `patch.fx` (or similar) object. **Snapshot semantics (decided —
implement as stated):** bus FX use the knob values at *export time*, like re-amping a
take; they are NOT per-note. Only vibrato is per-note (it's in the voice snapshot). Add
one line of UI copy near the export buttons: "Effects apply to the whole take as
currently set."

## Correctness requirements

- **Tail padding**: `renderRecordingToBuffer` currently sizes the buffer from last
  note-off + release. When delay wet > 0 or reverb wet > 0, extend the render length by
  `max(reverb IR length, delayTime × 6) + 0.5s` so tails aren't truncated.
- **Headroom**: do NOT add a DynamicsCompressorNode (measured misbehaving on this project
  — see drum-machine history in the memory file). Manage headroom by gain staging only.
  Verify with peak measurement: a recorded 5-note chord with delay+reverb wet at defaults
  and at max must render with peak ≤ ~0.98. If it clips, trim the bus output gain, and
  keep live + offline trims identical.
- **Stuck notes / leaks**: per-voice vibrato LFOs must be stopped in `noteOff` alongside
  the osc (and in the offline path, given explicit stop times).
- Keep the existing code style (plain functions, section comments), and don't touch the
  drum machine or `export-utils.js`.

## UI scope (build after the engine works)

1. **Panel regrouping**: reorganize the control panel into labeled sections —
   `OSC | FILTER | ENVELOPE | FX | OUT` — using fieldset-style bordered groups in the
   existing purple theme. FX gets its own row: vibrato rate/depth, drive, chorus, delay
   time/feedback/wet, reverb size/wet. Keep the existing slider+readout pattern
   (`bind()` already handles it). On small screens the FX section may wrap; that's fine.
2. **Oscilloscope**: `AnalyserNode` tapped off the live master → slim canvas
   (~720×70) between panel and keyboard; draw the time-domain waveform each frame in
   glowing cyan (`#67e8f9`, shadowBlur ~8) on near-black. Live only — no export impact.
   Start drawing on first `initAudio()`.
3. **Preset chips**: a row of buttons above the panel: `Init`, `Neon Lead`, `Ghost Pad`,
   `Grave Bass`, `Haunted Bell` — each sets `patch` + `patch.fx` + updates every slider
   and readout (add a `syncControls()` that reads patch → DOM). Design the five patches
   yourself to genuinely show off the rack (e.g. Ghost Pad = slow attack, big reverb;
   Neon Lead = saw + drive + delay; Haunted Bell = triangle, short decay, high reverb
   size). Plus `Save` / `Load` of one user patch in localStorage
   (`ghostCircuit.synth.userPatch`), with the drum machine's flash-message pattern for
   feedback.
4. **Octave shift**: ± buttons beside the keyboard and `Z`/`X` computer keys; shifts the
   whole keyboard ±12 per step, clamp C2..C6 base. On-screen key labels/data-midi must
   update; the computer KEYMAP shifts with it; recording keeps working across shifts.
5. **Key-press polish**: pressed keys get a soft purple glow (box-shadow), not just a
   color swap.

## Verification (all of it — the project's standard workflow)

- `node --check public/music/synth/synth.js` after every edit.
- Serve via the `plumbmonkey-site-static` launch config (port 5181) and test at
  `http://localhost:5181/public/music/synth/` — **trailing slash, never `/index.html`**
  (the serve tool's redirect breaks relative script paths — documented gotcha).
- Drive everything with `javascript_exec` (screenshots often time out in this pane):
  - No console errors on load; play a chord with every FX knob at max → no NaN, notes
    release cleanly (no stuck voices), scope canvas is drawing.
  - Record a short take → export path: rendered buffer peak in 0.3–0.98; buffer length
    proves tail padding; dry-vs-wet renders differ (the mandatory acceptance test).
  - Presets: clicking each chip changes patch values AND slider positions; save/load
    round-trips.
  - Octave shift: keyboard rebuilds, computer keys follow, notes recorded across a shift
    export correctly.
  - Regressions: Record/Export WAV/Export MIDI flows unchanged; MIDI file still valid
    (`MThd` header) and unaffected by FX; volume slider still mirrors into exports.
- If you add any interval/RAF loops in tests, clean them up in a `finally`.

Work in this order: engine (`makeFxChain` + offline integration + tail/headroom) →
verify → UI → verify. If you run low on budget, ship the engine fully verified and leave
UI items 3–5 for a follow-up session rather than shipping an unverified engine.
