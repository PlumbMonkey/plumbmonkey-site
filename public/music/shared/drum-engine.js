// ============================================================
// GHOST CIRCUIT — shared drum engine
// The synthesized drum voices, track list and GM map, lifted out of
// drum.js so three places can share them:
//   · the Drum Machine   (live playback + export)
//   · the Synth          (backing beat while you noodle)
//   · the Song view      (arrangement playback + export)
// Every voice takes (ctx, dest, t, v) rather than closing over a live
// context, so the same functions drive live audio AND offline renders.
// ============================================================

(function () {
  function noiseBuffer(ctx, dur) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function env(gain, t, peak, dur, release) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + (release || 0));
  }

  const VOICES = {
    kick(ctx, dest, t, v) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      env(g, t, 0.9 * v, 0.28);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.4);
    },
    snare(ctx, dest, t, v) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.2);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800;
      const ng = ctx.createGain(); env(ng, t, 0.6 * v, 0.12);
      n.connect(bp); bp.connect(ng); ng.connect(dest); n.start(t); n.stop(t + 0.2);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 200; env(og, t, 0.4 * v, 0.09);
      o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.15);
    },
    clap(ctx, dest, t, v) {
      [0, 0.012, 0.024].forEach(off => {
        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.1);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200;
        const g = ctx.createGain(); env(g, t + off, 0.5 * v, 0.06);
        n.connect(bp); bp.connect(g); g.connect(dest); n.start(t + off); n.stop(t + off + 0.1);
      });
    },
    chat(ctx, dest, t, v) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.05);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain(); env(g, t, 0.35 * v, 0.03);
      n.connect(hp); hp.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.06);
    },
    ohat(ctx, dest, t, v) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.35);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain(); env(g, t, 0.3 * v, 0.28);
      n.connect(hp); hp.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.4);
    },
    ltom(ctx, dest, t, v) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(65, t + 0.2);
      env(g, t, 0.7 * v, 0.24); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
    },
    htom(ctx, dest, t, v) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.16);
      env(g, t, 0.7 * v, 0.2); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
    },
    cowbell(ctx, dest, t, v) {
      [560, 845].forEach(f => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = f; env(g, t, 0.28 * v, 0.18);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700;
        o.connect(bp); bp.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25);
      });
    }
  };

  const TRACKS = [
    { id: 'kick',    name: 'Kick' },
    { id: 'snare',   name: 'Snare' },
    { id: 'clap',    name: 'Clap' },
    { id: 'chat',    name: 'Closed Hat' },
    { id: 'ohat',    name: 'Open Hat' },
    { id: 'ltom',    name: 'Low Tom' },
    { id: 'htom',    name: 'Hi Tom' },
    { id: 'cowbell', name: 'Cowbell' }
  ];

  // GM percussion map (channel 10) — used for MIDI export
  const GM_NOTE = { kick: 36, snare: 38, clap: 39, chat: 42, ohat: 46, ltom: 45, htom: 50, cowbell: 56 };

  const STEPS = 16;

  function emptyPattern() { return TRACKS.map(() => new Array(STEPS).fill(0)); }

  // Fire every hit on one 16th step. `swing` (0..0.5) pushes odd steps later,
  // exactly as the drum machine's own scheduler does.
  function scheduleStep(ctx, dest, pattern, step, time, opts) {
    const o = opts || {};
    const spb = o.secondsPerStep || 0;
    const swing = o.swing || 0;
    const mutes = o.mutes;
    const t = (step % 2 === 1) ? time + spb * swing : time;
    TRACKS.forEach((tr, ti) => {
      if (!pattern[ti]) return;
      if (pattern[ti][step] && !(mutes && mutes[ti])) VOICES[tr.id](ctx, dest, t, 1);
    });
    return t;
  }

  // Render `loops` passes of a pattern into any context, starting at `startTime`.
  function schedulePattern(ctx, dest, pattern, startTime, tempo, swing, loops) {
    const spb = (60.0 / tempo) / 4;
    for (let loop = 0; loop < (loops || 1); loop++) {
      for (let s = 0; s < STEPS; s++) {
        scheduleStep(ctx, dest, pattern, s, startTime + (loop * STEPS + s) * spb,
          { secondsPerStep: spb, swing: swing });
      }
    }
  }

  window.DrumEngine = { VOICES, TRACKS, GM_NOTE, STEPS, emptyPattern, scheduleStep, schedulePattern };
})();
console.log('Ghost Circuit drum engine ready');
