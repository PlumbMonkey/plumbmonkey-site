// ============================================================
// GHOST CIRCUIT — shared synth engine
// The FX rack and offline voice scheduling, lifted out of synth.js so the
// Song view can play and export recorded synth takes with exactly the same
// sound the synth page produced. Live note handling stays in synth.js.
// ============================================================

(function () {
  const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  // Reverb impulse response: stereo noise burst with exponential decay.
  // AudioBuffers are per-context + sample-rate dependent, so this is always
  // generated inside the chain for whichever context is rendering.
  function makeReverbIR(ctx, sizeSec) {
    const s = Math.min(Math.max(sizeSec, 0.8), 3.5);
    const len = Math.max(1, Math.ceil(s * ctx.sampleRate));
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
      }
    }
    return ir;
  }

  // tanh saturation curve for the WaveShaper — driveK pushes harder as amount rises.
  function tanhCurve(driveK, n = 1024) {
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(driveK * x);
    }
    return curve;
  }

  // ============================================================
  // FX RACK — dual-graph bus (used by BOTH live and offline export)
  // Chain order: input → drive → chorus → delay → reverb → output
  // Returns { input, output, applyFx } so live knob edits update in place.
  // ============================================================
  function makeFxChain(ctx, fx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    // Bus headroom trim (gain-staging only — no compressor on this project).
    // The parallel dry+wet sums of a full 5-note chord peak ~1.26 undamped;
    // 0.75 keeps the worst case (all FX maxed) under 0.98 while a dry take
    // still lands well above the 0.3 audibility floor. Live + offline share
    // this identical trim because they share this constructor.
    output.gain.value = 0.75;

    // ---- Drive: parallel dry/wet tanh saturation (transparent at amount 0) ----
    const drDry = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '2x';
    const drWet = ctx.createGain();
    const driveSum = ctx.createGain();
    input.connect(drDry); drDry.connect(driveSum);
    input.connect(shaper); shaper.connect(drWet); drWet.connect(driveSum);

    // ---- Chorus: modulated delay blended with dry ----
    const chDry = ctx.createGain(); chDry.gain.value = 1;
    const chDelay = ctx.createDelay(0.05); chDelay.delayTime.value = 0.018; // 18 ms base
    const chWet = ctx.createGain();
    const chLfo = ctx.createOscillator(); chLfo.type = 'sine';
    const chLfoGain = ctx.createGain();
    chLfo.connect(chLfoGain); chLfoGain.connect(chDelay.delayTime);
    const chorusSum = ctx.createGain();
    driveSum.connect(chDry); chDry.connect(chorusSum);
    driveSum.connect(chDelay); chDelay.connect(chWet); chWet.connect(chorusSum);

    // ---- Delay: delay + feedback + wet, blended with dry ----
    const dlDry = ctx.createGain(); dlDry.gain.value = 1;
    const dl = ctx.createDelay(1.0);
    const dlFb = ctx.createGain();
    const dlWet = ctx.createGain();
    const delaySum = ctx.createGain();
    chorusSum.connect(dlDry); dlDry.connect(delaySum);
    chorusSum.connect(dl); dl.connect(dlFb); dlFb.connect(dl); dl.connect(dlWet); dlWet.connect(delaySum);

    // ---- Reverb: convolver (generated IR) + damping, blended with dry ----
    const rvDry = ctx.createGain(); rvDry.gain.value = 1;
    const conv = ctx.createConvolver();
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 5200;
    const rvWet = ctx.createGain();
    delaySum.connect(rvDry); rvDry.connect(output);
    delaySum.connect(conv); conv.connect(damp); damp.connect(rvWet); rvWet.connect(output);

    chLfo.start();

    let curSize = -1;
    function applyFx(fx) {
      // drive — dry(1-k)+wet(k) keeps roughly unity loudness across the sweep
      const k = Math.min(Math.max(fx.drive, 0), 100) / 100;
      drWet.gain.value = k * 0.9;
      drDry.gain.value = 1 - k;
      shaper.curve = tanhCurve(1 + k * 9);
      // chorus — single amount maps depth + wet together
      const c = Math.min(Math.max(fx.chorus, 0), 100) / 100;
      chWet.gain.value = c;
      chLfo.frequency.value = 0.2 + c * 0.8;      // 0.2–1 Hz
      chLfoGain.gain.value = 0.004 + c * 0.004;   // ±4–8 ms
      // delay — feedback hard-clamped well below self-oscillation
      dl.delayTime.value = Math.min(Math.max(fx.delayTime, 0.06), 0.8);
      dlFb.gain.value = Math.min(Math.max(fx.delayFeedback, 0), 0.85);
      dlWet.gain.value = Math.min(Math.max(fx.delayWet, 0), 0.6);
      // reverb — regenerate the IR only when size actually changes
      rvWet.gain.value = Math.min(Math.max(fx.reverbWet, 0), 0.5);
      const size = Math.min(Math.max(fx.reverbSize, 0.8), 3.5);
      if (Math.abs(size - curSize) > 0.001) { conv.buffer = makeReverbIR(ctx, size); curSize = size; }
    }
    applyFx(fx);
    return { input, output, applyFx };
  }

  // ---------- Scheduled re-synthesis of a recorded note ----------
  // Mirrors the live noteOn/noteOff envelope shape as a single curve computed
  // ahead of time. Works on a live context (song playback) or an offline one
  // (export) — the times are absolute in whichever context is passed.
  function scheduleVoice(ctx, dest, midi, onT, offT, snap) {
    const peak = 0.9;
    const osc = ctx.createOscillator();
    osc.type = snap.wave;
    osc.frequency.value = midiToFreq(midi);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = snap.cutoff;
    filt.Q.value = snap.resonance;
    const gain = ctx.createGain();
    const sustainLevel = Math.max(0.0001, snap.sustain * peak);
    gain.gain.setValueAtTime(0.0001, onT);
    gain.gain.linearRampToValueAtTime(peak, onT + Math.max(snap.attack, 0.001));
    gain.gain.linearRampToValueAtTime(sustainLevel, onT + snap.attack + snap.decay);
    // Simplification: if a note is released before the decay stage finishes,
    // the release begins once decay completes rather than mid-ramp — avoids
    // fragile scheduled-curve cancellation for a small audible difference on
    // very short notes.
    const releaseStart = Math.max(offT, onT + snap.attack + snap.decay);
    gain.gain.setValueAtTime(sustainLevel, releaseStart);
    gain.gain.linearRampToValueAtTime(0.0001, releaseStart + snap.release);
    osc.connect(filt); filt.connect(gain); gain.connect(dest);
    osc.start(onT);
    const stopAt = releaseStart + snap.release + 0.02;
    osc.stop(stopAt);

    // Reproduce this note's vibrato (it was captured in the snapshot).
    if (snap.vibDepth > 0) {
      const vibLfo = ctx.createOscillator();
      vibLfo.type = 'sine';
      vibLfo.frequency.value = snap.vibRate;
      const vibGain = ctx.createGain();
      vibGain.gain.value = snap.vibDepth;
      vibLfo.connect(vibGain); vibGain.connect(osc.detune);
      vibLfo.start(onT);
      vibLfo.stop(stopAt); // explicit stop — offline needs a finite source
    }
    return stopAt;
  }

  // How long a recorded take runs, including its release tails.
  function takeDuration(events) {
    let end = 0;
    (events || []).forEach(e => {
      const off = e.offT != null ? e.offT : e.onT + 1;
      end = Math.max(end, Math.max(off, e.onT + e.snap.attack + e.snap.decay) + e.snap.release);
    });
    return end;
  }

  window.SynthEngine = { midiToFreq, makeReverbIR, tanhCurve, makeFxChain, scheduleVoice, takeDuration };
})();
console.log('Ghost Circuit synth engine ready');
