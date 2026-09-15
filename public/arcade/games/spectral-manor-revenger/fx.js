// ============================================================
// REVENGER — effects: sound, glow cache, laser beams, explosions, shake.
// Nothing in here reads or writes rules state, and it only uses Math.random,
// so turning FX off (FX.enabled = false) cannot change how a run plays.
// ============================================================

// ---------- Sound (Web Audio, layered noise + dive + sub) ----------
let audioCtx = null;
function initAudio() {
  if (typeof ArcadeAudio === 'undefined') return;
  if (!audioCtx) audioCtx = ArcadeAudio.context();
  ArcadeAudio.resume();
}
function muted() { return !audioCtx || (typeof Arcade !== 'undefined' && Arcade.attract); }
function soundPan(screenX) { return Math.max(-0.7, Math.min(0.7, (screenX / W) * 1.4 - 0.7)); }
function out(pan, bus) { return ArcadeAudio.output(bus || 'sfx', pan || 0); }

function playTone(f0, dur, type = 'square', vol = 0.08, f1 = 0, pan = 0, delay = 0, bus) {
  if (muted()) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(out(pan, bus));
  o.start(t); o.stop(t + dur + 0.02);
}
function playNoise(dur, vol = 0.06, filter = 'lowpass', f0 = 900, f1 = 0, pan = 0, delay = 0) {
  if (muted()) return;
  const t = audioCtx.currentTime + delay;
  const len = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource(); n.buffer = buf;
  const bq = audioCtx.createBiquadFilter(); bq.type = filter;
  bq.frequency.setValueAtTime(f0, t);
  if (f1) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(bq); bq.connect(g); g.connect(out(pan));
  n.start(t);
}

const sfx = {
  // Defender zap: a bright saw dive over a square body, a sub thump and a crack.
  laser(pan, level) {
    const f = 2100 + level * 220 + Math.random() * 300;
    playTone(f, 0.12, 'sawtooth', 0.09, 160, pan);
    playTone(f * 0.5, 0.09, 'square', 0.045, 90, pan);
    playTone(150, 0.1, 'sine', 0.08, 45, pan);
    playNoise(0.04, 0.06, 'highpass', 2200, 0, pan);
    if (level >= 3) playTone(900, 0.16, 'triangle', 0.04, 2400, pan);
  },
  explode(size, pan) {
    const s = Math.min(4, size);
    playNoise(0.18 + s * 0.12, 0.08 + s * 0.02, 'lowpass', 1400 + s * 300, 90, pan);
    playTone(130 - s * 15, 0.2 + s * 0.1, 'sawtooth', 0.05 + s * 0.012, 35, pan);
    playTone(70, 0.25 + s * 0.08, 'sine', 0.08 + s * 0.02, 28, pan);
    if (s >= 3) playNoise(0.9, 0.08, 'lowpass', 500, 60, pan, 0.08);
  },
  chord() { // the Power Chord smart bomb: a distorted E5 stab over a boom
    [82.4, 123.5, 164.8].forEach(f => playTone(f, 0.9, 'sawtooth', 0.07, f * 0.98));
    playNoise(1.1, 0.12, 'lowpass', 2400, 80);
    playTone(55, 0.8, 'sine', 0.16, 30);
  },
  hit() { playTone(220, 0.25, 'sawtooth', 0.09, 60); playNoise(0.3, 0.08, 'lowpass', 1200, 100); },
  shield() { playTone(900, 0.18, 'triangle', 0.07, 300); playNoise(0.12, 0.05, 'bandpass', 3000, 800); },
  pickup() { [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.09, 'square', 0.05, 0, 0, i * 0.055)); },
  catchFan() { playTone(660, 0.08, 'triangle', 0.06, 990); },
  rescue() { [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.12, 'triangle', 0.06, 0, 0, i * 0.06)); },
  abduct() { playTone(240, 0.5, 'sawtooth', 0.05, 70); playTone(120, 0.55, 'triangle', 0.04, 50); },
  fanLost() { playTone(300, 0.35, 'square', 0.05, 90); },
  warp() { playTone(200, 0.35, 'sine', 0.08, 2400); playNoise(0.35, 0.05, 'bandpass', 400, 4000); },
  rift() { playTone(60, 2.2, 'sawtooth', 0.09, 30); playTone(95, 2, 'square', 0.04, 47); playNoise(2.2, 0.08, 'lowpass', 3000, 60); },
  warning() { [0, 0.28, 0.56].forEach(d => playTone(440, 0.2, 'square', 0.05, 330, 0, d)); },
  extraLife() { [784, 988, 1175, 1568].forEach((f, i) => playTone(f, 0.1, 'square', 0.05, 0, 0, i * 0.07)); },
  enemyShot(pan) { playTone(700, 0.1, 'square', 0.03, 260, pan); },
  mine(pan) { playTone(180, 0.08, 'triangle', 0.03, 120, pan); },
  gameOver() { playTone(300, 0.3, 'sawtooth', 0.07, 200); playTone(200, 0.5, 'sawtooth', 0.07, 90, 0, 0.3); }
};

// ---------- Pre-rendered glow sprites ----------
const glowCache = {};
function glowSprite(color, r) {
  const k = color + '|' + r;
  if (glowCache[k]) return glowCache[k];
  const cv = document.createElement('canvas');
  cv.width = cv.height = r * 2;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.globalAlpha = 1;
  g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  return (glowCache[k] = cv);
}
function drawGlow(c, color, x, y, r, alpha = 1) {
  const s = glowSprite(color, Math.max(4, Math.round(r)));
  const a = c.globalAlpha;
  c.globalAlpha = a * alpha;
  c.drawImage(s, x - s.width / 2, y - s.height / 2);
  c.globalAlpha = a;
}

// ---------- Laser beams ----------
/* A beam grows from the nose: its head races ahead and the tail follows once
   the beam is at full length. The tail cycles through colours like Defender's
   rainbow laser; the core is white and drawn additively. */
function beamHue(b, k) { return (b.hue + k * 140 + b.age * 9) % 360; }
function drawBeam(c, b, originSX, alpha = 1) {
  const hx = originSX + b.dir * b.head, tx = originSX + b.dir * b.tail;
  if (Math.max(hx, tx) < -40 || Math.min(hx, tx) > W + 40) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = alpha;
  c.lineCap = 'round';
  const grad = c.createLinearGradient(tx, b.y, hx, b.y);
  grad.addColorStop(0, `hsla(${beamHue(b, 0)},100%,60%,0)`);
  grad.addColorStop(0.45, `hsla(${beamHue(b, 0.5)},100%,62%,0.55)`);
  grad.addColorStop(1, `hsla(${beamHue(b, 1)},100%,75%,0.95)`);
  const path = () => {
    c.beginPath();
    if (b.kind === 'wave') {
      const n = Math.max(2, Math.ceil(Math.abs(hx - tx) / 8));
      for (let i = 0; i <= n; i++) {
        const x = tx + (hx - tx) * (i / n);
        const y = b.y + Math.sin((b.tail + (b.head - b.tail) * (i / n)) * 0.045 - b.age * 0.5) * b.h * 0.4;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
    } else { c.moveTo(tx, b.y); c.lineTo(hx, b.y); }
  };
  c.strokeStyle = grad;
  c.lineWidth = b.kind === 'wave' ? 10 : 8; path(); c.stroke();
  c.lineWidth = 3.2; path(); c.stroke();
  const core = c.createLinearGradient(tx, b.y, hx, b.y);
  core.addColorStop(0, 'rgba(255,255,255,0)');
  core.addColorStop(1, 'rgba(255,255,255,0.95)');
  c.strokeStyle = core; c.lineWidth = 1.4; path(); c.stroke();
  drawGlow(c, `hsl(${beamHue(b, 1)},100%,70%)`, hx, b.y, 14, 0.9);
  drawGlow(c, '#ffffff', hx, b.y, 5, 1);
  c.restore();
}

// ---------- Explosions and screen juice ----------
const FX = {
  enabled: true,
  flashes: [], rings: [], shards: [], smoke: [], embers: [], sparks: [], ghosts: [], popups: [],
  shakeAmt: 0, shakeT: 0, sx: 0, sy: 0, screenFlash: 0, flashColor: '#ffffff',

  reset() {
    ['flashes', 'rings', 'shards', 'smoke', 'embers', 'sparks', 'ghosts', 'popups'].forEach(k => { this[k] = []; });
    this.shakeAmt = 0; this.shakeT = 0; this.sx = 0; this.sy = 0; this.screenFlash = 0;
  },
  shake(amount, frames) {
    if (!this.enabled) return;
    if (amount >= this.shakeAmt || this.shakeT <= 0) { this.shakeAmt = amount; this.shakeT = frames; }
  },
  flash(alpha, color = '#ffffff') {
    if (!this.enabled) return;
    if (alpha > this.screenFlash) { this.screenFlash = alpha; this.flashColor = color; }
  },
  /* size: 1 swarmer · 2 lander · 3 big craft / ship · 4 mothership.
     White flash → shockwave ring → tumbling shards with gravity → smoke → embers. */
  explode(x, y, size, palette) {
    if (!this.enabled) return;
    const pal = palette || ['#f0abfc', '#c084fc', '#67e8f9', '#ffffff'];
    const R = 18 + size * 18;
    this.flashes.push({ x, y, r: R * 1.1, life: 5 + size * 2, max: 5 + size * 2 });
    this.rings.push({ x, y, r: 4, R: R * 2.2, life: 18 + size * 5, max: 18 + size * 5, color: pal[0], w: 2 + size });
    if (size >= 3) this.rings.push({ x, y, r: 2, R: R * 3.4, life: 34 + size * 6, max: 34 + size * 6, color: '#ffffff', w: 2 });
    const nShard = 6 + size * 7;
    for (let i = 0; i < nShard; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * (2.5 + size * 1.6);
      this.shards.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5,
        s: 2 + Math.random() * (2 + size * 1.5), life: 36 + Math.random() * 34, max: 70, color: pal[i % pal.length] });
    }
    const nSmoke = 3 + size * 3;
    for (let i = 0; i < nSmoke; i++) {
      this.smoke.push({ x: x + (Math.random() - 0.5) * R * 0.6, y: y + (Math.random() - 0.5) * R * 0.6,
        vx: (Math.random() - 0.5) * 0.8, vy: -0.3 - Math.random() * 0.6, r: 6 + size * 3, life: 40 + Math.random() * 30 + size * 8, max: 70 + size * 8 });
    }
    const nEmber = 8 + size * 10;
    for (let i = 0; i < nEmber; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * (2 + size * 1.8);
      this.embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30 + Math.random() * 40, max: 70,
        color: Math.random() < 0.5 ? '#ffd27a' : pal[1 % pal.length] });
    }
    this.shake(2 + size * 2.5, 8 + size * 6);
    if (size >= 3) this.flash(0.25 + (size - 3) * 0.3);
  },
  spark(x, y, color) {
    if (!this.enabled) return;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 10 + Math.random() * 8, max: 18, color });
    }
    this.flashes.push({ x, y, r: 16, life: 4, max: 4 });
  },
  afterimage(beam) {
    if (!this.enabled) return;
    this.ghosts.push({ b: Object.assign({}, beam), life: 9, max: 9 });
  },
  popup(x, y, text, color = '#f0abfc') {
    if (!this.enabled) return;
    this.popups.push({ x, y, text, color, life: 55, max: 55 });
  },

  update() {
    if (this.shakeT > 0) {
      this.shakeT--;
      this.sx = (Math.random() - 0.5) * this.shakeAmt;
      this.sy = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= 0.9;
    } else { this.sx = this.sy = 0; this.shakeAmt = 0; }
    this.screenFlash = Math.max(0, this.screenFlash - 0.04);
    const age = arr => arr.filter(p => --p.life > 0);
    this.flashes = age(this.flashes);
    this.rings.forEach(r => { r.r += (r.R - r.r) * 0.16; });
    this.rings = age(this.rings);
    this.shards.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.vx *= 0.985; p.rot += p.vr; });
    this.shards = age(this.shards);
    this.smoke.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += 0.35; });
    this.smoke = age(this.smoke);
    this.embers.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy = p.vy * 0.96 + 0.04; });
    this.embers = age(this.embers);
    this.sparks.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9; });
    this.sparks = age(this.sparks);
    this.ghosts = age(this.ghosts);
    this.popups.forEach(p => { p.y -= 0.6; });
    this.popups = age(this.popups);
  },

  // World-space effects; toScreen maps world x → screen x.
  draw(c, toScreen) {
    const vis = x => x > -120 && x < W + 120;
    c.save();
    this.smoke.forEach(p => {
      const x = toScreen(p.x); if (!vis(x)) return;
      c.globalAlpha = (p.life / p.max) * 0.35;
      c.fillStyle = '#2a1d3d';
      c.beginPath(); c.arc(x, p.y, p.r, 0, Math.PI * 2); c.fill();
    });
    this.ghosts.forEach(g => drawBeam(c, g.b, toScreen(g.b.x0), (g.life / g.max) * 0.45));
    c.globalCompositeOperation = 'lighter';
    this.rings.forEach(r => {
      const x = toScreen(r.x); if (!vis(x)) return;
      const k = r.life / r.max;
      c.globalAlpha = k;
      c.strokeStyle = r.color; c.lineWidth = r.w * k + 0.5;
      c.beginPath(); c.arc(x, r.y, r.r, 0, Math.PI * 2); c.stroke();
    });
    c.globalAlpha = 1;
    this.flashes.forEach(f => {
      const x = toScreen(f.x); if (!vis(x)) return;
      drawGlow(c, '#ffffff', x, f.y, f.r * (0.6 + 0.4 * (f.life / f.max)), f.life / f.max);
    });
    this.embers.forEach(p => {
      const x = toScreen(p.x); if (!vis(x)) return;
      c.globalAlpha = (p.life / p.max) * (0.6 + Math.random() * 0.4);
      c.fillStyle = p.color; c.fillRect(x - 1, p.y - 1, 2.2, 2.2);
    });
    this.sparks.forEach(p => {
      const x = toScreen(p.x); if (!vis(x)) return;
      c.globalAlpha = p.life / p.max;
      c.strokeStyle = p.color; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, p.y); c.lineTo(x - p.vx * 2.5, p.y - p.vy * 2.5); c.stroke();
    });
    c.globalCompositeOperation = 'source-over';
    this.shards.forEach(p => {
      const x = toScreen(p.x); if (!vis(x)) return;
      c.globalAlpha = Math.min(1, p.life / 25);
      c.save(); c.translate(x, p.y); c.rotate(p.rot);
      c.fillStyle = p.color; c.strokeStyle = '#120b1e'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-p.s, -p.s * 0.5); c.lineTo(p.s, 0); c.lineTo(-p.s * 0.4, p.s * 0.6); c.closePath();
      c.fill(); c.stroke();
      c.restore();
    });
    c.globalAlpha = 1;
    c.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'center';
    this.popups.forEach(p => {
      const x = toScreen(p.x); if (!vis(x)) return;
      c.globalAlpha = Math.min(1, p.life / 20);
      c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 8;
      c.fillText(p.text, x, p.y);
    });
    c.restore();
  },
  drawFlash(c) {
    if (this.screenFlash <= 0) return;
    c.save();
    c.globalAlpha = this.screenFlash;
    c.fillStyle = this.flashColor;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
};
