// ============================================================
// SOUL CIRCUIT — the cast: the Soul, five hunters, bats, pickups, relics
// Drawn at their final maze size (~28px) in the arcade house style: ink
// outline, a shade pass, lit eyes. Bespoke rather than SpriteKit.drawMini —
// these walk, look where they go, cower when scared and fly home as eyes.
// Every draw takes a context `c` so the scratch sprite canvas can reuse it.
// ============================================================

function inkPath(c, pts, fill, w = 1.5) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (w) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); }
}
function inkOval(c, x, y, rx, ry, fill, w = 1.5, rot = 0) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (w) { c.strokeStyle = INK; c.lineWidth = w; c.stroke(); }
}
function litEyes(c, color, lx, ly, gap = 5, w = 2.6, h = 2.2, blur = 6) {
  c.shadowColor = color; c.shadowBlur = blur;
  c.fillStyle = color;
  c.fillRect(lx - gap / 2 - w / 2, ly, w, h);
  c.fillRect(lx + gap / 2 - w / 2, ly, w, h);
  c.shadowBlur = 0;
}

/* ---------------- THE SOUL (player) ----------------
   A lantern-bright spirit with a halo and a flame tail that streams away from
   the direction of travel. The mouth opens as it gathers crystals. */
const SOUL_PALETTES = {
  soul:   { rim: '#a855f7', mid: '#d8b4fe', core: '#faf5ff', tail: '#c084fc', eye: '#2e1065', halo: '#fde68a' },
  field:  { rim: '#db2777', mid: '#f0abfc', core: '#fff1fb', tail: '#e879f9', eye: '#4a044e', halo: '#fef08a' },
  shadow: { rim: '#0b0616', mid: '#312e81', core: '#6366f1', tail: '#1e1b4b', eye: '#f43f5e', halo: '#f43f5e' }
};
function drawSoul(c, x, y, o) {
  const p = SOUL_PALETTES[o.palette || 'soul'];
  const t = o.t || 0, dir = o.dir || { x: 0, y: 0 };
  const moving = dir.x || dir.y;
  const face = o.face || { x: dir.x || 0, y: dir.y || 0 };
  const bob = Math.sin(t * 0.15) * 1.2;
  c.save();
  c.translate(x, y + bob);

  // flame tail, streaming opposite the travel direction (or up at rest)
  const ang = moving ? Math.atan2(-dir.y, -dir.x) : Math.PI / 2;
  c.save();
  c.rotate(ang);
  for (let i = 3; i >= 1; i--) {
    const len = 6 + i * 4.5 + (moving ? 3 : 0), wob = Math.sin(t * 0.3 + i) * 2.2;
    c.globalAlpha = 0.28 + 0.14 * (3 - i);
    c.fillStyle = i === 1 ? p.mid : p.tail;
    c.beginPath();
    c.moveTo(0, -7 + i);
    c.quadraticCurveTo(len * 0.6, -6 + wob, len + 4, wob * 0.6);
    c.quadraticCurveTo(len * 0.6, 6 + wob, 0, 7 - i);
    c.fill();
  }
  c.restore();
  c.globalAlpha = o.alpha == null ? 1 : o.alpha;

  // aura
  c.shadowColor = p.tail; c.shadowBlur = o.palette === 'field' ? 20 : 12;
  const rg = c.createRadialGradient(-2, -3, 1, 0, 0, 10);
  rg.addColorStop(0, p.core); rg.addColorStop(0.55, p.mid); rg.addColorStop(1, p.rim);
  c.fillStyle = rg;
  c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();

  // halo
  c.strokeStyle = p.halo; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(0, -13 + Math.sin(t * 0.1) * 0.8, 6, 2, 0, 0, Math.PI * 2); c.stroke();

  // face looks where it is going
  const lx = face.x * 2.2, ly = face.y * 1.8;
  c.fillStyle = p.eye;
  inkOval(c, -3.4 + lx, -2 + ly, 1.9, 2.8, p.eye, 0);
  inkOval(c, 3.4 + lx, -2 + ly, 1.9, 2.8, p.eye, 0);
  c.fillStyle = '#ffffff';
  c.fillRect(-3.8 + lx, -3.8 + ly, 1.2, 1.2); c.fillRect(3 + lx, -3.8 + ly, 1.2, 1.2);
  c.fillStyle = 'rgba(244,114,182,0.55)';
  c.beginPath(); c.arc(-6 + lx * 0.5, 2.2, 1.6, 0, Math.PI * 2); c.arc(6 + lx * 0.5, 2.2, 1.6, 0, Math.PI * 2); c.fill();
  const chomp = o.chomp || 0;
  if (chomp > 0.05) inkOval(c, lx * 1.2, 3.4 + ly * 0.6, 1.6 + chomp * 1.4, 0.8 + chomp * 2, p.eye, 0);
  else { c.strokeStyle = p.eye; c.lineWidth = 1.2; c.beginPath(); c.arc(lx, 2.4 + ly * 0.5, 2, 0.2, Math.PI - 0.2); c.stroke(); }
  c.restore();
  c.globalAlpha = 1;
}

/* ---------------- HUNTERS ----------------
   Origin = cell centre; feet land at about y+11. `o.dir` mirrors the figure
   and aims the eyes; `o.phase` is walk phase advanced by distance moved. */
const HUNTER_COLORS = { vampire: '#ef4444', witch: '#4ade80', werewolf: '#fbbf24', frank: '#bef264', ghost: '#c4b5fd' };

const HUNTER_ART = {
  vampire(c, o) {
    const s = Math.sin(o.phase), flap = Math.sin(o.t * 0.25) * 1.5;
    // cape, flaring behind
    inkPath(c, [[-5, -7], [-11 - flap, 9], [-4, 7], [0, 10], [4, 7], [11 + flap * 0.4, 9], [5, -7]], '#4a1c4e');
    inkPath(c, [[0, -7], [5, -7], [11, 9], [4, 7]], '#34123a', 0);
    // legs
    c.fillStyle = INK; c.fillRect(-3.5 + s * 1.5, 6, 2.6, 5); c.fillRect(1 - s * 1.5, 6, 2.6, 5);
    // body + sash
    inkPath(c, [[-5, -6], [5, -6], [4, 7], [-4, 7]], '#2e2440');
    inkPath(c, [[-1, -6], [1.5, -6], [2, 6], [-1.5, 6]], '#b91c1c', 0);
    /* Collar sits BELOW the jaw and the eyes glow softly. The first pass put a
       big red collar, a wide widow's peak and a 6px eye glow over one 10px face,
       and at maze size the three merged into a red smear. */
    inkPath(c, [[-7, -7], [-4, -3.5], [0, -5.5], [4, -3.5], [7, -7], [5, -5], [-5, -5]], '#7f1d1d', 1);
    // head
    inkOval(c, 0.5, -11.5, 4.6, 5, '#ece0e4');
    inkPath(c, [[-4.4, -13.2], [-3.8, -16.6], [0.5, -17.2], [4.8, -16.6], [5.2, -13.2], [2.6, -14.6], [0.6, -12.8], [-1.4, -14.6]], '#120a16', 1);
    litEyes(c, '#ff4d5e', 1.2 + o.look.x * 1.1, -11.6 + o.look.y, 4, 1.8, 1.4, 3);
    c.fillStyle = '#fff'; c.fillRect(-0.4, -8.2, 0.9, 1.5); c.fillRect(1.9, -8.2, 0.9, 1.5);
  },
  witch(c, o) {
    const s = Math.sin(o.phase), sway = Math.sin(o.t * 0.12) * 1.2;
    // broom behind
    c.strokeStyle = '#78350f'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, 10); c.lineTo(8, -4); c.stroke();
    inkPath(c, [[-10, 10], [-15, 13], [-13, 7]], '#d97706', 1);
    // robe with swaying hem
    inkPath(c, [[-4, -6], [4, -6], [8 + sway, 10], [3, 8.5], [0, 10.5], [-3, 8.5], [-8 + sway, 10]], '#6d3a8c');
    inkPath(c, [[1, -6], [4, -6], [8 + sway, 10], [3, 8.5]], '#4c2566', 0);
    c.fillStyle = '#16a34a'; c.fillRect(-4 + s, 10, 3, 1.5); c.fillRect(1.5 - s, 10, 3, 1.5);
    // face with long nose
    inkOval(c, 0.5, -9, 4.4, 4.6, '#a3c78a');
    inkPath(c, [[3.5, -9.5], [8.5, -7], [3.5, -7.5]], '#8fb574', 1);
    // hat
    inkPath(c, [[-9, -12], [10, -12], [8, -10.5], [-7, -10.5]], '#3b1f52', 1);
    inkPath(c, [[-5, -12], [5, -12], [2, -19], [-3 - sway, -24]], '#4c2566', 1.5);
    c.fillStyle = '#e0b35a'; c.fillRect(-5, -13.5, 10, 1.6);
    litEyes(c, '#86efac', 1 + o.look.x * 1.2, -10.5 + o.look.y, 4, 2.2, 1.8);
  },
  werewolf(c, o) {
    const s = Math.sin(o.phase), crouch = o.alert ? 3 : 0;
    c.save(); c.translate(0, crouch);
    // tail
    inkPath(c, [[-5, 2], [-13, -2 + Math.sin(o.t * 0.3) * 2], [-10, 5], [-5, 6]], '#5d4d42', 1);
    // legs
    inkPath(c, [[-5, 5], [-2, 5], [-2 + s * 2, 11], [-6 + s * 2, 11]], '#5d4d42', 1);
    inkPath(c, [[1, 5], [4, 5], [5 - s * 2, 11], [1 - s * 2, 11]], '#6b5a4d', 1);
    // hunched body
    inkPath(c, [[-6, -6], [6, -8], [7, 6], [-6, 6]], '#7a6758');
    inkPath(c, [[-2, -4], [4, -5], [4, 4], [-2, 4]], '#c9b8a4', 0);
    // clawed arms reaching forward
    inkPath(c, [[4, -4], [11, 0 + s], [12, 3 + s], [5, 1]], '#6b5a4d', 1);
    c.fillStyle = '#f5f5f4'; c.fillRect(11.5, 2.4 + s, 1, 2); c.fillRect(9.8, 2.8 + s, 1, 2);
    // head, ears, muzzle
    inkPath(c, [[-4, -12], [-3, -18], [0, -13]], '#5d5148', 1);
    inkPath(c, [[2, -13], [5, -18.5], [6, -12]], '#5d5148', 1);
    inkOval(c, 1, -10, 5.5, 4.8, '#8a7768');
    inkPath(c, [[4, -11], [11, -9.5], [11, -6], [4, -6]], '#6b5b50', 1);
    c.fillStyle = '#17110f'; c.fillRect(10, -9.5, 1.8, 1.6);
    c.fillStyle = '#fff'; c.fillRect(6, -6.5, 1, 1.6); c.fillRect(8.5, -6.5, 1, 1.6);
    litEyes(c, '#ffc93c', 1.6 + o.look.x, -11.5 + o.look.y, 4, 2.2, 1.8);
    c.restore();
    if (o.alert) {
      c.fillStyle = '#fde047'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
      c.fillText('!', 0, -22 + Math.sin(o.t * 0.6));
    }
  },
  frank(c, o) {
    const s = Math.sin(o.phase), stomp = Math.abs(s) * 1.2;
    // boots
    c.fillStyle = '#0c1220';
    c.fillRect(-6, 8 + (s > 0 ? -stomp : 0), 5, 3.5); c.fillRect(1, 8 + (s < 0 ? -stomp : 0), 5, 3.5);
    // jacket
    inkPath(c, [[-7, -6], [7, -6], [8, 8], [-8, 8]], '#3d493d');
    inkPath(c, [[2, -6], [7, -6], [8, 8], [3, 8]], '#2c362c', 0);
    // arms held out in front
    inkPath(c, [[3, -5], [12, -4 + s], [12, -1 + s], [3, -1]], '#3d493d', 1);
    inkOval(c, 12.5, -2.5 + s, 1.9, 1.9, '#9fbf6c', 1);
    // head
    inkPath(c, [[-5.5, -16], [6.5, -16], [6.5, -6], [-5.5, -6]], '#a4c46f');
    inkPath(c, [[-5.5, -17], [6.5, -17], [6.5, -13.5], [-5.5, -13.5]], '#172431', 1);
    c.fillStyle = '#abc0d0'; c.fillRect(-8.5, -11, 3, 2.6); c.fillRect(6.5, -11, 3, 2.6);
    c.strokeStyle = '#3f4f2e'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-4, -8.5); c.lineTo(4.5, -8.5);
    for (let i = -3; i <= 4; i += 2) { c.moveTo(i, -9.5); c.lineTo(i, -7.5); }
    c.stroke();
    litEyes(c, '#ffedac', 1 + o.look.x, -12 + o.look.y, 4.4, 2.2, 1.8);
  },
  ghost(c, o) {
    const w = Math.sin(o.t * 0.2) * 2;
    c.globalAlpha *= 0.9;
    c.shadowColor = '#c4b5fd'; c.shadowBlur = 10;
    inkPath(c, [[-9, -2], [-9, 9], [-5 + w, 6], [-1, 10], [3 + w, 6], [7, 10], [9, 9], [9, -2], [7, -12], [0, -16], [-7, -12]], '#e2d6f0', 1.5);
    c.shadowBlur = 0;
    inkPath(c, [[3, -13], [9, -2], [9, 9], [7, 10], [3 + w, 6]], '#b9a6d3', 0);
    // flap arms
    inkPath(c, [[-8, -3], [-13, 1 + w], [-8, 2]], '#d8c8ea', 1);
    inkPath(c, [[8, -3], [13, 1 - w], [8, 2]], '#b9a6d3', 1);
    inkOval(c, -2.2 + o.look.x * 1.5, -6 + o.look.y, 1.8, 2.6, '#2e1065', 0);
    inkOval(c, 3.2 + o.look.x * 1.5, -6 + o.look.y, 1.8, 2.6, '#2e1065', 0);
    inkOval(c, 0.5 + o.look.x, 0.5, 1.6, 2.2, '#2e1065', 0);
  }
};

/* Scared: the hunter cowers — shivers, a blue wash, a wobbly mouth. The wash
   needs `source-atop`, which must run on an isolated sprite canvas or it would
   tint the maze floor too, so hunters are rendered through SCRATCH. */
const SCRATCH = makeCanvas(56, 60);
function drawHunter(c, m, x, y, t) {
  const look = m.dir && (m.dir.x || m.dir.y) ? m.dir : { x: 1, y: 0 };
  const face = look.x < 0 ? -1 : 1;
  if (m.state === 'eyes') { drawEyes(c, x, y, look); return; }
  const scared = m.scared, flash = m.flash && Math.floor(t / 8) % 2 === 0;
  const o = { t, phase: m.phase || 0, look: { x: Math.abs(look.x), y: look.y }, alert: m.alert };
  const shiver = scared ? Math.sin(t * 1.7) * 0.9 : 0;
  const bob = Math.abs(Math.sin(m.phase || 0)) * -1.2;
  const art = HUNTER_ART[m.type] || HUNTER_ART.ghost;

  const target = SCRATCH ? SCRATCH.getContext('2d') : c;
  if (SCRATCH) { target.setTransform(1, 0, 0, 1, 0, 0); target.clearRect(0, 0, 56, 60); target.save(); target.translate(28, 34); }
  else { target.save(); target.translate(x, y); }
  target.globalAlpha = 1;
  target.save();
  target.translate(shiver, bob);
  target.scale(face, 1);
  art(target, o);
  target.restore();
  if (scared && SCRATCH) {
    target.globalCompositeOperation = 'source-atop';
    target.fillStyle = flash ? 'rgba(248,250,252,0.85)' : 'rgba(30,64,175,0.78)';
    target.fillRect(-28, -34, 56, 60);
    target.globalCompositeOperation = 'source-over';
  }
  if (scared) {
    target.strokeStyle = flash ? '#1e3a8a' : '#fef3c7'; target.lineWidth = 1.3;
    target.beginPath();
    for (let i = 0; i <= 4; i++) target.lineTo(-4 + i * 2 + shiver, -3 + (i % 2 ? -1 : 1));
    target.stroke();
    target.fillStyle = flash ? '#1e3a8a' : '#fef3c7';
    target.fillRect(-4 + shiver, -9, 2.4, 2.4); target.fillRect(2 + shiver, -9, 2.4, 2.4);
  }
  target.restore();
  if (SCRATCH) {
    if (m.frozen) { c.save(); c.globalAlpha = 0.9; }
    c.shadowColor = scared ? '#60a5fa' : (HUNTER_COLORS[m.type] || '#fff');
    c.shadowBlur = m.type === 'ghost' ? 0 : 8;
    c.drawImage(SCRATCH, x - 28, y - 34);
    c.shadowBlur = 0;
    if (m.frozen) {
      c.fillStyle = 'rgba(147,197,253,0.35)'; c.strokeStyle = 'rgba(224,242,254,0.8)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - 11, y + 11); c.lineTo(x - 12, y - 12); c.lineTo(x, y - 19); c.lineTo(x + 12, y - 12); c.lineTo(x + 11, y + 11); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  }
}

function drawEyes(c, x, y, look) {
  [-3.5, 3.5].forEach(dx => {
    inkOval(c, x + dx, y - 3, 3, 3.6, '#f8fafc', 1);
    c.fillStyle = '#1d4ed8';
    c.beginPath(); c.arc(x + dx + look.x * 1.5, y - 3 + look.y * 1.8, 1.6, 0, Math.PI * 2); c.fill();
  });
}

function drawBat(c, x, y, t, color = '#7f1d1d') {
  const f = Math.sin(t * 0.5) * 5;
  c.save(); c.translate(x, y);
  inkPath(c, [[0, -2], [-5, -4 - f], [-12, -2 - f], [-9, 1], [-6, 0], [-3, 3]], color, 1.2);
  inkPath(c, [[0, -2], [5, -4 - f], [12, -2 - f], [9, 1], [6, 0], [3, 3]], color, 1.2);
  inkOval(c, 0, 0, 3.5, 4, '#1f0a0a', 1.2);
  litEyes(c, '#fb7185', 0, -1.5, 3, 1.4, 1.4);
  c.restore();
}

/* ---------------- CRYSTALS ----------------
   Pre-rendered with their glow, so ~300 crystals cost 300 blits rather than
   300 shadowBlur fills. */
function crystalSprite(size, power) {
  const cv = makeCanvas(size, size);
  if (!cv) return null;
  const c = cv.getContext('2d'), m = size / 2;
  c.translate(m, m);
  c.shadowColor = power ? '#e879f9' : '#67e8f9'; c.shadowBlur = power ? 12 : 7;
  const s = power ? 9 : 5;
  inkPath(c, [[0, -s], [s * 0.75, 0], [0, s], [-s * 0.75, 0]], power ? '#e879f9' : '#67e8f9', power ? 1.4 : 1);
  c.shadowBlur = 0;
  inkPath(c, [[0, -s], [s * 0.75, 0], [0, 0]], power ? '#fbcfe8' : '#cffafe', 0);
  inkPath(c, [[0, s], [-s * 0.75, 0], [0, 0]], power ? '#a21caf' : '#0891b2', 0);
  return cv;
}
const GEM_SPRITE = crystalSprite(22, false);
const POWER_SPRITE = crystalSprite(40, true);

/* ---------------- PICKUPS + RELICS ---------------- */
function drawPickup(c, p, t) {
  const by = Math.sin(p.bob) * 2.5;
  c.save();
  c.translate(p.x, p.y + by);
  c.globalAlpha = Math.min(1, p.life / 60);
  const glow = { speed: '#fbbf24', freeze: '#67e8f9', life: '#f472b6', lantern: '#fdba74' }[p.type];
  c.shadowColor = glow; c.shadowBlur = 12;
  if (p.type === 'speed') {
    inkPath(c, [[2, -9], [-5, 1], [0, 1], [-2, 9], [6, -2], [1, -2]], '#fbbf24', 1.3);
  } else if (p.type === 'freeze') {
    c.strokeStyle = '#e0f2fe'; c.lineWidth = 2.2;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI + t * 0.02;
      c.beginPath(); c.moveTo(Math.cos(a) * -8, Math.sin(a) * -8); c.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); c.stroke();
    }
    c.shadowBlur = 0; inkOval(c, 0, 0, 2.5, 2.5, '#67e8f9', 1);
  } else if (p.type === 'life') {
    c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-11, 0, -7, -9, 0, -4); c.bezierCurveTo(7, -9, 11, 0, 0, 8);
    c.fillStyle = '#f472b6'; c.fill(); c.shadowBlur = 0; c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = '#fdf2f8'; c.fillRect(-4, -3, 2, 2);
  } else {
    // lantern
    c.strokeStyle = INK; c.lineWidth = 1.3;
    c.beginPath(); c.arc(0, -8, 3, Math.PI, 0); c.stroke();
    inkPath(c, [[-5, -6], [5, -6], [4, 7], [-4, 7]], '#78350f', 1.3);
    c.fillStyle = '#fde68a'; c.fillRect(-3, -4, 6, 9);
    c.fillStyle = '#f97316'; c.beginPath(); c.ellipse(0, 1.5, 1.6, 3 + Math.sin(t * 0.4), 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.shadowBlur = 0; c.globalAlpha = 1;
}

function drawRelic(c, kind, x, y, t) {
  c.save();
  c.translate(x, y + Math.sin(t * 0.08) * 2);
  c.shadowBlur = 14;
  if (kind === 'rose') {
    c.shadowColor = '#f43f5e';
    c.strokeStyle = '#15803d'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 2); c.lineTo(1, 11); c.stroke();
    inkPath(c, [[1, 6], [7, 3], [3, 8]], '#16a34a', 1);
    inkOval(c, 0, -2, 6.5, 6, '#e11d48');
    c.shadowBlur = 0;
    c.strokeStyle = '#881337'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -2, 3, 0.5, 5.2); c.stroke();
  } else if (kind === 'skull') {
    c.shadowColor = '#e0e7ff';
    inkOval(c, 0, -2, 7, 6.5, '#e7e5e4');
    inkPath(c, [[-4, 3], [4, 3], [3, 8], [-3, 8]], '#d6d3d1', 1.3);
    c.shadowBlur = 0;
    inkOval(c, -2.8, -2, 2, 2.3, '#0f0a1a', 0); inkOval(c, 2.8, -2, 2, 2.3, '#0f0a1a', 0);
    c.fillStyle = '#0f0a1a'; c.fillRect(-2, 5, 1, 2.5); c.fillRect(1, 5, 1, 2.5);
  } else if (kind === 'prism') {
    c.shadowColor = '#f0abfc';
    inkPath(c, [[0, -10], [8, 6], [-8, 6]], 'rgba(240,171,252,0.85)', 1.4);
    c.shadowBlur = 0;
    ['#f87171', '#fbbf24', '#4ade80', '#60a5fa'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, 0); c.lineTo(12, -3 + i * 2.2); c.stroke(); });
  } else {
    c.shadowColor = '#fbbf24';
    inkPath(c, [[-7, -8], [7, -8], [4, 0], [-4, 0]], '#f59e0b', 1.4);
    inkPath(c, [[-1.5, 0], [1.5, 0], [1.5, 6], [-1.5, 6]], '#d97706', 1.2);
    inkPath(c, [[-6, 6], [6, 6], [5, 9], [-5, 9]], '#b45309', 1.2);
    c.shadowBlur = 0; c.fillStyle = '#7f1d1d'; c.fillRect(-5, -7, 10, 2.5);
  }
  c.restore();
  c.shadowBlur = 0;
}
