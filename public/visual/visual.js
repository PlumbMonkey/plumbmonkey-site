// ============================================================
// GHOST CIRCUIT — LIGHT LAB (visual sandbox)
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
    this.config = { ...this.config, ...partial };
    if (partial.segments !== undefined && partial.segments !== prevSegments) {
      this.initParticles();
      this.initFireflies();
    }
    if (partial.fireflyCount !== undefined && partial.fireflyCount !== prevFireflies) {
      this.initFireflies();
    }
  }

  setMode(mode) {
    this.mode = mode;
    // No layer clearing: the destination-out trail fade dissolves the old
    // mode over ~a second while the new one draws in — a free crossfade.
    if (mode === 'firefly-nebula' && this.fireflies.length !== this.config.fireflyCount) {
      this.initFireflies();
    }
  }

  applyRenderSize() {
    this.width  = Math.max(1, Math.floor(this.viewWidth  * this.pixelRatio * this.resolutionScale));
    this.height = Math.max(1, Math.floor(this.viewHeight * this.pixelRatio * this.resolutionScale));
    // Oversized square buffers: content at any rotation is never clipped
    this.bufferSize = Math.ceil(Math.hypot(this.width, this.height));
    this.canvas.width = this.width; this.canvas.height = this.height;
    this.bloomCanvas.width = this.width; this.bloomCanvas.height = this.height;
    for (const c of [this.layerCore, this.layerWeb, this.layerCloud, this.wedgeCanvas]) {
      c.width = this.bufferSize; c.height = this.bufferSize;
    }
    // bg is a square at the diagonal size so it covers the frame at any rotation
    this.bgCanvas.width = this.bgCanvas.height = this.bufferSize;
    this.buildBackground();
    // Particle budget scales with CSS-pixel area (NOT device pixels — a
    // dPR-2 phone would otherwise get a bigger budget than a desktop)
    this.particleCount = Math.round(clamp((this.viewWidth * this.viewHeight) / 600, 350, 1400));
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
    const nearSq = (this.bufferSize * 0.055) ** 2;   // orbit radius scales with screen
    for (const w of this.wells) {
      const dr = w.r - body.r;
      const dt = (w.theta - body.theta) * Math.max(40, body.r);
      const dSq = dr * dr + dt * dt;
      const falloff = 1 / (1 + dSq * 0.00012);         // soft long-range pull
      const orbit = dSq < nearSq ? -1.8 : 1;           // flip to repulsion up close
      const f = w.strength * falloff * orbit;
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

    const beatScale = beat ? 1.025 : 1.0;
    const bassScale = 1.0 + bass * audioSensitivity * 0.05;
    const speedMult = 1 + treble * audioSensitivity * 3.5;

    this.rotKaleido = (this.rotKaleido + rotSpeed * (0.006 + bass * 0.012)) % (Math.PI * 2);

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
    ctx.drawImage(this.bgCanvas, -this.bufferSize / 2, -this.bufferSize / 2);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + this.shakeX, cy + this.shakeY);
    ctx.scale(beatScale * bassScale, beatScale * bassScale);
    this.stampLayer(this.layerCore,  segments, angleStep, this.rotKaleido);
    this.stampLayer(this.layerWeb,   segments, angleStep, this.rotKaleido);
    this.stampLayer(this.layerCloud, segments, angleStep, this.rotKaleido);
    ctx.restore();
    this.applyBloom(W, H, treble);
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
    ctx.globalAlpha = 0.22 + treble * 0.34;
    ctx.drawImage(this.bloomCanvas, 0, 0);
    ctx.globalAlpha = 0.10 + treble * 0.09;
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
let sourceMode = 'touch';   // 'touch' | 'mic' | 'file'

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

// ============================================================
// POINTER / TOUCH — the always-on input. Finger speed becomes
// "treble", pressing becomes "bass", so every mode reacts to
// touch even with no audio at all.
// ============================================================
const pointers = new Map();     // pointerId -> {x, y, vx, vy, downAt}
let pointerEnergy = 0;          // smoothed swipe speed 0..1
let pressEnergy = 0;            // smoothed hold amount 0..1
let tapBeat = false;            // one-frame beat on pointerdown
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
    const bass = bandAverage(0, 0.08);
    const mid = bandAverage(0.08, 0.34);
    const treble = bandAverage(0.34, 1);
    const overall = (bass + mid + treble) / 3;
    const now = performance.now();
    let beat = bass > 0.62 && overall > 0.38 && now - lastBeatAt > 180;
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

// Auto mode: cycle render modes on strong beats (or a timer), using the
// engine's soft no-clear transitions so it feels alive with no input
const MODE_ORDER = ['firefly-nebula', 'neural-strings', 'geometric-pulse', 'fractal-warp'];
const MODE_LABEL = { 'firefly-nebula': 'Firefly Nebula', 'neural-strings': 'Neural Strings',
                     'geometric-pulse': 'Geometric Pulse', 'fractal-warp': 'Fractal Warp' };
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

  // Feed pointer wells into the engine (attract while held)
  const wellList = [];
  pointers.forEach(p => { wellList.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, strength: 1 }); });
  engine.setPointerWells(wellList);

  const bands = getBands();
  tapBeat = false;

  // Auto mode: advance on a strong beat once settled, or force after 30s
  if (autoMode) {
    const since = now - lastModeSwitch;
    if ((since > 16000 && bands.beat && bands.bass > 0.5) || since > 30000) {
      autoIdx = (autoIdx + 1) % MODE_ORDER.length;
      engine.setMode(MODE_ORDER[autoIdx]);
      lastModeSwitch = now;
      setStatus('Auto — ' + MODE_LABEL[MODE_ORDER[autoIdx]]);
    }
  }

  // Same param mapping as V2's MappingEngine defaults
  const params = {
    warp: 1.2 + bands.mid * 1.2,
    glow: 1.0 + bands.treble * 0.8,
    pulse: bands.bass,
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
  const canvas = document.getElementById('stage');
  engine = new VisualEngine(canvas);
  engine.setPalette(PALETTES[0]);

  const mount = document.getElementById('stageWrap');
  const doResize = () => engine.resize(mount.clientWidth, mount.clientHeight);
  doResize();
  window.addEventListener('resize', doResize);

  attachPointerHandlers(canvas, engine);

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
      await useAudioFile(f);
      visualPaused = false;
      wireTransport();
      selectChip('.src-chip', document.getElementById('srcFile'));
      setStatus('Playing: ' + f.name);
    } catch (e) {
      setStatus('Could not play that file');
    }
    this.value = '';   // re-selecting the same file fires change again
  });

  // Fullscreen (feature-detected, like the arcade)
  const fsBtn = document.getElementById('fsBtn');
  if (document.documentElement.requestFullscreen) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });
  } else {
    fsBtn.style.display = 'none';
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
  document.getElementById('cleanExit').addEventListener('click', () => setClean(false));
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') setClean(false);
    if (e.key === 'r' || e.key === 'R') toggleRecording();
  });
  if (new URLSearchParams(location.search).get('clean') === '1') setClean(true);

  // ---------- WebM recording (canvas + active audio source) ----------
  // WebM by design: browsers can't encode MP4 in JS without a ~30MB WASM
  // encoder — against the no-libraries rule. Any free converter makes MP4.
  const recBtn = document.getElementById('recBtn');
  const REC_MAX_MS = 5 * 60 * 1000;   // safety cap: an unattended recorder fills memory
  let recorder = null, recChunks = [], recTick = null, recStartedAt = 0, audioDest = null;

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function toggleRecording() {
    if (recorder) { stopRecording(); return; }
    const stream = canvas.captureStream(60);
    // Mix in the live audio graph (file or mic) alongside the canvas track
    if (analyser && sourceMode !== 'touch') {
      if (!audioDest) audioDest = audioCtx.createMediaStreamDestination();
      analyser.connect(audioDest);
      const track = audioDest.stream.getAudioTracks()[0];
      if (track) stream.addTrack(track);
    }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    recChunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(recTick);
      if (audioDest) { try { analyser.disconnect(audioDest); } catch (e) {} }
      engine.resolutionLock = false;
      const blob = new Blob(recChunks, { type: 'video/webm' });
      recChunks = [];
      recorder = null;
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      a.href = URL.createObjectURL(blob);
      a.download = 'light-lab-' + ts + '.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      recBtn.classList.remove('rec');
      recBtn.textContent = '● Record';
      setStatus('Saved .webm — drop it in any free converter if you need MP4');
    };
    engine.resolutionLock = true;   // canvas resize mid-capture breaks the stream
    recorder.start(250);
    recStartedAt = performance.now();
    recBtn.classList.add('rec');
    recTick = setInterval(() => {
      const el = (performance.now() - recStartedAt) / 1000;
      recBtn.textContent = '■ ' + fmtTime(el);
      if (el * 1000 >= REC_MAX_MS) stopRecording();
    }, 500);
    setStatus('Recording… press R or the button to stop (max 5:00)');
  }

  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    recBtn.style.display = 'none';
  } else {
    recBtn.addEventListener('click', toggleRecording);
  }

  running = true;
  requestAnimationFrame(loop);
});

console.log('Ghost Circuit Light Lab ready');
