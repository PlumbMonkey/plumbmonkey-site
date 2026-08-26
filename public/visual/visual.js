// ============================================================
// THE LUMINARIUM — audio-reactive light instrument
// Audio + touch reactive kaleidoscope. Ported from the desktop
// Music Visualizer V2 engine (canvas 2D, no libraries, no backend),
// with a new pointer/touch interaction layer: your finger stirs
// every mirrored segment of the mandala at once.
// Sources: touch/mouse (always on), microphone, or a music file.
// ============================================================

'use strict';

// ---------- Palettes (engine anchors its hue cycle to the first color) ----------
const PALETTES = [
  { name: 'Void Neon',      colors: [[0.05,0.98,0.95],[0.23,0.56,1.0],[0.7,0.28,1.0],[1.0,0.25,0.6],[1.0,0.95,0.2]] },
  { name: 'Cyberpunk',      colors: [[1.0,0.0,1.0],[0.0,1.0,1.0],[1.0,1.0,0.0],[0.5,0.0,1.0],[0.0,1.0,0.5]] },
  { name: 'Solar Flare',    colors: [[0.78,0.02,0.0],[1.0,0.28,0.0],[1.0,0.78,0.0],[1.0,1.0,0.72],[0.92,0.1,0.04]] },
  { name: 'Arctic Pulse',   colors: [[0.75,0.95,1.0],[0.37,0.7,1.0],[0.07,0.44,0.92],[0.03,0.17,0.52],[0.56,1.0,0.92]] },
  { name: 'Deep Sea',       colors: [[0.0,0.0,0.502],[0.0,0.808,0.82],[0.275,0.51,0.706],[0.0,0.42,0.65],[0.53,0.81,0.98]] },
  { name: 'Electric Lotus', colors: [[0.369,0.0,1.0],[0.0,1.0,0.969],[0.922,1.0,0.0],[1.0,0.0,0.867]] },
  { name: 'Acid Forest',    colors: [[0.067,0.6,0.557],[0.22,0.937,0.49],[0.863,0.89,0.357],[0.271,0.714,0.286]] },
  { name: 'Monochrome',     colors: [[1.0,1.0,1.0],[0.72,0.72,0.72],[0.45,0.45,0.45],[0.22,0.22,0.22],[0.6,0.6,0.6]] }
];

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.0001) return 270;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// ---------- Perlin noise (Ken Perlin's improved permutation) ----------
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

class PerlinNoise {
  constructor() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise2D(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];
    return lerp(v,
      lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf)),
      lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1))
    );
  }
}

// ============================================================
// VisualEngine — layered kaleidoscope (Core/Web/Cloud) + bloom,
// polar particle flow field, 4 render modes. Pointer forces are
// applied in wedge-polar space so one touch drives all segments.
// ============================================================
const NOISE_SCALE = 0.003;

const DEFAULT_CONFIG = {
  trailIntensity: 0.025,
  segments: 8,
  audioSensitivity: 1.5,
  colorSpeed: 1.0,
  rotSpeed: 1.0,
  bloomStrength: 0.24,
  exposure: 0.86,
  contrast: 1.09,
  backgroundStrength: 0.82,
  beatScale: 0.025,
  particleDensity: 1,
  fireflyCount: 60,
  fireflyChaosFactor: 0.5,
  fireflyGravity: 0.3,
  fireflyBounciness: 0.72,
  shakeIntensity: 1.0
};

class VisualEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layerCore  = document.createElement('canvas'); this.layerCoreCtx  = this.layerCore.getContext('2d');
    this.layerWeb   = document.createElement('canvas'); this.layerWebCtx   = this.layerWeb.getContext('2d');
    this.layerCloud = document.createElement('canvas'); this.layerCloudCtx = this.layerCloud.getContext('2d');
    this.wedgeCanvas = document.createElement('canvas'); this.wedgeCtx = this.wedgeCanvas.getContext('2d');
    this.bloomCanvas = document.createElement('canvas'); this.bloomCtx = this.bloomCanvas.getContext('2d');
    this.bloomWide = document.createElement('canvas'); this.bloomWideCtx = this.bloomWide.getContext('2d');
    this.toneCanvas = document.createElement('canvas'); this.toneCtx = this.toneCanvas.getContext('2d');
    this.transitionCanvas = document.createElement('canvas'); this.transitionCtx = this.transitionCanvas.getContext('2d');

    this.rotKaleido = 0;
    this.fftData = null;
    this.viewWidth = 1; this.viewHeight = 1;
    this.resolutionScale = 1;
    this.pixelRatio = 1;
    this.width = 1; this.height = 1;
    this.bufferSize = 1;
    this.particles = [];
    this.fireflies = [];
    this.perlin = new PerlinNoise();
    this.config = { ...DEFAULT_CONFIG };
    this.mode = 'firefly-nebula';
    this.hue = 270;
    this.paletteHue = 270;
    this.noiseTime = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.particleCount = 900;
    /** Active pointer wells in wedge-polar space: {r, theta, strength, stir} */
    this.wells = [];
    // Palette-driven starfield/nebula backdrop (fills the dead corners
    // outside the kaleidoscope disc and makes the canvas fully opaque
    // for video capture). Rotates slowly, rebuilt on palette/resize.
    this.bgCanvas = document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.bgRot = 0;
    this.palette = PALETTES[0];
    this.overlay = { show:false, artist:'', track:'', style:'cinema' };
    this.outputOverride = null;
    this.transitionUntil = 0;
    /** When true (recording), adaptive resolution must not resize the canvas */
    this.resolutionLock = false;
  }

  setPalette(palette) {
    this.palette = palette;
    const c = palette.colors[0];
    this.paletteHue = rgbToHue(c[0], c[1], c[2]);
    this.hue = this.paletteHue;
    this.buildBackground();
  }

  resize(width, height) {
    this.viewWidth = Math.max(1, Math.floor(width));
    this.viewHeight = Math.max(1, Math.floor(height));
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.applyRenderSize();
    this.initParticles();
    this.initFireflies();
  }

  setResolutionScale(scale) {
    const next = clamp(scale, 0.5, 1);
    if (Math.abs(next - this.resolutionScale) < 0.001) return;
    this.resolutionScale = next;
    this.applyRenderSize();
    this.initParticles();
    this.initFireflies();
  }

  setConfig(partial) {
    const prevSegments = this.config.segments;
    const prevFireflies = this.config.fireflyCount;
    const prevDensity = this.config.particleDensity;
    this.config = { ...this.config, ...partial };
    if (partial.segments !== undefined && partial.segments !== prevSegments) {
      this.initParticles();
      this.initFireflies();
    }
    if (partial.fireflyCount !== undefined && partial.fireflyCount !== prevFireflies) {
      this.initFireflies();
    }
    if (partial.particleDensity !== undefined && partial.particleDensity !== prevDensity) {
      this.particleCount = Math.round(clamp((this.viewWidth * this.viewHeight) / 600 * this.config.particleDensity, 280, 1500));
      this.initParticles();
    }
  }

  setMode(mode) {
    if (mode !== this.mode && this.canvas.width > 1 && this.canvas.height > 1) {
      this.transitionCtx.clearRect(0, 0, this.transitionCanvas.width, this.transitionCanvas.height);
      this.transitionCtx.drawImage(this.canvas, 0, 0, this.transitionCanvas.width, this.transitionCanvas.height);
      this.transitionUntil = performance.now() + 760;
    }
    this.mode = mode;
    // No layer clearing: the destination-out trail fade dissolves the old
    // mode over ~a second while the new one draws in — a free crossfade.
    if (mode === 'firefly-nebula' && this.fireflies.length !== this.config.fireflyCount) {
      this.initFireflies();
    }
  }

  setOverlay(overlay) {
    this.overlay = { ...this.overlay, ...overlay };
  }

  setOutputSize(width, height) {
    this.outputOverride = { width:Math.max(1, Math.round(width)), height:Math.max(1, Math.round(height)) };
    this.resolutionScale = 1;
    this.applyRenderSize();
    this.initParticles();
    this.initFireflies();
  }

  clearOutputSize() {
    this.outputOverride = null;
    this.applyRenderSize();
    this.initParticles();
    this.initFireflies();
  }

  applyRenderSize() {
    this.width  = this.outputOverride ? this.outputOverride.width : Math.max(1, Math.floor(this.viewWidth  * this.pixelRatio * this.resolutionScale));
    this.height = this.outputOverride ? this.outputOverride.height : Math.max(1, Math.floor(this.viewHeight * this.pixelRatio * this.resolutionScale));
    // Oversized square buffers: content at any rotation is never clipped
    this.bufferSize = Math.ceil(Math.hypot(this.width, this.height));
    this.canvas.width = this.width; this.canvas.height = this.height;
    this.bloomCanvas.width = this.width; this.bloomCanvas.height = this.height;
    this.toneCanvas.width = this.width; this.toneCanvas.height = this.height;
    this.transitionCanvas.width = this.width; this.transitionCanvas.height = this.height;
    for (const c of [this.layerCore, this.layerWeb, this.layerCloud, this.wedgeCanvas]) {
      c.width = this.bufferSize; c.height = this.bufferSize;
    }
    // bg is a square at the diagonal size so it covers the frame at any rotation
    this.bgCanvas.width = this.bgCanvas.height = this.bufferSize;
    this.buildBackground();
    // Particle budget scales with CSS-pixel area (NOT device pixels — a
    // dPR-2 phone would otherwise get a bigger budget than a desktop)
    this.particleCount = Math.round(clamp((this.viewWidth * this.viewHeight) / 600 * this.config.particleDensity, 280, 1500));
  }

  initParticles() {
    const angleStep = (Math.PI * 2) / this.config.segments;
    const maxR = this.bufferSize / 2;
    this.particles = Array.from({ length: this.particleCount }, () => {
      const r = Math.random() * maxR;
      const theta = Math.random() * angleStep;
      return { r, theta, pr: r, ptheta: theta, vr: 0, vtheta: 0,
               hueOffset: (Math.random() - 0.5) * 80,
               size: 0.5 + Math.random() * 1.5 };
    });
  }

  initFireflies() {
    const angleStep = (Math.PI * 2) / this.config.segments;
    const maxR = this.bufferSize / 2;
    const count = clamp(Math.round(this.config.fireflyCount), 10, 200);
    this.fireflies = Array.from({ length: count }, () => {
      const r = (0.06 + Math.random() * 0.88) * maxR;
      const theta = Math.random() * angleStep;
      return {
        r, theta,
        vr: (Math.random() - 0.5) * 1.4,
        vtheta: (Math.random() - 0.5) * 0.007,
        size: 1.5 + Math.random() * 3.0,
        hueOffset: (Math.random() - 0.5) * 120,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.018 + Math.random() * 0.038
      };
    });
  }

  polarToXY(r, theta) {
    const bcx = this.bufferSize / 2;
    return [bcx + r * Math.cos(theta), bcx + r * Math.sin(theta)];
  }

  /** Pre-render the starfield + nebula backdrop from the ACTIVE palette.
   *  Uses palette colors [1..n] — previously dead data (only color 0's hue
   *  was ever read) — so switching palettes now changes the whole scene. */
  buildBackground() {
    const sz = this.bgCanvas.width;
    if (sz < 2) return;
    const ctx = this.bgCtx;
    const cols = this.palette.colors;
    const rgba = (c, a) =>
      'rgba(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ',' + a.toFixed(3) + ')';
    // Near-black base tinted toward the palette's darkest color
    let dark = cols[0];
    for (const c of cols) { if (c[0]+c[1]+c[2] < dark[0]+dark[1]+dark[2]) dark = c; }
    ctx.fillStyle = 'rgba(' + Math.round(dark[0]*14) + ',' + Math.round(dark[1]*14) + ',' + Math.round(dark[2]*18) + ',1)';
    ctx.fillRect(0, 0, sz, sz);
    // Nebula wisps: soft radial gradients from the unused palette colors.
    // Deterministic placement (no Math.random) so rebuilds don't "jump".
    const wisps = [[0.24, 0.30, 0.42], [0.72, 0.62, 0.36], [0.55, 0.18, 0.30], [0.32, 0.78, 0.26]];
    for (let i = 0; i < wisps.length; i++) {
      const c = cols[1 + (i % (cols.length - 1))];
      const [wx, wy, wr] = wisps[i];
      const g = ctx.createRadialGradient(wx*sz, wy*sz, 0, wx*sz, wy*sz, wr*sz);
      g.addColorStop(0, rgba(c, 0.085));
      g.addColorStop(0.6, rgba(c, 0.03));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, sz, sz);
    }
    // Starfield: deterministic pseudo-random scatter, palette-tinted whites
    let seed = 1234567;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const count = Math.round(clamp(sz / 5, 120, 320));
    for (let i = 0; i < count; i++) {
      const x = rand() * sz, y = rand() * sz;
      const r = 0.4 + rand() * rand() * 1.6;
      const a = 0.25 + rand() * 0.6;
      const c = cols[Math.floor(rand() * cols.length)];
      ctx.fillStyle = 'rgba(' + Math.round(140 + c[0]*115) + ',' + Math.round(140 + c[1]*115) + ',' + Math.round(140 + c[2]*115) + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // Pointer wells — convert screen-space pointers into wedge-polar space.
  // The kaleidoscope mirrors one source wedge N times, so folding the pointer's
  // angle back into the wedge makes one finger stir ALL mirrored segments.
  // wells: [{x, y, strength (-1 repel .. +1 attract), vx, vy}] in CANVAS pixels.
  // ---------------------------------------------------------------------------
  setPointerWells(pointerList) {
    // Neon Comet draws in SCREEN space (it has to literally sit under the
    // finger), so it needs the untransformed list as well as the polar wells.
    this.rawPointers = pointerList;
    const cx = this.width / 2, cy = this.height / 2;
    const angleStep = (Math.PI * 2) / this.config.segments;
    this.wells = pointerList.map(p => {
      const dx = p.x - cx, dy = p.y - cy;
      const r = Math.hypot(dx, dy);
      let theta = Math.atan2(dy, dx) - this.rotKaleido;
      theta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const k = Math.floor(theta / angleStep);
      let local = theta - k * angleStep;
      if (k % 2 === 1) local = angleStep - local;   // mirrored segments flip
      // Tangential stir from pointer velocity (swipe = spin the mandala)
      const stir = (dx * p.vy - dy * p.vx) / Math.max(1, r) * 0.002;
      return { r, theta: clamp(local, 0, angleStep), strength: p.strength, stir };
    });
  }

  /** Attract/stir the polar bodies (particles or fireflies) toward each well.
   *  Long range pulls IN, close range pushes OUT — bodies orbit the finger in
   *  a living ring instead of stacking into one additive-blend hotspot. */
  applyWellForces(body, radialGain, angularGain) {
    for (const w of this.wells) {
      const dr = w.r - body.r;
      const dt = (w.theta - body.theta) * Math.max(40, body.r);
      const dSq = dr * dr + dt * dt;
      const falloff = 1 / (1 + dSq * 0.00012);         // soft long-range pull
      const f = w.strength * falloff;
      body.vr     += dr * f * radialGain;
      body.vtheta += (w.theta - body.theta) * f * angularGain + w.stir * falloff;
    }
  }

  render(params, beat, fftData) {
    this.fftData = fftData || null;
    const { segments, audioSensitivity, colorSpeed, rotSpeed, trailIntensity } = this.config;
    const W = this.width, H = this.height;
    const cx = W / 2, cy = H / 2;

    const bass   = clamp(params.pulse, 0, 1);
    const mid    = clamp((params.warp - 1.2) / 1.2, 0, 1);
    const treble = clamp((params.glow - 1.0) / 0.8, 0, 1);

    this.hue = (this.hue + colorSpeed * (0.4 + mid * 3.0)) % 360;

    if (beat && this.config.shakeIntensity > 0) {
      const amt = this.config.shakeIntensity * audioSensitivity * 7;
      this.shakeX = (Math.random() - 0.5) * amt;
      this.shakeY = (Math.random() - 0.5) * amt;
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }

    const beatScale = beat ? 1 + this.config.beatScale : 1.0;
    const bassScale = 1.0 + bass * audioSensitivity * 0.05;
    const speedMult = 1 + treble * audioSensitivity * 3.5;

    const rotationBoost = audioMapping.mid === 'rotation' ? 1 + mid * 2.5 : 1;
    this.rotKaleido = (this.rotKaleido + rotSpeed * rotationBoost * (0.006 + bass * 0.012)) % (Math.PI * 2);

    // Fade each layer at its own persistence
    const bsz = this.bufferSize;
    const fades = [
      [this.layerCoreCtx,  trailIntensity * 0.55],
      [this.layerWebCtx,   trailIntensity],
      [this.layerCloudCtx, Math.min(1, trailIntensity * 1.8)]
    ];
    for (const [lCtx, alpha] of fades) {
      lCtx.globalCompositeOperation = 'destination-out';
      lCtx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
      lCtx.fillRect(0, 0, bsz, bsz);
      lCtx.globalCompositeOperation = 'source-over';
    }

    this.drawBaseLayer();

    switch (this.mode) {
      case 'neural-strings':  this.renderNeuralStrings(bass, mid, treble, speedMult); break;
      case 'geometric-pulse': this.renderGeometricPulse(bass, mid, treble, beat, speedMult); break;
      case 'fractal-warp':    this.renderFractalWarp(bass, mid, treble, beat, params.warp); break;
      case 'firefly-nebula':  this.renderFireflyNebula(bass, mid, treble); break;
      case 'spectrum-ring':   this.renderSpectrumRing(bass, mid, treble, beat); break;
      case 'wave-mirror':     this.renderWaveMirror(bass, mid, treble); break;
      case 'particle-galaxy': this.renderParticleGalaxy(bass, mid, treble, speedMult); break;
      case 'laser-grid':      this.renderLaserGrid(bass, mid, treble, beat); break;
      case 'liquid-ribbons':  this.renderLiquidRibbons(bass, mid, treble); break;
      case 'aurora-curtains': this.renderAuroraCurtains(bass, mid, treble); break;
      case 'tunnel-flight':   this.renderTunnelFlight(bass, mid, treble, beat); break;
      case 'starfield-pulse': this.renderStarfieldPulse(bass, mid, treble, speedMult); break;
    }

    const ctx = this.ctx;
    const angleStep = (Math.PI * 2) / segments;
    ctx.clearRect(0, 0, W, H);
    // Drifting starfield/nebula backdrop (also makes every pixel opaque
    // so WebM recordings never hit transparent-canvas black artifacts)
    this.bgRot = (this.bgRot + 0.00035 + bass * 0.0005) % (Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.bgRot);
    ctx.globalAlpha = this.config.backgroundStrength;
    ctx.drawImage(this.bgCanvas, -this.bufferSize / 2, -this.bufferSize / 2);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + this.shakeX, cy + this.shakeY);
    ctx.scale(beatScale * bassScale, beatScale * bassScale);
    this.stampLayer(this.layerCore,  segments, angleStep, this.rotKaleido);
    this.stampLayer(this.layerWeb,   segments, angleStep, this.rotKaleido);
    this.stampLayer(this.layerCloud, segments, angleStep, this.rotKaleido);
    ctx.restore();
    // Screen-space pass — must land after the kaleidoscope stamp but before
    // bloom, so the comet picks up the same glow as everything else.
    if (this.mode === 'neon-comet') this.renderNeonComet(W, H, bass, mid, treble, beat);
    if (effectState.bloom) this.applyBloom(W, H, treble);
    this.applyTone(W, H);
    if (performance.now() < this.transitionUntil) {
      const alpha = clamp((this.transitionUntil - performance.now()) / 760, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * alpha;
      ctx.drawImage(this.transitionCanvas, 0, 0, W, H);
      ctx.restore();
    }
    this.drawOverlay(W, H);
    this.applyEffects(W, H, beat);
  }

  // ---------------------------------------------------------------------------
  // NEON COMET — a glowing ribbon that literally follows the pointer, ported
  // from the Wraithveil Neon Mouse effect. Unlike the other twelve modes this
  // one draws in SCREEN space after the kaleidoscope stamp: a mirrored comet
  // would no longer be "following your finger", which is the whole point.
  //
  // It still belongs to The Luminarium rather than being a bolt-on: the ribbon
  // is tinted from the active palette, its width and glow ride the audio
  // bands, and a beat (or a fresh touch) detonates the head into particles
  // that swirl back together. Multi-touch gets one ribbon per finger.
  // ---------------------------------------------------------------------------
  paletteColor(i) {
    const cols = this.palette.colors;
    const c = cols[((i % cols.length) + cols.length) % cols.length];
    return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
  }

  renderNeonComet(W, H, bass, mid, treble, beat) {
    const ctx = this.ctx;
    const now = performance.now();
    if (!this.cometTrails) {
      this.cometTrails = new Map();
      this.cometParticles = [];
      this.cometSeen = new Set();
      this.cometIdleT = Math.random() * 100;
    }

    const pts = this.rawPointers || [];
    const TRAIL_MS = 260 + mid * 220;      // busier mix = longer streak

    // With nothing touching the screen the mode would be empty, so an idle
    // comet drifts on Perlin paths — it also keeps the scene alive in the
    // auto-rotation and on desktop before the visitor moves the mouse.
    let heads;
    if (pts.length) {
      heads = pts.map(p => ({ id: p.id, x: p.x, y: p.y }));
    } else {
      this.cometIdleT += 0.0016 + bass * 0.004;
      const nx = this.perlin.noise2D(this.cometIdleT, 0);
      const ny = this.perlin.noise2D(0, this.cometIdleT * 1.13);
      heads = [{
        id: '__idle',
        x: W / 2 + nx * W * 0.36,
        y: H / 2 + ny * H * 0.34
      }];
    }

    // Extend each head's ribbon, and detonate on a brand-new contact.
    const live = new Set();
    for (const h of heads) {
      live.add(h.id);
      let tr = this.cometTrails.get(h.id);
      if (!tr) { tr = []; this.cometTrails.set(h.id, tr); }
      tr.push({ x: h.x, y: h.y, t: now });
      while (tr.length && now - tr[0].t > TRAIL_MS) tr.shift();
      if (!this.cometSeen.has(h.id) && h.id !== '__idle') this.explodeComet(h.x, h.y, 18);
    }
    if (beat && heads.length) {
      const h = heads[0];
      this.explodeComet(h.x, h.y, 12 + Math.round(bass * 14));
    }
    this.cometSeen = live;

    // Retire ribbons whose finger has lifted (let them age out, not vanish).
    this.cometTrails.forEach((tr, id) => {
      if (live.has(id)) return;
      while (tr.length && now - tr[0].t > TRAIL_MS) tr.shift();
      if (!tr.length) this.cometTrails.delete(id);
    });

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // ---- ribbons ----
    let ci = 0;
    this.cometTrails.forEach(tr => {
      const [r, g, b] = this.paletteColor(ci++);
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], c = tr[i];
        const age = clamp((now - c.t) / TRAIL_MS, 0, 1);
        const alpha = (0.42 * (1 - age) + 0.08) * (0.55 + treble * 0.75);
        ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
        ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.9).toFixed(3) + ')';
        ctx.shadowBlur = 12 + 30 * (1 - age) * (0.5 + bass);
        ctx.lineWidth = (7 * (1 - age) + 1.5) * (0.7 + bass * 0.9);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    });

    // ---- glowing head on each ribbon ----
    ci = 0;
    this.cometTrails.forEach(tr => {
      const [r, g, b] = this.paletteColor(ci++);
      const head = tr[tr.length - 1];
      if (!head) return;
      const rad = (7 + bass * 16) * (1 + treble * 0.5);
      ctx.beginPath();
      ctx.arc(head.x, head.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.30)';
      ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.95)';
      ctx.shadowBlur = 34 * (1 + bass * 1.6);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(head.x, head.y, rad * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = 14;
      ctx.fill();
    });

    // ---- particles: fly out, swirl, return to the nearest head ----
    const target = this.cometTrails.size
      ? (this.cometTrails.values().next().value.slice(-1)[0] || null) : null;
    for (let i = this.cometParticles.length - 1; i >= 0; i--) {
      const p = this.cometParticles[i];
      const el = now - p.born;
      if (el > 2600) { this.cometParticles.splice(i, 1); continue; }

      if (el < p.delay) {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.95; p.vy *= 0.95;
      } else if (target) {
        const dx = target.x - p.x, dy = target.y - p.y;
        const dist = Math.hypot(dx, dy) + 0.1;
        const swirl = 0.5 * Math.exp(-(el - p.delay) / 420);
        const sa = Math.atan2(dy, dx) + Math.PI / 2;
        p.vx += (dx / dist) * 0.42 + Math.cos(sa) * swirl;
        p.vy += (dy / dist) * 0.42 + Math.sin(sa) * swirl;
        p.vx *= 0.90; p.vy *= 0.90;
        p.x += p.vx; p.y += p.vy;
        if (dist < 9) { this.cometParticles.splice(i, 1); continue; }
      } else {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy *= 0.97;
      }

      const life = 1 - clamp(el / 2600, 0, 1);
      const [r, g, b] = this.paletteColor(p.ci);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, 3.1 * life * (0.6 + treble)), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.85 * life).toFixed(3) + ')';
      ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + life.toFixed(3) + ')';
      ctx.shadowBlur = 18 * life;
      ctx.fill();
    }

    ctx.restore();
  }

  explodeComet(x, y, count) {
    if (!this.cometParticles) this.cometParticles = [];
    // Hard cap — a fast tapper on a phone can otherwise stack bursts until the
    // additive fill rate tanks the frame rate. Trim the batch, don't overshoot.
    const room = 300 - this.cometParticles.length;
    if (room <= 0) return;
    count = Math.min(count, room);
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      this.cometParticles.push({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        born: now,
        delay: 260 + i * 22 + Math.random() * 120,
        ci: Math.floor(Math.random() * this.palette.colors.length)
      });
    }
  }

  drawOverlay(W, H) {
    const o = this.overlay;
    if (!o.show || (!o.artist && !o.track)) return;
    const ctx = this.ctx;
    const scale = Math.max(.7, Math.min(W, H) / 700);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 18 * scale;
    if (o.style === 'lower') {
      const x = W * .07, y = H * .82;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(7,7,10,.72)';
      ctx.fillRect(x - 18*scale, y - 42*scale, Math.min(W*.62, 560*scale), 86*scale);
      ctx.fillStyle = '#e8c77f';
      ctx.fillRect(x - 18*scale, y - 42*scale, 3*scale, 86*scale);
      ctx.fillStyle = '#f4efe5';
      ctx.font = `600 ${Math.round(25*scale)}px Georgia,serif`;
      ctx.fillText(o.track || 'Untitled track', x, y - 5*scale);
      ctx.fillStyle = '#c3bbae';
      ctx.font = `600 ${Math.round(10*scale)}px system-ui,sans-serif`;
      ctx.fillText((o.artist || 'Unknown artist').toUpperCase(), x, y + 21*scale);
    } else if (o.style === 'editorial') {
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(232,199,127,.72)';
      ctx.lineWidth = Math.max(1, scale);
      ctx.strokeRect(W*.055, H*.07, W*.89, H*.86);
      ctx.fillStyle = '#f4efe5';
      ctx.font = `500 ${Math.round(32*scale)}px Georgia,serif`;
      ctx.fillText(o.track || 'Untitled track', W/2, H*.52);
      ctx.fillStyle = '#d8c28e';
      ctx.font = `600 ${Math.round(10*scale)}px system-ui,sans-serif`;
      ctx.fillText((o.artist || 'Unknown artist').toUpperCase(), W/2, H*.52 + 28*scale);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f4efe5';
      ctx.font = `600 ${Math.round(28*scale)}px Georgia,serif`;
      ctx.fillText((o.track || 'Untitled track').toUpperCase(), W/2, H*.84);
      ctx.fillStyle = '#d7cfbf';
      ctx.font = `600 ${Math.round(11*scale)}px system-ui,sans-serif`;
      ctx.fillText((o.artist || 'Unknown artist').toUpperCase(), W/2, H*.84 + 24*scale);
    }
    ctx.restore();
  }

  applyEffects(W, H, beat) {
    const s = effectState.strength;
    const ctx = this.ctx;
    if (effectState.mirrorX || effectState.flipY || effectState.blur || effectState.chromatic) {
      this.bloomCanvas.width = W; this.bloomCanvas.height = H;
      this.bloomCtx.clearRect(0,0,W,H);
      this.bloomCtx.drawImage(this.canvas,0,0);
      ctx.save();
      ctx.clearRect(0,0,W,H);
      ctx.translate(effectState.mirrorX ? W : 0, effectState.flipY ? H : 0);
      ctx.scale(effectState.mirrorX ? -1 : 1, effectState.flipY ? -1 : 1);
      ctx.filter = effectState.blur ? `blur(${(1+s*4).toFixed(1)}px)` : 'none';
      ctx.drawImage(this.bloomCanvas,0,0);
      ctx.filter='none'; ctx.restore();
      if (effectState.chromatic) {
        ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=.18*s;
        ctx.drawImage(this.bloomCanvas,-5*s,0); ctx.drawImage(this.bloomCanvas,5*s,0); ctx.restore();
      }
    }
    if (effectState.vignette) {
      const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.7);
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,`rgba(0,0,0,${.35+.45*s})`);
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    }
    if (effectState.grain) {
      ctx.save();ctx.globalAlpha=.08*s;
      for(let i=0;i<Math.min(900,W*H/900);i++){const v=Math.random()>0.5?255:80;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(Math.random()*W,Math.random()*H,1.5,1.5);}
      ctx.restore();
    }
    if (effectState.glitch && Math.random()<.06+s*.08) {
      const y=Math.random()*H,h=4+Math.random()*H*.06,dx=(Math.random()-.5)*35*s;
      ctx.drawImage(this.canvas,0,y,W,h,dx,y,W,h);
    }
    if (effectState.flicker) {
      ctx.fillStyle=`rgba(255,255,255,${Math.random()*.025*s})`;ctx.fillRect(0,0,W,H);
    }
    if (((effectState.strobe || audioMapping.beat === 'flash') && beat) || performance.now() < sceneFlashUntil) {
      ctx.fillStyle=`rgba(255,255,255,${.12+.38*s})`;ctx.fillRect(0,0,W,H);
    }
  }

  applyTone(W, H) {
    const exposure = clamp(this.config.exposure, .68, 1.18);
    const contrast = clamp(this.config.contrast, .88, 1.28);
    if (Math.abs(exposure - 1) < .005 && Math.abs(contrast - 1) < .005) return;
    this.toneCtx.clearRect(0, 0, W, H);
    this.toneCtx.drawImage(this.canvas, 0, 0);
    this.ctx.save();
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.filter = `brightness(${exposure}) contrast(${contrast})`;
    this.ctx.drawImage(this.toneCanvas, 0, 0);
    this.ctx.filter = 'none';
    this.ctx.restore();
  }

  stampLayer(layer, segments, angleStep, rotOffset) {
    const bsz = this.bufferSize;
    const bcx = bsz / 2;
    const wCtx = this.wedgeCtx;
    wCtx.clearRect(0, 0, bsz, bsz);
    wCtx.save();
    wCtx.translate(bcx, bcx);
    wCtx.beginPath();
    wCtx.moveTo(0, 0);
    wCtx.arc(0, 0, bcx, 0, angleStep);
    wCtx.closePath();
    wCtx.clip();
    wCtx.drawImage(layer, -bcx, -bcx);
    wCtx.restore();

    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segments; i++) {
      ctx.save();
      if (i % 2 === 0) {
        ctx.rotate(rotOffset + angleStep * i);
      } else {
        ctx.rotate(rotOffset + angleStep * (i + 1));
        ctx.scale(1, -1);
      }
      ctx.drawImage(this.wedgeCanvas, -bcx, -bcx);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  applyBloom(W, H, treble) {
    // Two-pass bloom: tight hot halo + wide low-opacity falloff, so the
    // glow rolls off naturally instead of one blur radius doing all the work
    // Pass 1: tight hot halo (the original bloom)
    this.bloomCtx.clearRect(0, 0, W, H);
    this.bloomCtx.filter = 'blur(' + (8 + treble * 20).toFixed(1) + 'px)';
    this.bloomCtx.drawImage(this.canvas, 0, 0);
    this.bloomCtx.filter = 'none';
    // Pass 2: wide falloff at QUARTER resolution — a 40-70px blur at full res
    // can stall software-rendered canvases; 1/16 the pixels + 1/4 the radius
    // upscaled looks identical for a wide soft glow. Both passes snapshot the
    // pristine frame before anything is composited back.
    const sw = Math.max(1, W >> 2), sh = Math.max(1, H >> 2);
    if (this.bloomWide.width !== sw || this.bloomWide.height !== sh) {
      this.bloomWide.width = sw; this.bloomWide.height = sh;
    }
    this.bloomWideCtx.clearRect(0, 0, sw, sh);
    this.bloomWideCtx.filter = 'blur(' + ((42 + treble * 26) / 4).toFixed(1) + 'px)';
    this.bloomWideCtx.drawImage(this.canvas, 0, 0, sw, sh);
    this.bloomWideCtx.filter = 'none';
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const strength = this.config.bloomStrength;
    ctx.globalAlpha = strength * (0.28 + treble * 0.42);
    ctx.drawImage(this.bloomCanvas, 0, 0);
    ctx.globalAlpha = strength * (0.13 + treble * 0.12);
    ctx.drawImage(this.bloomWide, 0, 0, W, H);
    ctx.restore();
  }

  buildFFTGradient(ctx, cx, cy, maxR) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    const fft = this.fftData;
    const STOPS = 10;
    for (let s = 0; s <= STOPS; s++) {
      const t = s / STOPS;
      let mag;
      if (fft && fft.length > 0) {
        const binIdx = Math.min(fft.length - 1, Math.floor(Math.sqrt(t) * fft.length * 0.68));
        mag = fft[binIdx] / 255;
      } else {
        mag = 0.09 * (1 - t * 0.7);   // dimmer static backdrop in touch mode
      }
      const hue = 30 + t * 240;
      const lit = 12 + mag * 58;
      const alpha = 0.03 + mag * 0.30;
      grad.addColorStop(t, 'hsla(' + (hue | 0) + ',100%,' + (lit | 0) + '%,' + alpha.toFixed(3) + ')');
    }
    return grad;
  }

  drawBaseLayer() {
    const bcx = this.bufferSize / 2;
    const lCtx = this.layerCoreCtx;
    lCtx.fillStyle = this.buildFFTGradient(lCtx, bcx, bcx, bcx);
    lCtx.fillRect(0, 0, this.bufferSize, this.bufferSize);
  }

  // ---- Mode: Neural Strings ----
  renderNeuralStrings(bass, mid, treble, speedMult) {
    const { audioSensitivity, segments } = this.config;
    const cCtx = this.layerCoreCtx, wCtx = this.layerWebCtx, clCtx = this.layerCloudCtx;
    const angleStep = (Math.PI * 2) / segments;
    const maxR = this.bufferSize / 2;
    const breathe = 1.0 + bass * audioSensitivity * 0.22 + mid * audioSensitivity * 0.1;

    this.noiseTime += 0.004;
    for (const c of [cCtx, wCtx, clCtx]) { c.lineCap = 'round'; c.lineJoin = 'round'; }
    const connDistSq = (maxR * 0.055) ** 2;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.pr = p.r; p.ptheta = p.theta;

      const nx = p.r * Math.cos(p.theta) * NOISE_SCALE + this.noiseTime;
      const ny = p.r * Math.sin(p.theta) * NOISE_SCALE + this.noiseTime * 0.71;
      const noiseA = this.perlin.noise2D(nx, ny);
      const noiseB = this.perlin.noise2D(nx * 2.1 + 5.3, ny * 2.1 - 3.1);

      p.vr     = p.vr     * 0.78 + (noiseA * 2.2 + (bass - 0.5) * 1.8) * speedMult;
      p.vtheta = p.vtheta * 0.78 + noiseB * 0.018 * speedMult;
      this.applyWellForces(p, 0.06, 0.05);
      p.r += p.vr;
      p.theta += p.vtheta;

      if (p.r > maxR)          { p.r = maxR;          p.vr *= -0.6; }
      if (p.r < 0)             { p.r = 0;             p.vr = Math.abs(p.vr); }
      if (p.theta > angleStep) { p.theta = angleStep; p.vtheta *= -0.6; }
      if (p.theta < 0)         { p.theta = 0;         p.vtheta = Math.abs(p.vtheta); }

      const a1 = this.polarToXY(p.pr * breathe, p.ptheta);
      const a2 = this.polarToXY(p.r * breathe, p.theta);
      const hue = (this.hue + p.hueOffset) % 360;
      const L = 52 + treble * 28;

      cCtx.beginPath(); cCtx.moveTo(a1[0], a1[1]); cCtx.lineTo(a2[0], a2[1]);
      cCtx.strokeStyle = 'hsla(' + hue + ',100%,' + L + '%,' + (0.12 + bass * audioSensitivity * 0.18).toFixed(3) + ')';
      cCtx.lineWidth = p.size * (2.0 + bass * audioSensitivity * 4.0);
      cCtx.stroke();

      clCtx.beginPath(); clCtx.moveTo(a1[0], a1[1]); clCtx.lineTo(a2[0], a2[1]);
      clCtx.strokeStyle = 'hsla(' + hue + ',100%,' + (L + 15) + '%,' + (0.5 + treble * 0.42).toFixed(3) + ')';
      clCtx.lineWidth = p.size * (0.4 + treble * audioSensitivity * 1.1);
      clCtx.stroke();

      for (let j = i + 1; j < Math.min(i + 14, this.particles.length); j++) {
        const q = this.particles[j];
        const dr = p.r - q.r;
        const dt = (p.theta - q.theta) * p.r;
        const dSq = dr * dr + dt * dt;
        if (dSq < connDistSq) {
          const t = 1 - Math.sqrt(dSq) / Math.sqrt(connDistSq);
          const b = this.polarToXY(q.r * breathe, q.theta);
          wCtx.beginPath(); wCtx.moveTo(a2[0], a2[1]); wCtx.lineTo(b[0], b[1]);
          wCtx.strokeStyle = 'hsla(' + (((hue + (this.hue + q.hueOffset)) * 0.5) | 0) + ',100%,72%,' + (t * mid * 0.65).toFixed(3) + ')';
          wCtx.lineWidth = t * (0.8 + mid * audioSensitivity * 2.0);
          wCtx.stroke();
        }
      }
    }
  }

  // ---- Mode: Geometric Pulse ----
  renderGeometricPulse(bass, mid, treble, beat, speedMult) {
    const { audioSensitivity, segments } = this.config;
    const cx = this.bufferSize / 2, cy = cx;
    const cCtx = this.layerCoreCtx, wCtx = this.layerWebCtx, clCtx = this.layerCloudCtx;
    const angleStep = (Math.PI * 2) / segments;
    const breathe = 1.0 + bass * audioSensitivity * 0.28 + mid * audioSensitivity * 0.14 + treble * audioSensitivity * 0.08;

    this.noiseTime += 0.006 * speedMult;
    const maxR = cx * 0.9;
    for (const c of [cCtx, wCtx, clCtx]) { c.lineCap = 'round'; c.lineJoin = 'round'; }

    // Pointer wells expand the rings near their radius — touch ripples outward
    let wellBoost = 0;
    for (const w of this.wells) wellBoost += w.strength * 0.12;

    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const isCore = i < 3;
      const isWeb = i >= 3 && i < 7;
      const band = isCore ? bass : isWeb ? mid : treble;
      const layerCtx = isCore ? cCtx : isWeb ? wCtx : clCtx;

      const r = maxR * (t * 0.85 + 0.08) * (breathe + wellBoost)
              * (0.80 + band * audioSensitivity * 0.5)
              * (beat && isCore ? 1.12 : 1.0);
      const rot = this.noiseTime * (i % 2 === 0 ? 1 : -1) * (0.18 + i * 0.07);
      const hue = (this.hue + i * 28) % 360;
      const alpha = 0.4 + band * 0.6;
      const lw = 1.2 + band * audioSensitivity * 3.0;

      const steps = 60;
      layerCtx.beginPath();
      for (let j = 0; j <= steps; j++) {
        const theta = (j / steps) * angleStep + rot;
        const x = cx + r * Math.cos(theta), y = cy + r * Math.sin(theta);
        if (j === 0) layerCtx.moveTo(x, y); else layerCtx.lineTo(x, y);
      }
      layerCtx.strokeStyle = 'hsla(' + hue + ',100%,80%,' + (alpha * 0.4).toFixed(3) + ')';
      layerCtx.lineWidth = lw * 3.5;
      layerCtx.stroke();
      layerCtx.strokeStyle = 'hsla(' + hue + ',100%,' + (55 + treble * 32) + '%,' + alpha.toFixed(3) + ')';
      layerCtx.lineWidth = lw;
      layerCtx.stroke();

      if (isWeb) {
        const spokeCount = 3 + i;
        wCtx.strokeStyle = 'hsla(' + ((hue + 60) % 360) + ',100%,70%,' + (alpha * 0.35).toFixed(3) + ')';
        wCtx.lineWidth = lw * 0.5;
        for (let s = 0; s < spokeCount; s++) {
          const theta = (s / spokeCount) * angleStep + rot;
          wCtx.beginPath();
          wCtx.moveTo(cx, cy);
          wCtx.lineTo(cx + r * Math.cos(theta), cy + r * Math.sin(theta));
          wCtx.stroke();
        }
      }
    }
  }

  // ---- Mode: Fractal Warp ----
  renderFractalWarp(bass, mid, treble, beat, warpParam) {
    const { audioSensitivity, segments } = this.config;
    const cx = this.bufferSize / 2, cy = cx;
    const cCtx = this.layerCoreCtx, wCtx = this.layerWebCtx, clCtx = this.layerCloudCtx;
    const angleStep = (Math.PI * 2) / segments;

    this.noiseTime += 0.005;
    // Pointer radius bends the branch angle — dragging in/out reshapes the tree
    let wellWarp = 0;
    for (const w of this.wells) wellWarp += w.strength * (w.r / (this.bufferSize / 2)) * 0.5;
    const warp = clamp(warpParam + wellWarp, 0.5, 3.0);
    const branchAngle = (0.2 + mid * 0.3) * warp * 0.6;
    const branchScale = 0.60 + bass * 0.14;
    const maxDepth = 6;
    const breathe = 1.0 + bass * audioSensitivity * 0.30 + mid * audioSensitivity * 0.12;
    const baseLen = cx * (0.14 + bass * 0.06) * breathe * (beat ? 1.12 : 1.0);
    const spinOffset = (this.noiseTime * (0.25 + treble * 0.6)) % (angleStep * 0.9);
    for (const c of [cCtx, wCtx, clCtx]) c.lineCap = 'round';

    const drawBranch = (x, y, angle, len, depth) => {
      if (depth <= 0 || len < 1.5) return;
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      const t = 1 - depth / maxDepth;
      const hue = (this.hue + t * 160 + depth * 25) % 360;

      cCtx.beginPath(); cCtx.moveTo(x, y); cCtx.lineTo(nx, ny);
      cCtx.strokeStyle = 'hsla(' + hue + ',100%,60%,' + (0.3 - t * 0.2 + bass * 0.25).toFixed(3) + ')';
      cCtx.lineWidth = Math.max(0.5, depth * 1.5 + bass * audioSensitivity * 3.5);
      cCtx.stroke();

      wCtx.beginPath(); wCtx.moveTo(x, y); wCtx.lineTo(nx, ny);
      wCtx.strokeStyle = 'hsla(' + hue + ',100%,72%,' + (0.5 - t * 0.3 + mid * 0.3).toFixed(3) + ')';
      wCtx.lineWidth = Math.max(0.3, depth * 0.8 + mid * audioSensitivity * 1.5);
      wCtx.stroke();

      clCtx.beginPath(); clCtx.moveTo(x, y); clCtx.lineTo(nx, ny);
      clCtx.strokeStyle = 'hsla(' + hue + ',100%,' + (55 + treble * 38) + '%,' + (0.8 - t * 0.55).toFixed(3) + ')';
      clCtx.lineWidth = Math.max(0.2, depth * 0.4 + treble * audioSensitivity * 0.8);
      clCtx.stroke();

      const noiseA = this.perlin.noise2D(nx * 0.012 + this.noiseTime, ny * 0.012) * 0.4;
      drawBranch(nx, ny, angle - branchAngle + noiseA, len * branchScale, depth - 1);
      drawBranch(nx, ny, angle + branchAngle + noiseA, len * branchScale, depth - 1);
    };

    const numRoots = 3 + Math.round(mid * 2);
    for (let i = 0; i < numRoots; i++) {
      const rootAngle = (i / numRoots) * angleStep * 0.88 + spinOffset;
      drawBranch(cx, cy, rootAngle, baseLen, maxDepth);
    }
  }

  // ---- Mode: Spectrum Ring ----
  renderSpectrumRing(bass, mid, treble, beat) {
    const c = this.layerCoreCtx, w = this.layerWebCtx, cl = this.layerCloudCtx;
    const cx = this.bufferSize / 2, step = Math.PI * 2 / this.config.segments;
    const fft = this.fftData;
    const bars = 72;
    const base = cx * (0.23 + bass * 0.1);
    for (let i = 0; i < bars; i++) {
      const t = i / bars;
      const mag = fft ? fft[Math.min(fft.length - 1, Math.floor(t * fft.length * .7))] / 255 : .15 + mid * .35;
      const a = t * step;
      const len = cx * (.035 + mag * .28);
      const r1 = base * (beat ? 1.08 : 1);
      const r2 = r1 + len;
      const hue = (this.hue + t * 190) % 360;
      c.beginPath(); c.moveTo(cx + Math.cos(a)*r1, cx + Math.sin(a)*r1); c.lineTo(cx + Math.cos(a)*r2, cx + Math.sin(a)*r2);
      c.strokeStyle = `hsla(${hue},100%,65%,${.3 + mag * .7})`; c.lineWidth = 1 + mag * 5; c.stroke();
      cl.beginPath(); cl.arc(cx + Math.cos(a)*r2, cx + Math.sin(a)*r2, 1 + treble*3, 0, Math.PI*2);
      cl.fillStyle = `hsla(${hue},100%,82%,${.35 + mag*.6})`; cl.fill();
    }
    w.beginPath(); w.arc(cx,cx,base,0,step); w.strokeStyle=`hsla(${this.hue},100%,78%,${.35+mid*.5})`; w.lineWidth=2+bass*8; w.stroke();
  }

  // ---- Mode: Wave Mirror ----
  renderWaveMirror(bass, mid, treble) {
    const c = this.layerCoreCtx, w = this.layerWebCtx;
    const cx = this.bufferSize / 2, step = Math.PI * 2 / this.config.segments;
    const fft = this.fftData;
    this.noiseTime += .012;
    for (let ribbon = 0; ribbon < 5; ribbon++) {
      c.beginPath();
      for (let i = 0; i <= 100; i++) {
        const t = i / 100, a = t * step;
        const f = fft ? fft[Math.min(fft.length-1, Math.floor(t*fft.length*.65))]/255 : mid;
        const r = cx * (.12 + ribbon*.105 + f*.12) + Math.sin(t*18 + this.noiseTime*4 + ribbon)*cx*(.012+treble*.025);
        const x = cx + Math.cos(a)*r, y = cx + Math.sin(a)*r;
        if (!i) c.moveTo(x,y); else c.lineTo(x,y);
      }
      const hue=(this.hue+ribbon*38)%360;
      c.strokeStyle=`hsla(${hue},100%,70%,${.35+mid*.45})`; c.lineWidth=1.3+bass*5; c.stroke();
      w.beginPath();
      for (let i = 0; i <= 100; i++) {
        const t = i / 100, a = t * step;
        const f = fft ? fft[Math.min(fft.length-1, Math.floor(t*fft.length*.65))]/255 : mid;
        const r = cx * (.12 + ribbon*.105 + f*.12) + Math.sin(t*18 + this.noiseTime*4 + ribbon)*cx*(.012+treble*.025);
        const x = cx + Math.cos(a)*r, y = cx + Math.sin(a)*r;
        if (!i) w.moveTo(x,y); else w.lineTo(x,y);
      }
      w.strokeStyle=`hsla(${hue},100%,55%,.14)`; w.lineWidth=8+treble*16; w.stroke();
    }
  }

  // ---- Mode: Particle Galaxy ----
  renderParticleGalaxy(bass, mid, treble, speedMult) {
    const c = this.layerCoreCtx, w = this.layerWebCtx, cx=this.bufferSize/2;
    const step=Math.PI*2/this.config.segments;
    this.noiseTime += .0025*speedMult;
    for (let i=0;i<this.particles.length;i+=2) {
      const p=this.particles[i];
      p.theta=(p.theta + .0008*speedMult*(1+p.r/cx))%step;
      p.r += Math.sin(this.noiseTime*4+i)*(.04+bass*.25);
      if(p.r>cx)p.r=0;if(p.r<0)p.r=cx;
      const spiral=p.theta + p.r/cx*1.8 + this.noiseTime;
      const x=cx+Math.cos(spiral)*p.r, y=cx+Math.sin(spiral)*p.r;
      const hue=(this.hue+p.r/cx*160)%360;
      c.beginPath();c.arc(x,y,.5+p.size*(.45+treble),0,Math.PI*2);
      c.fillStyle=`hsla(${hue},100%,78%,${.35+mid*.55})`;c.fill();
      if(i%18===0){w.beginPath();w.moveTo(cx, cx);w.lineTo(x,y);w.strokeStyle=`hsla(${hue},100%,65%,.08)`;w.stroke();}
    }
  }

  // ---- Mode: Laser Grid ----
  renderLaserGrid(bass, mid, treble, beat) {
    const c=this.layerCoreCtx,w=this.layerWebCtx,cl=this.layerCloudCtx,cx=this.bufferSize/2;
    const step=Math.PI*2/this.config.segments;
    this.noiseTime += .009;
    const lines=12;
    for(let i=0;i<lines;i++){
      const t=i/(lines-1), a=t*step + Math.sin(this.noiseTime+i)*.025;
      const r=cx*(.08+t*.82)*(1+bass*.16);
      const hue=(this.hue+i*18)%360;
      c.beginPath();c.moveTo(cx,cx);c.lineTo(cx+Math.cos(a)*r,cx+Math.sin(a)*r);
      c.strokeStyle=`hsla(${hue},100%,70%,${.25+mid*.65})`;c.lineWidth=1+treble*3;c.stroke();
      w.beginPath();w.arc(cx,cx,r,0,step);w.strokeStyle=`hsla(${hue},100%,62%,${.08+mid*.2})`;w.lineWidth=beat?4:1;w.stroke();
      if(i%3===0){cl.beginPath();cl.arc(cx+Math.cos(a)*r,cx+Math.sin(a)*r,2+treble*5,0,Math.PI*2);cl.fillStyle=`hsla(${hue},100%,85%,.8)`;cl.fill();}
    }
  }

  renderLiquidRibbons(bass, mid, treble) {
    const c=this.layerCoreCtx,w=this.layerWebCtx,cx=this.bufferSize/2,step=Math.PI*2/this.config.segments;
    this.noiseTime+=.006+mid*.01;
    for(let r=0;r<8;r++){
      const hue=(this.hue+r*27)%360;
      for(const target of [w,c]){
        target.beginPath();
        for(let i=0;i<=90;i++){
          const t=i/90,a=t*step;
          const wave=Math.sin(t*12+r*.8+this.noiseTime*3)*cx*(.025+mid*.055);
          const radius=cx*(.12+r*.09+bass*.08)+wave;
          const x=cx+Math.cos(a)*radius,y=cx+Math.sin(a)*radius;
          if(!i)target.moveTo(x,y);else target.lineTo(x,y);
        }
        target.strokeStyle=`hsla(${hue},100%,${target===c?72:48}%,${target===c?.5:.13})`;
        target.lineWidth=target===c?1+treble*4:10+mid*18;target.stroke();
      }
    }
  }

  renderAuroraCurtains(bass, mid, treble) {
    const c=this.layerCloudCtx,w=this.layerWebCtx,cx=this.bufferSize/2,step=Math.PI*2/this.config.segments;
    this.noiseTime+=.003+mid*.004;
    for(let band=0;band<7;band++){
      const hue=(this.hue+band*35)%360;
      c.beginPath();w.beginPath();
      for(let i=0;i<=80;i++){
        const t=i/80,a=t*step;
        const noise=this.perlin.noise2D(t*3+this.noiseTime,band*.37);
        const r=cx*(.17+band*.1+bass*.08)+noise*cx*(.04+mid*.08);
        const x=cx+Math.cos(a)*r,y=cx+Math.sin(a)*r;
        if(!i){c.moveTo(x,y);w.moveTo(x,y);}else{c.lineTo(x,y);w.lineTo(x,y);}
      }
      c.strokeStyle=`hsla(${hue},90%,70%,${.16+treble*.22})`;c.lineWidth=18+mid*34;c.stroke();
      w.strokeStyle=`hsla(${hue},100%,78%,${.3+treble*.45})`;w.lineWidth=1.2+treble*3;w.stroke();
    }
  }

  renderTunnelFlight(bass, mid, treble, beat) {
    const c=this.layerCoreCtx,w=this.layerWebCtx,cx=this.bufferSize/2,step=Math.PI*2/this.config.segments;
    this.noiseTime+=.012+treble*.025;
    for(let i=0;i<16;i++){
      const phase=(i/16+this.noiseTime*.08)%1;
      const r=cx*(.04+phase*.92)*(beat?1.04:1);
      const hue=(this.hue+phase*180)%360;
      c.beginPath();c.arc(cx,cx,r,0,step);c.strokeStyle=`hsla(${hue},100%,70%,${1-phase*.65})`;c.lineWidth=1+phase*3+bass*4;c.stroke();
      if(i%3===0){for(let k=0;k<5;k++){const a=k/5*step+this.noiseTime*.04;w.beginPath();w.moveTo(cx,cx);w.lineTo(cx+Math.cos(a)*r,cx+Math.sin(a)*r);w.strokeStyle=`hsla(${hue},100%,60%,.12)`;w.stroke();}}
    }
  }

  renderStarfieldPulse(bass, mid, treble, speedMult) {
    const c=this.layerCoreCtx,w=this.layerWebCtx,cx=this.bufferSize/2,step=Math.PI*2/this.config.segments;
    for(let i=0;i<this.particles.length;i+=2){
      const p=this.particles[i];p.r+=1.2*speedMult+bass*8;
      if(p.r>cx){p.r=Math.random()*cx*.08;p.theta=Math.random()*step;}
      const x=cx+Math.cos(p.theta)*p.r,y=cx+Math.sin(p.theta)*p.r;
      const tail=Math.max(2,p.r/cx*22);
      const hue=(this.hue+p.hueOffset)%360;
      w.beginPath();w.moveTo(x-Math.cos(p.theta)*tail,y-Math.sin(p.theta)*tail);w.lineTo(x,y);
      w.strokeStyle=`hsla(${hue},100%,72%,${.22+treble*.6})`;w.lineWidth=.5+p.r/cx*2;w.stroke();
      if(i%14===0){c.beginPath();c.arc(x,y,1+bass*3,0,Math.PI*2);c.fillStyle=`hsla(${hue},100%,88%,.8)`;c.fill();}
    }
  }

  // ---- Mode: Firefly Nebula ----
  renderFireflyNebula(bass, mid, treble) {
    const { audioSensitivity } = this.config;
    const angleStep = (Math.PI * 2) / this.config.segments;
    const maxR = this.bufferSize / 2;
    const cCtx = this.layerCoreCtx, wCtx = this.layerWebCtx, clCtx = this.layerCloudCtx;

    const jitter = treble * audioSensitivity * this.config.fireflyChaosFactor;
    const glowScale = 1.0 + bass * audioSensitivity * 2.8;
    const sparkDistSq = (maxR * 0.14) ** 2;
    const pos = [];

    for (const ff of this.fireflies) {
      ff.phase = (ff.phase + ff.phaseSpeed) % (Math.PI * 2);
      const twinkle = 0.6 + 0.4 * Math.sin(ff.phase);

      ff.vr += (Math.random() - 0.5) * jitter * 1.2;
      ff.vtheta += (Math.random() - 0.5) * jitter * 0.005;
      ff.vr -= this.config.fireflyGravity * (0.008 + bass * 0.025);
      this.applyWellForces(ff, 0.045, 0.04);
      ff.vr *= 0.94;
      ff.vtheta *= 0.94;
      ff.r += ff.vr;
      ff.theta += ff.vtheta;

      const bounce = this.config.fireflyBounciness;
      if (ff.r > maxR)        { ff.r = maxR;        ff.vr *= -bounce; }
      if (ff.r < maxR * 0.03) { ff.r = maxR * 0.03; ff.vr = Math.abs(ff.vr) * bounce; }
      if (ff.theta > angleStep) { ff.theta = angleStep; ff.vtheta *= -bounce; }
      if (ff.theta < 0)         { ff.theta = 0;         ff.vtheta = Math.abs(ff.vtheta) * bounce; }

      const xy = this.polarToXY(ff.r, ff.theta);
      pos.push(xy);

      const hue = (this.hue + ff.hueOffset) % 360;
      const glowR = ff.size * glowScale * twinkle;
      const bboxR = glowR * 9;

      const grad = cCtx.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], bboxR);
      grad.addColorStop(0,   'hsla(' + (hue | 0) + ',100%,80%,' + (0.45 * twinkle).toFixed(3) + ')');
      grad.addColorStop(0.3, 'hsla(' + (hue | 0) + ',100%,58%,' + (0.18 * twinkle).toFixed(3) + ')');
      grad.addColorStop(1,   'hsla(' + (hue | 0) + ',100%,45%,0)');
      cCtx.fillStyle = grad;
      cCtx.fillRect(xy[0] - bboxR, xy[1] - bboxR, bboxR * 2, bboxR * 2);

      clCtx.beginPath();
      clCtx.arc(xy[0], xy[1], Math.max(0.8, glowR * 0.55), 0, Math.PI * 2);
      clCtx.fillStyle = 'hsla(' + (hue | 0) + ',100%,95%,' + (0.85 + treble * 0.15).toFixed(3) + ')';
      clCtx.fill();
    }

    const n = this.fireflies.length;
    wCtx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const fi = this.fireflies[i];
      for (let j = i + 1; j < n; j++) {
        const fj = this.fireflies[j];
        const dr = fi.r - fj.r;
        const dth = (fi.theta - fj.theta) * ((fi.r + fj.r) * 0.5);
        if (dr * dr + dth * dth < sparkDistSq) {
          const t = 1 - (dr * dr + dth * dth) / sparkDistSq;
          const hue = (this.hue + (fi.hueOffset + fj.hueOffset) * 0.5) % 360;
          wCtx.beginPath();
          wCtx.moveTo(pos[i][0], pos[i][1]);
          wCtx.lineTo(pos[j][0], pos[j][1]);
          wCtx.strokeStyle = 'hsla(' + (hue | 0) + ',100%,72%,' + (t * t * (0.25 + mid * 0.65)).toFixed(3) + ')';
          wCtx.lineWidth = t * 1.4;
          wCtx.stroke();
        }
      }
    }
  }
}

// ============================================================
// AUDIO — analyser for mic / music file, band split + beat gate
// ============================================================
let audioCtx = null, analyser = null, freqData = null;
let mediaSource = null, micStream = null, audioEl = null;
let lastBeatAt = 0;
let bassHistory = [];
const smoothedBands = { bass:0, mid:0, treble:0 };
let sourceMode = 'touch';   // 'touch' | 'mic' | 'file'
let bassGain = 1.15, midGain = 1, trebleGain = 1.05, beatThreshold = .62;
const effectState = { bloom:true, grain:false, vignette:false, chromatic:false, blur:false,
  flicker:false, strobe:false, glitch:false, mirrorX:false, flipY:false, strength:.45 };
const audioMapping = { bass:'scale', mid:'warp', treble:'glow', beat:'pulse' };

function initAudioAnalyser() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.84;
  freqData = new Uint8Array(analyser.frequencyBinCount);
}

function detachAudioSource() {
  if (mediaSource) { try { mediaSource.disconnect(); } catch (e) {} mediaSource = null; }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  if (audioEl) {
    audioEl.pause();
    if (audioEl.src.startsWith('blob:')) URL.revokeObjectURL(audioEl.src);
    audioEl.removeAttribute('src');
    audioEl.load();
    audioEl = null;
  }
}

async function useMic() {
  initAudioAnalyser();
  detachAudioSource();
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  mediaSource = audioCtx.createMediaStreamSource(micStream);
  mediaSource.connect(analyser);   // NOT to destination — no feedback loop
  sourceMode = 'mic';
}

async function useAudioFile(file) {
  initAudioAnalyser();
  detachAudioSource();
  const url = URL.createObjectURL(file);
  audioEl = new Audio(url);
  audioEl.loop = true;
  audioEl.preload = 'auto';
  mediaSource = audioCtx.createMediaElementSource(audioEl);
  mediaSource.connect(analyser);
  analyser.connect(audioCtx.destination);
  await audioEl.play();
  sourceMode = 'file';
}

function useTouchOnly() {
  detachAudioSource();
  sourceMode = 'touch';
}

function bandAverage(startRatio, endRatio) {
  const start = Math.floor(freqData.length * startRatio);
  const end = Math.max(start + 1, Math.floor(freqData.length * endRatio));
  let sum = 0;
  for (let i = start; i < end; i++) sum += freqData[i];
  return Math.min(1, sum / (end - start) / 255);
}

function bandAverageHz(startHz, endHz) {
  if (!audioCtx || !freqData) return 0;
  const nyquist = audioCtx.sampleRate / 2;
  return bandAverage(clamp(startHz / nyquist, 0, 1), clamp(endHz / nyquist, 0, 1));
}

// ============================================================
// POINTER / TOUCH — the always-on input. Finger speed becomes
// "treble", pressing becomes "bass", so every mode reacts to
// touch even with no audio at all.
// ============================================================
const pointers = new Map();     // pointerId -> {x, y, vx, vy, downAt}
let pointerEnergy = 0;          // smoothed swipe speed 0..1
let pressEnergy = 0;            // smoothed hold amount 0..1
let tapBeat = false;            // one-frame beat on pointerdown
let gravityMode = 'attract';    // 'attract' | 'repel' | 'off'
let gravityStrength = 0.65;
const idlePerlin = new PerlinNoise();
let idleT = Math.random() * 100;

function attachPointerHandlers(el, engine) {
  el.style.touchAction = 'none';   // stop mobile scroll from eating the drag
  const toCanvas = (e) => {
    const rect = el.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * engine.width,
      y: (e.clientY - rect.top) / rect.height * engine.height
    };
  };
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const c = toCanvas(e);
    pointers.set(e.pointerId, { x: c.x, y: c.y, vx: 0, vy: 0, downAt: performance.now() });
    tapBeat = true;
  });
  el.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const c = toCanvas(e);
    p.vx = p.vx * 0.6 + (c.x - p.x) * 0.4;
    p.vy = p.vy * 0.6 + (c.y - p.y) * 0.4;
    p.x = c.x; p.y = c.y;
  });
  const drop = e => { pointers.delete(e.pointerId); };
  el.addEventListener('pointerup', drop);
  el.addEventListener('pointercancel', drop);
  el.addEventListener('lostpointercapture', drop);
}

// ---- Per-frame band synthesis (bass/mid/treble/beat regardless of source) ----
function getBands() {
  // Live audio path
  if (sourceMode !== 'touch' && analyser) {
    analyser.getByteFrequencyData(freqData);
    const rawBass = clamp(bandAverageHz(30, 180) * bassGain, 0, 1);
    const rawMid = clamp(bandAverageHz(180, 2600) * midGain, 0, 1);
    const rawTreble = clamp(bandAverageHz(2600, 12000) * trebleGain, 0, 1);
    smoothedBands.bass += (rawBass - smoothedBands.bass) * .22;
    smoothedBands.mid += (rawMid - smoothedBands.mid) * .16;
    smoothedBands.treble += (rawTreble - smoothedBands.treble) * .2;
    const bass = smoothedBands.bass, mid = smoothedBands.mid, treble = smoothedBands.treble;
    const overall = (bass + mid + treble) / 3;
    const now = performance.now();
    bassHistory.push(bass);
    if (bassHistory.length > 48) bassHistory.shift();
    const rollingBass = bassHistory.reduce((sum, value) => sum + value, 0) / Math.max(1, bassHistory.length);
    const dynamicGate = Math.max(.075, rollingBass * (1.18 + (beatThreshold - .35) * 1.05));
    let beat = bass > dynamicGate && bass > overall * 1.04 && now - lastBeatAt > 210;
    if (beat) lastBeatAt = now;
    // Touch still layers on top of audio (finger = extra excitement)
    return {
      bass: clamp(bass + pressEnergy * 0.25, 0, 1),
      mid: clamp(mid + pointerEnergy * 0.2, 0, 1),
      treble: clamp(treble + pointerEnergy * 0.35, 0, 1),
      overall, beat: beat || tapBeat, fft: freqData
    };
  }
  // Touch-only path: synthesize gentle idle "music" + pointer excitement.
  // A held press BREATHES (slow pulse) instead of pegging bass at max —
  // constant max bass blows out the additive glow blobs.
  idleT += 0.004;
  const idleA = (idlePerlin.noise2D(idleT, 0) + 1) / 2;         // slow swell
  const idleB = (idlePerlin.noise2D(idleT * 1.7, 5.5) + 1) / 2; // faster shimmer
  const pressPulse = pressEnergy * (0.32 + 0.22 * Math.sin(idleT * 30));
  const bass = clamp(idleA * 0.22 + pressPulse, 0, 1);
  const mid = clamp(idleB * 0.25 + pointerEnergy * 0.6, 0, 1);
  const treble = clamp(idleB * 0.18 + pointerEnergy * 0.7, 0, 1);
  return { bass, mid, treble, overall: (bass + mid + treble) / 3, beat: tapBeat, fft: null };
}

// ============================================================
// MAIN — engine setup, frame loop, adaptive resolution, UI
// ============================================================
let engine = null;
let running = false;
let frameCount = 0;
let fpsEMA = 60;
let lastFrameT = 0;
let visualPaused = false;   // transport pause freezes the FRAME, not just audio
let sceneAdvanceHook = null, lastBeatSceneAt = 0, sceneFlashUntil = 0;

// Auto mode: cycle render modes on strong beats (or a timer), using the
// engine's soft no-clear transitions so it feels alive with no input
const MODE_ORDER = ['firefly-nebula', 'neural-strings', 'geometric-pulse', 'fractal-warp',
  'spectrum-ring', 'wave-mirror', 'particle-galaxy', 'laser-grid',
  'liquid-ribbons', 'aurora-curtains', 'tunnel-flight', 'starfield-pulse', 'neon-comet'];
const MODE_LABEL = { 'firefly-nebula': 'Firefly Nebula', 'neural-strings': 'Neural Strings',
  'geometric-pulse': 'Geometric Pulse', 'fractal-warp': 'Fractal Warp',
  'spectrum-ring': 'Spectrum Ring', 'wave-mirror': 'Wave Mirror',
  'particle-galaxy': 'Particle Galaxy', 'laser-grid': 'Laser Grid',
  'liquid-ribbons': 'Liquid Ribbons', 'aurora-curtains': 'Aurora Curtains',
  'tunnel-flight': 'Tunnel Flight', 'starfield-pulse': 'Starfield Pulse',
  'neon-comet': 'Neon Comet' };
let autoMode = false;
let autoIdx = 0;
let lastModeSwitch = 0;

function frame(now) {
  // Pointer energies decay toward rest each frame
  let speedSum = 0;
  pointers.forEach(p => { speedSum += Math.hypot(p.vx, p.vy); });
  const speedNorm = clamp(speedSum / (engine.width * 0.04), 0, 1);
  pointerEnergy = pointerEnergy * 0.88 + speedNorm * 0.12;
  pressEnergy = pressEnergy * 0.92 + (pointers.size > 0 ? 1 : 0) * 0.08;

  // Feed pointer wells into the engine. Both gravity toggles may be off;
  // selecting one direction turns the other off so the force is unambiguous.
  const wellList = [];
  const gravitySign = gravityMode === 'attract' ? 1 : gravityMode === 'repel' ? -1 : 0;
  pointers.forEach((p, id) => {
    // id travels with the well so Neon Comet can keep a separate ribbon per
    // finger instead of stitching two touches into one streak.
    wellList.push({ id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, strength: gravitySign * gravityStrength });
  });
  engine.setPointerWells(wellList);

  const bands = getBands();
  tapBeat = false;
  if (bands.beat && audioMapping.beat === 'scene' && sceneAdvanceHook && now - lastBeatSceneAt > 2500) {
    lastBeatSceneAt = now;
    sceneAdvanceHook();
  }

  // Auto mode: advance on a strong beat once settled, or force after 30s
  if (autoMode) {
    const since = now - lastModeSwitch;
    if ((since > 16000 && bands.beat && bands.bass > 0.5) || since > 30000) {
      autoIdx = (autoIdx + 1) % MODE_ORDER.length;
      engine.setMode(MODE_ORDER[autoIdx]);
      lastModeSwitch = now;
      setStatus('Auto — ' + MODE_LABEL[MODE_ORDER[autoIdx]]);
      const badge = document.getElementById('modeBadge');
      if (badge) badge.textContent = MODE_LABEL[MODE_ORDER[autoIdx]].toUpperCase();
    }
  }

  // Same param mapping as V2's MappingEngine defaults
  const mappedBass = audioMapping.bass === 'speed' ? bands.bass * .55 : bands.bass;
  const mappedMid = audioMapping.mid === 'color' ? bands.mid * .45 : bands.mid;
  const mappedTreble = audioMapping.treble === 'speed' ? bands.treble * .55 : bands.treble;
  engine.config.shakeIntensity = audioMapping.bass === 'shake' ? .4 + bands.bass * 2.4 : 1;
  if (audioMapping.treble === 'color') engine.hue = (engine.hue + bands.treble * 3) % 360;
  const params = {
    warp: 1.2 + mappedMid * (audioMapping.mid === 'density' ? .7 : 1.2),
    glow: 1.0 + mappedTreble * (audioMapping.treble === 'distortion' ? .45 : .8),
    pulse: mappedBass,
    intensity: 1.0 + bands.overall * 0.8
  };
  engine.render(params, bands.beat, bands.fft);

  // Adaptive resolution: keep phones smooth without a quality toggle
  if (lastFrameT > 0) {
    const dt = now - lastFrameT;
    if (dt > 0 && dt < 500) fpsEMA = fpsEMA * 0.95 + (1000 / dt) * 0.05;
    frameCount++;
    // resolutionLock: a canvas resize mid-recording breaks captureStream()
    if (frameCount % 90 === 0 && !engine.resolutionLock) {
      const scale = engine.resolutionScale;
      if (fpsEMA < 45 && scale > 0.5) engine.setResolutionScale(scale - 0.15);
      else if (fpsEMA > 57 && scale < 1) engine.setResolutionScale(scale + 0.1);
    }
  }
  lastFrameT = now;
}

function loop(now) {
  if (!running) return;
  if (visualPaused) {
    lastFrameT = now;   // keep FPS estimate honest across a pause
  } else {
    frame(now);
  }
  requestAnimationFrame(loop);
}

// ---------- UI wiring ----------
function setStatus(msg) {
  const el = document.getElementById('vsStatus');
  if (el) el.textContent = msg;
}

function selectChip(groupSel, btn) {
  document.querySelectorAll(groupSel).forEach(b => b.classList.toggle('active', b === btn));
}

window.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.console = 'explore';
  const canvas = document.getElementById('stage');
  engine = new VisualEngine(canvas);
  engine.setPalette(PALETTES[0]);

  const mount = document.getElementById('stageWrap');
  const doResize = () => engine.resize(mount.clientWidth, mount.clientHeight);
  doResize();
  window.addEventListener('resize', doResize);

  attachPointerHandlers(canvas, engine);

  document.querySelectorAll('.field').forEach(field => {
    const label = field.querySelector('label');
    const control = field.querySelector('input,select');
    if (label && control && control.id) {
      label.htmlFor = control.id;
      if (!control.getAttribute('aria-label')) control.setAttribute('aria-label', label.textContent.trim());
    }
  });

  const setConsole = name => {
    document.body.dataset.console = name;
    document.querySelectorAll('.console-tab').forEach(btn => {
      const active = btn.dataset.consoleTab === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    const label = document.getElementById('consoleMode');
    if (label) label.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  };
  document.querySelectorAll('.console-tab').forEach(btn => btn.addEventListener('click', () => setConsole(btn.dataset.consoleTab)));
  const closeControls = () => document.body.classList.remove('controls-open');
  document.getElementById('closeControls').addEventListener('click', closeControls);
  document.getElementById('mobileScrim').addEventListener('click', closeControls);

  // First-visit recording tutorial. It is always available from the top bar.
  const tutorialBackdrop = document.getElementById('tutorialBackdrop');
  const tutorialSteps = Array.from(document.querySelectorAll('.tutorial-step'));
  const tutorialDots = Array.from(document.querySelectorAll('.tutorial-dot'));
  const tutorialPrev = document.getElementById('tutorialPrev');
  const tutorialNext = document.getElementById('tutorialNext');
  const tutorialDemo = document.getElementById('tutorialDemo');
  let tutorialStep = 0;
  const showTutorialStep = index => {
    tutorialStep = clamp(index, 0, tutorialSteps.length - 1);
    tutorialSteps.forEach((step, i) => step.classList.toggle('active', i === tutorialStep));
    tutorialDots.forEach((dot, i) => dot.classList.toggle('active', i === tutorialStep));
    tutorialPrev.disabled = tutorialStep === 0;
    tutorialNext.textContent = tutorialStep === tutorialSteps.length - 1 ? 'Start creating' : 'Next';
    document.getElementById('tutorialCounter').textContent = `${tutorialStep + 1} of ${tutorialSteps.length}`;
  };
  const openTutorial = () => {
    closeControls();
    tutorialBackdrop.hidden = false;
    showTutorialStep(0);
    document.getElementById('tutorialClose').focus();
  };
  const closeTutorial = () => {
    tutorialBackdrop.hidden = true;
    localStorage.setItem('luminariumTutorialSeen', '1');
    document.getElementById('tutorialBtn').focus();
  };
  document.getElementById('tutorialBtn').addEventListener('click', openTutorial);
  document.getElementById('tutorialClose').addEventListener('click', closeTutorial);
  tutorialBackdrop.addEventListener('click', event => { if (event.target === tutorialBackdrop) closeTutorial(); });
  tutorialPrev.addEventListener('click', () => showTutorialStep(tutorialStep - 1));
  tutorialNext.addEventListener('click', () => {
    if (tutorialStep === tutorialSteps.length - 1) closeTutorial();
    else showTutorialStep(tutorialStep + 1);
  });
  tutorialDots.forEach((dot, index) => dot.addEventListener('click', () => showTutorialStep(index)));
  tutorialDemo.addEventListener('click', async () => {
    tutorialDemo.disabled = true;
    tutorialDemo.querySelector('strong').textContent = 'Loading demo…';
    try {
      const response = await fetch('/visual/demo/guitar-piano-improv.mp3');
      if (!response.ok) throw new Error('demo unavailable');
      const blob = await response.blob();
      const file = new File([blob], 'Guitar and Piano Improv.mp3', { type:blob.type || 'audio/mpeg' });
      await loadAudioSource(file, 'Demo playing: Guitar & Piano Improv');
      closeTutorial();
      setConsole('explore');
    } catch (error) {
      tutorialDemo.querySelector('strong').textContent = 'Demo could not load';
      setStatus('The demo audio could not be loaded');
    } finally {
      tutorialDemo.disabled = false;
      if (tutorialDemo.querySelector('strong').textContent !== 'Demo could not load') tutorialDemo.querySelector('strong').textContent = 'Try with demo audio';
    }
  });
  if (!localStorage.getItem('luminariumTutorialSeen')) requestAnimationFrame(openTutorial);

  // Mode chips ("auto" cycles through the real modes on beats/timer)
  document.querySelectorAll('.mode-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === 'auto') {
        autoMode = true;
        autoIdx = MODE_ORDER.indexOf(engine.mode);
        if (autoIdx < 0) autoIdx = 0;
        lastModeSwitch = performance.now();
        setStatus('Auto — ' + MODE_LABEL[engine.mode]);
      } else {
        autoMode = false;
        engine.setMode(btn.dataset.mode);
      }
      selectChip('.mode-chip', btn);
    });
  });

  // Palette select
  const palSel = document.getElementById('palette');
  PALETTES.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    palSel.appendChild(opt);
  });
  palSel.addEventListener('change', () => engine.setPalette(PALETTES[+palSel.value]));

  // Sliders
  const bindSlider = (id, apply) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + 'Val');
    const run = () => { apply(+el.value); if (out) out.textContent = el.value; };
    el.addEventListener('input', run);
    run();
  };
  bindSlider('segments', v => engine.setConfig({ segments: Math.round(v) }));
  bindSlider('sensitivity', v => engine.setConfig({ audioSensitivity: v / 10 }));
  bindSlider('trails', v => engine.setConfig({ trailIntensity: v / 1000 }));
  bindSlider('spin', v => engine.setConfig({ rotSpeed: v / 10 }));
  bindSlider('colorSpeed', v => engine.setConfig({ colorSpeed: v / 10 }));
  bindSlider('bassGain', v => { bassGain = v / 100; });
  bindSlider('midGain', v => { midGain = v / 100; });
  bindSlider('trebleGain', v => { trebleGain = v / 100; });
  bindSlider('beatThreshold', v => { beatThreshold = v / 100; });

  // Creator Studio helpers
  const modeBadge = document.getElementById('modeBadge');
  document.querySelectorAll('.mode-chip').forEach(btn => btn.addEventListener('click', () => {
    modeBadge.textContent = btn.dataset.mode === 'auto' ? 'AUTO SCENES' : (MODE_LABEL[btn.dataset.mode] || btn.textContent).toUpperCase();
  }));

  const PRESETS = {
    neon:    { mode:'firefly-nebula', palette:0, macros:[58,54,48,42,62,55] },
    haunted: { mode:'neural-strings',  palette:6, macros:[46,68,72,28,48,78] },
    dream:   { mode:'wave-mirror',     palette:5, macros:[34,38,44,52,30,72] },
    inferno: { mode:'laser-grid',      palette:2, macros:[82,72,34,48,84,38] },
    ocean:   { mode:'particle-galaxy', palette:4, macros:[42,44,76,36,48,84] },
    mono:    { mode:'spectrum-ring',   palette:7, macros:[38,24,58,18,56,68] }
  };
  const setRange = (id, value) => {
    const el = document.getElementById(id);
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  const macroIds = ['macroEnergy','macroFlow','macroStructure','macroGlow','macroImpact','macroDepth'];
  const applyMacro = (id, value) => {
    const n = value / 100;
    const out = document.getElementById(id + 'Val');
    if (out) out.textContent = Math.round(value);
    if (id === 'macroEnergy') {
      setRange('sensitivity', Math.round(8 + n * 18));
      setRange('bassGain', Math.round(88 + n * 64));
      setRange('effectStrength', Math.round(18 + n * 54));
    } else if (id === 'macroFlow') {
      setRange('spin', Math.round(2 + n * 20));
      setRange('trails', Math.round(92 - n * 76));
      setRange('colorSpeed', Math.round(4 + n * 18));
    } else if (id === 'macroStructure') {
      const segments = 4 + Math.round(n * 5) * 2;
      setRange('segments', segments);
      engine.setConfig({ particleDensity:.55 + n * .9, fireflyCount:28 + n * 106 });
    } else if (id === 'macroGlow') {
      engine.setConfig({ bloomStrength:.08 + n * .38, exposure:.9 - n * .12 });
      effectState.bloom = value > 2;
      const bloomToggle = document.querySelector('[data-effect="bloom"]');
      if (bloomToggle) bloomToggle.checked = effectState.bloom;
    } else if (id === 'macroImpact') {
      setRange('beatThreshold', Math.round(82 - n * 36));
      engine.setConfig({ beatScale:.008 + n * .052, shakeIntensity:.25 + n * 1.25 });
    } else if (id === 'macroDepth') {
      engine.setConfig({ backgroundStrength:.35 + n * .58, contrast:.98 + n * .17 });
      effectState.vignette = value >= 64;
      const vignetteToggle = document.querySelector('[data-effect="vignette"]');
      if (vignetteToggle) vignetteToggle.checked = effectState.vignette;
    }
  };
  const setMacro = (id, value) => {
    const el = document.getElementById(id);
    el.value = value;
    applyMacro(id, +value);
  };
  macroIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => applyMacro(id, +el.value));
  });
  macroIds.forEach(id => applyMacro(id, +document.getElementById(id).value));

  document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    document.querySelectorAll('.preset').forEach(x => x.classList.toggle('active', x === btn));
    const modeBtn = document.querySelector(`.mode-chip[data-mode="${p.mode}"]`);
    if (modeBtn) modeBtn.click();
    palSel.value = p.palette;
    palSel.dispatchEvent(new Event('change'));
    p.macros.forEach((value, index) => setMacro(macroIds[index], value));
    setStatus((btn.querySelector('strong')?.textContent || btn.textContent.trim()) + ' preset loaded');
  }));

  const presetButtons = Array.from(document.querySelectorAll('.preset'));
  document.getElementById('surpriseBtn').addEventListener('click', () => {
    const active = presetButtons.findIndex(btn => btn.classList.contains('active'));
    let next = Math.floor(Math.random() * presetButtons.length);
    if (presetButtons.length > 1 && next === active) next = (next + 1) % presetButtons.length;
    presetButtons[next].click();
  });
  const autoDirectorBtn = document.getElementById('autoDirectorBtn');
  autoDirectorBtn.addEventListener('click', () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStatus('Auto Director is disabled while reduced motion is enabled');
      return;
    }
    const autoButton = document.querySelector('.mode-chip[data-mode="auto"]');
    if (!autoMode) {
      autoButton.click();
      autoDirectorBtn.textContent = '■ Stop Auto Director';
      autoDirectorBtn.classList.add('is-running');
    } else {
      autoMode = false;
      autoDirectorBtn.textContent = '✦ Start Auto Director';
      autoDirectorBtn.classList.remove('is-running');
      setStatus('Auto Director stopped');
    }
  });

  const hexToRgb = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  document.getElementById('applyColors').addEventListener('click', () => {
    const colors = ['color1','color2','color3'].map(id => hexToRgb(document.getElementById(id).value));
    engine.setPalette({ name:'Custom', colors });
    palSel.value = '';
    setStatus('Custom palette applied');
  });

  const stageShell = document.getElementById('stageShell');
  let activeRatio = 16 / 9;
  stageShell.style.setProperty('--stage-ratio', String(activeRatio));
  const getOutputSize = (quality = document.getElementById('quality').value) => {
    const sizes = {
      high: { landscape:[1920,1080], portrait:[1080,1920], square:[1080,1080], vertical:[1080,1350] },
      standard: { landscape:[1280,720], portrait:[720,1280], square:[720,720], vertical:[720,900] },
      mobile: { landscape:[960,540], portrait:[540,960], square:[540,540], vertical:[540,675] }
    };
    const shape = Math.abs(activeRatio - 1) < .01 ? 'square' : Math.abs(activeRatio - .8) < .01 ? 'vertical' : activeRatio < 1 ? 'portrait' : 'landscape';
    const [width,height] = sizes[quality][shape];
    return { width, height };
  };
  const updateOutputBadge = () => {
    const {width,height} = getOutputSize();
    const fps = document.getElementById('exportFps').value;
    document.getElementById('outputBadge').textContent = `${width}×${height} · ${fps} FPS READY`;
  };
  const applyRatio = () => {
    const sw = stageShell.clientWidth, sh = stageShell.clientHeight;
    let w = sw, h = w / activeRatio;
    if (h > sh) { h = sh; w = h * activeRatio; }
    mount.style.width = Math.max(1, w) + 'px';
    mount.style.height = Math.max(1, h) + 'px';
    doResize();
  };
  document.querySelectorAll('.ratio-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.ratio-btn').forEach(x => x.classList.toggle('active', x === btn));
    const [a,b] = btn.dataset.ratio.split('/').map(Number);
    activeRatio = a / b;
    stageShell.style.setProperty('--stage-ratio', String(activeRatio));
    applyRatio();
    updateOutputBadge();
  }));
  document.getElementById('quality').addEventListener('change', updateOutputBadge);
  document.getElementById('exportFps').addEventListener('change', updateOutputBadge);
  if (window.ResizeObserver) new ResizeObserver(applyRatio).observe(stageShell);
  requestAnimationFrame(applyRatio);
  updateOutputBadge();

  const refreshOverlay = () => {
    const on = document.getElementById('showTitles').checked;
    const artist = document.getElementById('artistText').value.trim();
    const title = document.getElementById('trackText').value.trim();
    const style = document.getElementById('titleStyle').value;
    const preview = document.getElementById('overlayPreview');
    preview.replaceChildren();
    engine.setOverlay({ show:on, artist, track:title, style });
  };
  ['artistText','trackText','titleStyle'].forEach(id => document.getElementById(id).addEventListener('input', refreshOverlay));
  document.getElementById('showTitles').addEventListener('change', refreshOverlay);

  document.getElementById('pngBtn').addEventListener('click', () => {
    const {width,height} = getOutputSize('high');
    engine.resolutionLock = true;
    engine.setOutputSize(width,height);
    frame(performance.now());
    canvas.toBlob(blob => {
      engine.resolutionLock = false;
      engine.clearOutputSize();
      applyRatio();
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'luminarium-still.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        setStatus(`PNG still saved at ${width}×${height}`);
      }
    }, 'image/png');
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const setup = {
      version:3, mode:engine.mode, palette:+palSel.value || 0, ratio:activeRatio,
      controls:Object.fromEntries(['segments','sensitivity','trails','spin','colorSpeed','bassGain','midGain','trebleGain','beatThreshold']
        .map(id => [id, document.getElementById(id).value])),
      titles:{ artist:document.getElementById('artistText').value, track:document.getElementById('trackText').value,
        show:document.getElementById('showTitles').checked, style:document.getElementById('titleStyle').value },
      effects:{...effectState}, mapping:{...audioMapping},
      macros:Object.fromEntries(macroIds.map(id => [id, document.getElementById(id).value])),
      renderer:{ bloomStrength:engine.config.bloomStrength, exposure:engine.config.exposure,
        contrast:engine.config.contrast, backgroundStrength:engine.config.backgroundStrength,
        beatScale:engine.config.beatScale, particleDensity:engine.config.particleDensity },
      scenes:typeof scenes!=='undefined'?scenes:[], activeScene:typeof activeScene!=='undefined'?activeScene:0
    };
    localStorage.setItem('luminariumSetup', JSON.stringify(setup));
    const blob = new Blob([JSON.stringify(setup, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='luminarium-setup.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    setStatus('Setup saved on this device and downloaded');
  });

  document.getElementById('loadSetupBtn').addEventListener('click', () => document.getElementById('setupInput').click());
  document.getElementById('setupInput').addEventListener('change', async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    try {
      const setup = JSON.parse(await file.text());
      if (![1,2,3].includes(setup.version) || !MODE_LABEL[setup.mode]) throw new Error('unsupported setup');
      const modeBtn = document.querySelector(`.mode-chip[data-mode="${setup.mode}"]`);
      if (modeBtn) modeBtn.click();
      if (Number.isInteger(setup.palette) && PALETTES[setup.palette]) {
        palSel.value = setup.palette;
        palSel.dispatchEvent(new Event('change'));
      }
      if (setup.controls) {
        Object.entries(setup.controls).forEach(([id, value]) => {
          if (document.getElementById(id)) setRange(id, value);
        });
      }
      if (setup.titles) {
        document.getElementById('artistText').value = setup.titles.artist || '';
        document.getElementById('trackText').value = setup.titles.track || '';
        document.getElementById('titleStyle').value = setup.titles.style || 'cinema';
        document.getElementById('showTitles').checked = !!setup.titles.show;
        refreshOverlay();
      }
      if (setup.version>=2) {
        Object.assign(effectState,setup.effects||{});
        Object.assign(audioMapping,setup.mapping||{});
        if(Array.isArray(setup.scenes)&&setup.scenes.length){scenes=setup.scenes;activeScene=Math.min(setup.activeScene||0,scenes.length-1);renderScenes();}
      }
      if (setup.version>=3) {
        Object.entries(setup.macros||{}).forEach(([id,value])=>{if(macroIds.includes(id))setMacro(id,value);});
        engine.setConfig(setup.renderer||{});
      }
      const ratioBtn = Array.from(document.querySelectorAll('.ratio-btn')).find(btn => {
        const [a,b] = btn.dataset.ratio.split('/').map(Number);
        return Math.abs(a / b - setup.ratio) < .001;
      });
      if (ratioBtn) ratioBtn.click();
      localStorage.setItem('luminariumSetup', JSON.stringify({...setup, version:3}));
      setStatus('Saved setup loaded');
    } catch (e) {
      setStatus('That setup file could not be loaded');
    }
    this.value = '';
  });

  // Phase 2 effects and frequency mapping
  bindSlider('effectStrength', v => { effectState.strength = v / 100; });
  const gravityAttract = document.getElementById('gravityAttract');
  const gravityRepel = document.getElementById('gravityRepel');
  const gravitySlider = document.getElementById('gravityStrength');
  const gravityLabel = document.getElementById('gravityStrengthVal');
  const updateGravityMode = changed => {
    if (changed === gravityAttract && gravityAttract.checked) gravityRepel.checked = false;
    if (changed === gravityRepel && gravityRepel.checked) gravityAttract.checked = false;
    gravityMode = gravityAttract.checked ? 'attract' : gravityRepel.checked ? 'repel' : 'off';
    setStatus(gravityMode === 'off' ? 'Touch gravity off' : 'Touch gravity: ' + gravityMode);
  };
  gravityAttract.addEventListener('change', () => updateGravityMode(gravityAttract));
  gravityRepel.addEventListener('change', () => updateGravityMode(gravityRepel));
  gravitySlider.addEventListener('input', () => {
    gravityStrength = +gravitySlider.value / 100;
    gravityLabel.textContent = gravitySlider.value + '%';
  });
  document.querySelectorAll('.effect-toggle').forEach(el => {
    effectState[el.dataset.effect] = el.checked;
    el.addEventListener('change', () => {
      if (el.dataset.effect === 'strobe' && el.checked && !confirm('Strobe uses rapid flashes that may affect photosensitive viewers. Enable it?')) {
        el.checked = false;
      }
      effectState[el.dataset.effect] = el.checked;
    });
  });
  ['bass','mid','treble','beat'].forEach(band => {
    const el = document.getElementById(band + 'Map');
    el.addEventListener('change', () => { audioMapping[band] = el.value; });
  });

  // Scene sequencer: each card stores a complete visual snapshot.
  const captureScene = (name, duration = 16) => ({
    id: Date.now() + Math.random(), name, duration, transition:document.getElementById('sceneTransition').value,
    mode:engine.mode, palette:Number.isInteger(+palSel.value) ? +palSel.value : 0,
    controls:Object.fromEntries(['segments','sensitivity','trails','spin','colorSpeed','bassGain','midGain','trebleGain','beatThreshold']
      .map(id => [id, document.getElementById(id).value])),
    macros:Object.fromEntries(macroIds.map(id => [id, document.getElementById(id).value])),
    renderer:{bloomStrength:engine.config.bloomStrength,exposure:engine.config.exposure,contrast:engine.config.contrast,
      backgroundStrength:engine.config.backgroundStrength,beatScale:engine.config.beatScale,particleDensity:engine.config.particleDensity},
    effects:{...effectState}, mapping:{...audioMapping}
  });
  let scenes = [captureScene('Scene 1',16), {...captureScene('Scene 2',16), mode:'wave-mirror', palette:5}];
  let activeScene = 0, sceneStartedAt = performance.now();
  const applyScene = index => {
    if (!scenes.length) return;
    const outgoingTransition = scenes[activeScene] ? scenes[activeScene].transition : 'crossfade';
    activeScene = (index + scenes.length) % scenes.length;
    const scene = scenes[activeScene];
    if (outgoingTransition === 'cut') {
      [engine.layerCoreCtx,engine.layerWebCtx,engine.layerCloudCtx].forEach(ctx=>ctx.clearRect(0,0,engine.bufferSize,engine.bufferSize));
    } else if (outgoingTransition === 'flash') {
      sceneFlashUntil = performance.now() + 180;
    }
    const modeBtn = document.querySelector(`.mode-chip[data-mode="${scene.mode}"]`);
    if (modeBtn) modeBtn.click();
    if (PALETTES[scene.palette]) { palSel.value=scene.palette; palSel.dispatchEvent(new Event('change')); }
    Object.entries(scene.controls || {}).forEach(([id,v]) => { if(document.getElementById(id)) setRange(id,v); });
    Object.entries(scene.macros || {}).forEach(([id,v]) => { if(macroIds.includes(id)) setMacro(id,v); });
    engine.setConfig(scene.renderer || {});
    Object.assign(effectState, scene.effects || {});
    document.querySelectorAll('.effect-toggle').forEach(el => { el.checked=!!effectState[el.dataset.effect]; });
    Object.assign(audioMapping, scene.mapping || {});
    ['bass','mid','treble','beat'].forEach(b => { document.getElementById(b+'Map').value=audioMapping[b]; });
    document.getElementById('sceneDuration').value=scene.duration;
    document.getElementById('sceneDuration').dispatchEvent(new Event('input'));
    document.getElementById('sceneTransition').value=scene.transition || 'crossfade';
    sceneStartedAt=performance.now();
    renderScenes();
    setStatus(`${scene.name} — ${MODE_LABEL[scene.mode]}`);
  };
  const renderScenes = () => {
    const list=document.getElementById('sceneList');list.replaceChildren();
    scenes.forEach((scene,i)=>{
      const btn=document.createElement('button');btn.className='scene-card'+(i===activeScene?' active':'');
      const strong=document.createElement('strong');strong.textContent=scene.name;
      const small=document.createElement('small');small.textContent=`${scene.duration}s · ${MODE_LABEL[scene.mode]}`;
      btn.append(strong,small);btn.addEventListener('click',()=>applyScene(i));list.append(btn);
    });
  };
  const advanceScene = () => {
    if (!scenes.length) return;
    scenes[activeScene] = {...captureScene(scenes[activeScene].name, scenes[activeScene].duration), id:scenes[activeScene].id};
    applyScene(activeScene+1);
  };
  sceneAdvanceHook = advanceScene;
  bindSlider('sceneDuration', v => { if(scenes[activeScene]) scenes[activeScene].duration=v; });
  document.getElementById('sceneTransition').addEventListener('change', e => { if(scenes[activeScene]) scenes[activeScene].transition=e.target.value; });
  document.getElementById('addScene').addEventListener('click',()=>{
    if(scenes.length>=12){setStatus('A sequence can contain up to 12 scenes');return;}
    scenes.push(captureScene('Scene '+(scenes.length+1),16));applyScene(scenes.length-1);
  });
  document.getElementById('duplicateScene').addEventListener('click',()=>{
    const copy=JSON.parse(JSON.stringify(scenes[activeScene]));copy.id=Date.now();copy.name+=' copy';scenes.splice(activeScene+1,0,copy);applyScene(activeScene+1);
  });
  document.getElementById('deleteScene').addEventListener('click',()=>{
    if(scenes.length===1){setStatus('Keep at least one scene');return;}scenes.splice(activeScene,1);applyScene(Math.min(activeScene,scenes.length-1));
  });
  document.getElementById('renameScene').addEventListener('click',()=>{
    const name=prompt('Scene name',scenes[activeScene].name);
    if(name&&name.trim()){scenes[activeScene].name=name.trim().slice(0,32);renderScenes();}
  });
  const moveScene=delta=>{
    const next=activeScene+delta;if(next<0||next>=scenes.length)return;
    [scenes[activeScene],scenes[next]]=[scenes[next],scenes[activeScene]];activeScene=next;renderScenes();
  };
  document.getElementById('moveSceneLeft').addEventListener('click',()=>moveScene(-1));
  document.getElementById('moveSceneRight').addEventListener('click',()=>moveScene(1));
  setInterval(()=>{
    if(document.getElementById('runScenes').checked && scenes[activeScene] &&
      performance.now()-sceneStartedAt>=scenes[activeScene].duration*1000) advanceScene();
  },500);
  renderScenes();

  // Selection range, waveform, and export estimate.
  const rangeStart=document.getElementById('rangeStart'), rangeEnd=document.getElementById('rangeEnd');
  const updateRange=()=>{
    if(+rangeStart.value>=+rangeEnd.value) {
      if(document.activeElement===rangeStart) rangeStart.value=Math.max(0,+rangeEnd.value-1);
      else rangeEnd.value=Math.min(100,+rangeStart.value+1);
    }
    document.getElementById('rangeStartVal').textContent=rangeStart.value+'%';
    document.getElementById('rangeEndVal').textContent=rangeEnd.value+'%';
    const pct=(+rangeEnd.value-+rangeStart.value)/100;
    const seconds=audioEl&&isFinite(audioEl.duration)?audioEl.duration*pct:0;
    const quality=document.getElementById('quality').value;
    const mbps=quality==='high'?8:quality==='standard'?5:2.5;
    document.getElementById('exportEstimate').textContent=seconds
      ? `${fmtTime(seconds)} selected · approximately ${Math.ceil(seconds*mbps/8)} MB`
      : `${Math.round(pct*100)}% of the loaded track will export`;
  };
  [rangeStart,rangeEnd,document.getElementById('quality')].forEach(el=>el.addEventListener('input',updateRange));
  updateRange();

  let waveformSamples=null;
  const renderWaveform=()=>{
    const canvasWave=document.getElementById('waveform'),ctx=canvasWave.getContext('2d');
    if(!waveformSamples)return;
    const data=waveformSamples,W=canvasWave.width,H=canvasWave.height,zoom=+document.getElementById('waveZoom').value;
    const visible=Math.floor(data.length/zoom),step=Math.max(1,Math.ceil(visible/W));
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#101418';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d9ff63';ctx.beginPath();
    for(let x=0;x<W;x++){let min=1,max=-1;for(let j=0;j<step;j++){const v=data[x*step+j]||0;if(v<min)min=v;if(v>max)max=v;}ctx.moveTo(x,(1+min)*H/2);ctx.lineTo(x,(1+max)*H/2);}
    ctx.stroke();
  };
  document.getElementById('waveZoom').addEventListener('input',renderWaveform);
  async function drawWaveform(file) {
    const canvasWave=document.getElementById('waveform'),ctx=canvasWave.getContext('2d');
    try{
      const tempCtx=new (window.AudioContext||window.webkitAudioContext)();
      const buf=await tempCtx.decodeAudioData(await file.arrayBuffer());
      waveformSamples=buf.getChannelData(0);renderWaveform();await tempCtx.close();
    }catch(e){ctx.clearRect(0,0,canvasWave.width,canvasWave.height);}
  }
  window.luminariumDrawWaveform=drawWaveform;
  window.lightLabDrawWaveform=drawWaveform; // Legacy handoff compatibility.

  // Automatic local recovery for accidental refreshes.
  const captureSession=()=>({version:3,scenes,activeScene,mode:engine.mode,palette:+palSel.value||0,
    controls:Object.fromEntries(['segments','sensitivity','trails','spin','colorSpeed','bassGain','midGain','trebleGain','beatThreshold','effectStrength'].map(id=>[id,document.getElementById(id).value])),
    macros:Object.fromEntries(macroIds.map(id=>[id,document.getElementById(id).value])),
    renderer:{bloomStrength:engine.config.bloomStrength,exposure:engine.config.exposure,contrast:engine.config.contrast,
      backgroundStrength:engine.config.backgroundStrength,beatScale:engine.config.beatScale,particleDensity:engine.config.particleDensity},
    effects:{...effectState},mapping:{...audioMapping}});
  setInterval(()=>localStorage.setItem('luminariumSession',JSON.stringify(captureSession())),2000);
  try{
    const recovered=JSON.parse(localStorage.getItem('luminariumSession')||localStorage.getItem('lightLabSession'));
    if(recovered&&[2,3].includes(recovered.version)){
      if(Array.isArray(recovered.scenes)&&recovered.scenes.length){scenes=recovered.scenes;activeScene=Math.min(recovered.activeScene||0,scenes.length-1);}
      Object.entries(recovered.controls||{}).forEach(([id,v])=>{if(document.getElementById(id))setRange(id,v);});
      Object.assign(effectState,recovered.effects||{});Object.assign(audioMapping,recovered.mapping||{});
      if(recovered.version===3){Object.entries(recovered.macros||{}).forEach(([id,v])=>{if(macroIds.includes(id))setMacro(id,v);});engine.setConfig(recovered.renderer||{});}
      applyScene(activeScene);setStatus('Last Luminarium session restored');
      localStorage.setItem('luminariumSession',JSON.stringify({...recovered,version:3}));
    }
  }catch(e){}

  // ---------- Transport bar (file playback only) ----------
  const transport = document.getElementById('transport');
  const tPlay = document.getElementById('tPlay');
  const tLoop = document.getElementById('tLoop');
  const seek = document.getElementById('seek');
  const tTime = document.getElementById('tTime');
  let seeking = false;

  const fmtTime = s => {
    if (!isFinite(s)) s = 0;
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  };
  const setPlayUI = playing => { tPlay.textContent = playing ? '⏸' : '▶'; };

  function setTransportPaused(paused) {
    if (!audioEl) return;
    if (paused) {
      audioEl.pause();
      visualPaused = true;   // freeze the frame, not just the sound
    } else {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      audioEl.play();
      visualPaused = false;
    }
    setPlayUI(!paused);
  }

  function wireTransport() {
    // audioEl is recreated per file — rebind each load
    transport.classList.add('show');
    setPlayUI(true);
    tLoop.classList.toggle('on', audioEl.loop);
    audioEl.addEventListener('timeupdate', () => {
      if (!seeking && audioEl.duration) {
        seek.value = Math.round(audioEl.currentTime / audioEl.duration * 1000);
      }
      tTime.textContent = fmtTime(audioEl.currentTime) + ' / ' + fmtTime(audioEl.duration);
    });
    audioEl.addEventListener('ended', () => setTransportPaused(true));
  }

  function hideTransport() {
    transport.classList.remove('show');
    visualPaused = false;
  }

  tPlay.addEventListener('click', () => setTransportPaused(audioEl && !audioEl.paused));
  tLoop.addEventListener('click', () => {
    if (!audioEl) return;
    audioEl.loop = !audioEl.loop;
    tLoop.classList.toggle('on', audioEl.loop);
  });
  const seekTo = () => {
    if (audioEl && audioEl.duration) audioEl.currentTime = (seek.value / 1000) * audioEl.duration;
  };
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('input', () => {
    if (audioEl && audioEl.duration) {
      tTime.textContent = fmtTime((seek.value / 1000) * audioEl.duration) + ' / ' + fmtTime(audioEl.duration);
    }
  });
  seek.addEventListener('change', () => { seekTo(); seeking = false; });

  async function loadAudioSource(file, statusMessage = 'Playing: ' + file.name, sourceButton = document.getElementById('srcFile')) {
    await useAudioFile(file);
    visualPaused = false;
    wireTransport();
    selectChip('.src-chip', sourceButton);
    document.getElementById('trackName').textContent = file.name;
    if (window.luminariumDrawWaveform) window.luminariumDrawWaveform(file);
    setStatus(statusMessage);
  }

  // Source buttons
  document.getElementById('srcTouch').addEventListener('click', function () {
    useTouchOnly();
    hideTransport();
    selectChip('.src-chip', this);
    setStatus('Touch mode — drag, swipe and hold anywhere');
  });
  document.getElementById('srcMic').addEventListener('click', async function () {
    try {
      await useMic();
      hideTransport();
      selectChip('.src-chip', this);
      setStatus('Listening — play some music near your mic');
    } catch (e) {
      setStatus('Mic permission denied — staying in touch mode');
    }
  });
  document.getElementById('srcFile').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', async function () {
    const f = this.files && this.files[0];
    if (!f) return;
    try {
      await loadAudioSource(f);
    } catch (e) {
      setStatus('Could not play that file');
    }
    this.value = '';   // re-selecting the same file fires change again
  });
  const handoffBtn = document.getElementById('srcHandoff');
  let latestHandoff = null;
  if (window.CreativeHandoff) {
    window.CreativeHandoff.getLatestAudio().then(item => {
      if (!item || !item.blob) return;
      latestHandoff = item;
      handoffBtn.hidden = false;
      handoffBtn.textContent = 'Use ' + item.name.replace(/\.[^.]+$/, '');
      if (new URLSearchParams(location.search).get('handoff') === '1') handoffBtn.click();
    }).catch(() => {});
  }
  handoffBtn.addEventListener('click', async () => {
    if (!latestHandoff) return;
    try {
      const file = new File([latestHandoff.blob], latestHandoff.name, { type: latestHandoff.blob.type || 'audio/wav' });
      await loadAudioSource(file, 'Music Sandbox export loaded: ' + file.name, handoffBtn);
    } catch (e) {
      setStatus('The latest Music Sandbox export could not be loaded');
    }
  });

  // Fullscreen (feature-detected, like the arcade)
  const fsBtn = document.getElementById('fsBtn');
  if (document.documentElement.requestFullscreen) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });
    document.getElementById('fsBtn2').addEventListener('click', () => fsBtn.click());
  } else {
    fsBtn.style.display = 'none';
    document.getElementById('fsBtn2').style.display = 'none';
  }

  // Drawer toggle (mobile keeps the canvas full-bleed)
  const drawer = document.getElementById('drawer');
  document.getElementById('drawerBtn').addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  // ---------- Clean mode (chrome-free frame for screen capture) ----------
  const cleanHint = document.getElementById('cleanHint');
  let hintTimer = null;
  function setClean(on) {
    document.body.classList.toggle('clean', on);
    if (on) {
      drawer.classList.remove('open');
      cleanHint.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => cleanHint.classList.remove('show'), 2600);
    } else {
      cleanHint.classList.remove('show');
    }
  }
  document.getElementById('cleanBtn').addEventListener('click', () => setClean(true));
  document.getElementById('cleanBtnBottom').addEventListener('click', () => setClean(true));
  document.getElementById('cleanExit').addEventListener('click', () => setClean(false));
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { setClean(false); closeControls(); if (!tutorialBackdrop.hidden) closeTutorial(); }
    if (e.key === 'r' || e.key === 'R') toggleRecording();
  });
  if (new URLSearchParams(location.search).get('clean') === '1') setClean(true);

  // ---------- WebM recording (canvas + active audio source) ----------
  // WebM by design: browsers can't encode MP4 in JS without a ~30MB WASM
  // encoder — against the no-libraries rule. Any free converter makes MP4.
  const recBtn = document.getElementById('recBtn');
  const REC_MAX_MS = 30 * 60 * 1000;
  let recorder = null, recChunks = [], recTick = null, recStartedAt = 0, audioDest = null, wakeLock = null, selectedEnd = null, recordingSize = null, loopBeforeRecording = null;

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function toggleRecording() {
    if (recorder) { stopRecording(); return; }
    const fps = +document.getElementById('exportFps').value;
    recordingSize = getOutputSize();
    engine.resolutionLock = true;
    engine.setOutputSize(recordingSize.width, recordingSize.height);
    frame(performance.now());
    const stream = canvas.captureStream(fps);
    // Mix in the live audio graph (file or mic) alongside the canvas track
    if (analyser && sourceMode !== 'touch') {
      if (!audioDest) audioDest = audioCtx.createMediaStreamDestination();
      analyser.connect(audioDest);
      const track = audioDest.stream.getAudioTracks()[0];
      if (track) stream.addTrack(track);
    }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';
    const quality = document.getElementById('quality').value;
    const bitRate = quality === 'high' ? 8_000_000 : quality === 'standard' ? 5_000_000 : 2_500_000;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitRate });
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      if (audioDest) { try { analyser.disconnect(audioDest); } catch (disconnectError) {} }
      engine.resolutionLock = false;
      engine.clearOutputSize();
      applyRatio();
      recordingSize = null;
      setStatus('This browser could not start the selected video export');
      return;
    }
    recChunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(recTick);
      if (audioDest) { try { analyser.disconnect(audioDest); } catch (e) {} }
      engine.resolutionLock = false;
      engine.clearOutputSize();
      applyRatio();
      const blob = new Blob(recChunks, { type: 'video/webm' });
      recChunks = [];
      recorder = null;
      selectedEnd = null;
      if (audioEl && loopBeforeRecording !== null) {
        audioEl.loop = loopBeforeRecording;
        tLoop.classList.toggle('on', audioEl.loop);
      }
      loopBeforeRecording = null;
      if (wakeLock) { wakeLock.release().catch(()=>{}); wakeLock=null; }
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      a.href = URL.createObjectURL(blob);
      a.download = 'luminarium-' + ts + '.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      recBtn.classList.remove('rec');
      recBtn.textContent = '● Begin video export';
      document.getElementById('recBtnBottom').classList.remove('rec');
      document.getElementById('recBtnBottom').textContent = 'Export video';
      setStatus(`Saved ${recordingSize.width}×${recordingSize.height} WebM with audio`);
      recordingSize = null;
    };
    if (audioEl && isFinite(audioEl.duration)) {
      loopBeforeRecording = audioEl.loop;
      audioEl.loop = false;
      tLoop.classList.remove('on');
      const selectedRange = document.getElementById('exportRange').value === 'selection';
      audioEl.currentTime = selectedRange ? audioEl.duration * (+document.getElementById('rangeStart').value / 100) : 0;
      selectedEnd = selectedRange ? audioEl.duration * (+document.getElementById('rangeEnd').value / 100) : audioEl.duration;
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      audioEl.play();
      visualPaused = false;
      setPlayUI(true);
    }
    recorder.start(250);
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(lock=>{wakeLock=lock;}).catch(()=>{});
    recStartedAt = performance.now();
    recBtn.classList.add('rec');
    document.getElementById('recBtnBottom').classList.add('rec');
    recTick = setInterval(() => {
      const el = (performance.now() - recStartedAt) / 1000;
      recBtn.textContent = '■ ' + fmtTime(el);
      document.getElementById('recBtnBottom').textContent = 'Stop ' + fmtTime(el);
      if (el * 1000 >= REC_MAX_MS || (selectedEnd!==null && audioEl && audioEl.currentTime>=selectedEnd)) stopRecording();
    }, 500);
    setStatus(`Recording ${recordingSize.width}×${recordingSize.height} at ${fps} FPS · press R to stop`);
  }

  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    recBtn.style.display = 'none';
    document.getElementById('recBtnBottom').style.display = 'none';
  } else {
    recBtn.addEventListener('click', toggleRecording);
    document.getElementById('recBtnBottom').addEventListener('click', toggleRecording);
  }

  document.getElementById('uploadIcon').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('mobileControls').addEventListener('click', () => {
    document.body.classList.add('controls-open');
  });

  const resetLuminarium = () => {
    if (recorder) {
      setStatus('Stop the current recording before resetting');
      return;
    }
    useTouchOnly();
    hideTransport();
    waveformSamples = null;
    const waveformCanvas = document.getElementById('waveform');
    waveformCanvas.getContext('2d').clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    document.getElementById('trackName').textContent = 'No audio loaded';
    seek.value = 0;
    tTime.textContent = '0:00 / 0:00';
    selectChip('.src-chip', document.getElementById('srcTouch'));

    autoMode = false;
    autoDirectorBtn.textContent = '✦ Start Auto Director';
    autoDirectorBtn.classList.remove('is-running');
    document.querySelector('.preset[data-preset="neon"]').click();

    Object.assign(effectState, { bloom:true, grain:false, vignette:false, chromatic:false, blur:false,
      flicker:false, strobe:false, glitch:false, mirrorX:false, flipY:false, strength:.45 });
    document.querySelectorAll('.effect-toggle').forEach(toggle => { toggle.checked = !!effectState[toggle.dataset.effect]; });
    setRange('effectStrength', 45);
    Object.assign(audioMapping, { bass:'scale', mid:'warp', treble:'glow', beat:'pulse' });
    ['bass','mid','treble','beat'].forEach(band => { document.getElementById(band + 'Map').value = audioMapping[band]; });

    gravityMode = 'attract'; gravityStrength = .65;
    gravityAttract.checked = true; gravityRepel.checked = false;
    gravitySlider.value = 65; gravityLabel.textContent = '65%';
    document.getElementById('artistText').value = '';
    document.getElementById('trackText').value = '';
    document.getElementById('titleStyle').value = 'cinema';
    document.getElementById('showTitles').checked = false;
    refreshOverlay();

    scenes = [captureScene('Scene 1',16), {...captureScene('Scene 2',16), mode:'wave-mirror', palette:5}];
    activeScene = 0; sceneStartedAt = performance.now(); renderScenes();
    document.getElementById('runScenes').checked = false;
    document.querySelector('.ratio-btn[data-ratio="16/9"]').click();
    document.getElementById('quality').value = 'high';
    document.getElementById('exportFps').value = '30';
    document.getElementById('exportRange').value = 'full';
    rangeStart.value = 0; rangeEnd.value = 100; updateRange(); updateOutputBadge();

    localStorage.removeItem('luminariumSetup');
    localStorage.removeItem('luminariumSession');
    localStorage.removeItem('lightLabSetup');
    localStorage.removeItem('lightLabSession');
    closeControls();
    setConsole('explore');
    setStatus('The Luminarium has been reset to its opening state');
  };
  document.querySelectorAll('.global-reset').forEach(button => button.addEventListener('click', resetLuminarium));

  window.addEventListener('beforeunload', e => {
    if (!recorder) return;
    e.preventDefault();
    e.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !recorder) visualPaused = true;
    else if (!document.hidden) visualPaused = false;
  });

  running = true;
  requestAnimationFrame(loop);
});

console.log('The Luminarium ready');
