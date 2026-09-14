// ============================================================
// INFESTATION — terrain, critters, player, HUD
// Everything here reads game state but never changes it.
// ============================================================

const POISON = { cap: ['#65a30d', '#3f6212'], spot: '#ecfccb', stem: '#bef264', glow: '#a3e635' };

// ---------- Toadstools (pre-rendered: ~50 shadowBlurs per frame was the old cost) ----------
const toadCache = {};
function toadSprite(pal, hp, poison, puff) {
  const id = `${pal.cap[0]}|${hp}|${poison ? 1 : 0}|${puff ? 1 : 0}`;
  if (toadCache[id]) return toadCache[id];
  const cv = makeCanvas(40, 40), g = cv.getContext('2d');
  toadCache[id] = cv;
  if (!g) return cv;
  const P = poison ? POISON : pal;
  g.translate(20, 22);
  const s = 0.55 + hp * 0.11;   // shrinks as it is shot
  g.scale(s, s);
  if (puff) {
    // puffball: a round dome that bursts into spores — reads differently on purpose
    g.shadowColor = P.glow; g.shadowBlur = 8;
    g.fillStyle = poison ? P.cap[0] : '#e7e5e4';
    g.beginPath(); g.ellipse(0, 0, 11, 10, 0, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = poison ? P.cap[1] : '#a8a29e';
    g.beginPath(); g.ellipse(0, 6, 10, 4, 0, 0, Math.PI); g.fill();
    g.fillStyle = poison ? P.spot : P.cap[0];
    [[-4, -3], [3, -5], [5, 1], [-2, 3], [0, -7]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill(); });
    return cv;
  }
  g.fillStyle = P.stem;
  g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.lineTo(4, 10); g.lineTo(-4, 10); g.closePath(); g.fill();
  g.fillStyle = P.cap[hp >= 3 ? 0 : 1];
  g.shadowColor = P.glow; g.shadowBlur = poison ? 12 : 7;
  g.beginPath(); g.moveTo(-12, 1); g.quadraticCurveTo(-11, -12, 0, -12); g.quadraticCurveTo(11, -12, 12, 1); g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(0, 1, 11, 2.5, 0, 0, Math.PI); g.fill();
  g.fillStyle = P.spot;
  [[-5, -5, 2], [3, -7, 1.7], [6, -2, 1.3], [-1, -1, 1.2]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  if (hp <= 2) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, -12); g.lineTo(1, -6); g.lineTo(-1, -2); g.stroke(); }
  return cv;
}
function drawToadstool(c, r, hp, poison, puff) {
  const img = toadSprite(ground().pal, hp, poison, puff);
  ctx.drawImage(img, cellX(c) - 20, cellY(r) - 22);
  if (poison && (playT + c * 7) % 40 < 20) {        // a drip so poison reads even at a glance
    ctx.fillStyle = 'rgba(190,242,100,0.7)';
    ctx.beginPath(); ctx.arc(cellX(c) + 5, cellY(r) + 4 + ((playT + c * 7) % 40) * 0.25, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- Terrain blocks ----------
function trapOpen(b) { return ((playT + b.phase) % 210) < 120; }

function drawBlock(c, r, b) {
  const x = cellX(c), y = cellY(r);
  ctx.save();
  ctx.translate(x, y + 2);
  if (b.type === 'stone') drawStone(b.v);
  else if (b.type === 'pumpkin') drawPumpkin(b.hp, false);
  else if (b.type === 'lantern') drawPumpkin(b.hp, true);
  else if (b.type === 'trap') drawTrap(b);
  ctx.restore();
}

function drawStone(v) {
  const gid = ground().id;
  if (v === 5) {                                   // conservatory planter
    ctx.fillStyle = '#9a3412'; ctx.strokeStyle = '#431407'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.lineTo(7, 10); ctx.lineTo(-7, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c2410c'; ctx.fillRect(-11, -5, 22, 4);
    ctx.strokeStyle = '#15803d'; ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(Math.cos(a) * 11, -5 + Math.sin(a) * 9); ctx.stroke(); }
    return;
  }
  if (v === 4) {                                   // crypt block (tiles with its neighbours)
    ctx.fillStyle = '#475569'; ctx.fillRect(-12, -14, 24, 24);
    ctx.strokeStyle = 'rgba(15,23,42,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(-11.5, -13.5, 23, 23);
    ctx.fillStyle = 'rgba(15,23,42,0.45)'; ctx.fillRect(-1.5, -9, 3, 14); ctx.fillRect(-5, -5, 10, 3);
    return;
  }
  ctx.fillStyle = gid === 'bog' ? '#4b5b57' : '#64748b';
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (v === 1) { ctx.moveTo(-8, 10); ctx.lineTo(-8, -2); ctx.arc(0, -2, 8, Math.PI, 0); ctx.lineTo(8, 10); }
  else if (v === 2) { ctx.rect(-3, -11, 6, 21); ctx.rect(-8, -6, 16, 5); }
  else { ctx.moveTo(-8, 10); ctx.lineTo(-9, -8); ctx.lineTo(8, -9); ctx.lineTo(8, 10); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(15,23,42,0.5)';
  if (v !== 2) { ctx.fillRect(-5, -3, 10, 2); ctx.fillRect(-3, 1, 6, 1.5); }
  ctx.fillStyle = 'rgba(203,213,225,0.18)'; ctx.fillRect(-7, -1, 2, 9);
  if (gid === 'bog') {                              // moss
    ctx.fillStyle = 'rgba(74,222,128,0.35)';
    ctx.beginPath(); ctx.ellipse(-3, 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -4, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPumpkin(hp, lantern) {
  const flick = lantern ? 0.75 + Math.sin(playT * 0.3 + hp) * 0.15 + Math.sin(playT * 0.13) * 0.1 : 0;
  if (lantern) { ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 16 * flick; }
  ctx.fillStyle = lantern ? '#ea580c' : (hp >= 3 ? '#f97316' : '#c2410c');
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(124,45,18,0.55)';
  ctx.beginPath(); ctx.ellipse(-4, 0, 3, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, 0, 3, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4d7c0f'; ctx.fillRect(-1.5, -12, 3, 5);
  ctx.strokeStyle = '#4d7c0f'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(4, -10, 3, Math.PI, Math.PI * 2.2); ctx.stroke();
  if (lantern) {
    ctx.fillStyle = `rgba(254,240,138,${flick})`;
    ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-2, -3); ctx.lineTo(-4, -6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(2, -3); ctx.lineTo(4, -6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(7, 2); ctx.lineTo(4, 6); ctx.lineTo(2, 4); ctx.lineTo(0, 6); ctx.lineTo(-2, 4); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
  } else if (hp <= 3) {
    ctx.strokeStyle = 'rgba(40,10,5,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(1, -2); ctx.lineTo(-1, 3); if (hp <= 1) { ctx.moveTo(5, -6); ctx.lineTo(3, 2); } ctx.stroke();
  }
}

function drawTrap(b) {
  const open = trapOpen(b);
  const ph = (playT + b.phase) % 210;
  // snap animation over the first 8 frames of each state
  const k = open ? Math.min(1, ph / 8) : 1 - Math.min(1, (ph - 120) / 6);
  const spread = 0.15 + k * 0.85;
  ctx.fillStyle = '#166534';
  ctx.beginPath(); ctx.ellipse(-7, 9, 6, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, 9, 6, 2.5, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#15803d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 2); ctx.stroke();
  [-1, 1].forEach(side => {
    ctx.save();
    ctx.translate(0, 2);
    ctx.rotate(side * spread * 0.9);
    ctx.fillStyle = open ? '#16a34a' : '#15803d';
    ctx.beginPath(); ctx.ellipse(side * 1, -8, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = open ? '#f43f5e' : '#9f1239';
    ctx.beginPath(); ctx.ellipse(side * -1.5, -8, 3.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ecfccb'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 0; t < 5; t++) { const ty = -15 + t * 3.4; ctx.moveTo(side * -4.5, ty); ctx.lineTo(side * -7.5, ty - 1); }
    ctx.stroke();
    ctx.restore();
  });
  if (open) { ctx.fillStyle = 'rgba(244,63,94,0.18)'; ctx.beginPath(); ctx.arc(0, -6, 13, 0, Math.PI * 2); ctx.fill(); }
}

function drawLily(l) {
  const x = l.x, y = cellY(l.row);
  ctx.save(); ctx.translate(x, y); ctx.rotate(l.spin);
  ctx.fillStyle = '#15803d';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 0.35, Math.PI * 2 - 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(187,247,208,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = 0.6 + k * 1.15; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } ctx.stroke();
  if (Math.round(l.spin * 10) % 3 === 0) { ctx.fillStyle = '#fbcfe8'; ctx.beginPath(); ctx.arc(-3, 3, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------- Hauntipede ----------
function drawSegment(s) {
  const P = ground().pal;
  if (s.sub) {                                     // swimming underwater: only a wake shows
    ctx.strokeStyle = 'rgba(167,243,208,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 9 + Math.sin(s.legPhase) * 2, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(204,251,241,0.5)';
    ctx.beginPath(); ctx.arc(s.x - s.dir * 8, s.y - 3 - (s.legPhase * 3 % 6), 1.8, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(s.x, s.y);
  const r = s.head ? 11 : 9;
  ctx.strokeStyle = s.head ? P.head : P.legs; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let li = 0; li < 3; li++) {
    const lx = (li - 1) * 6, kick = Math.sin(s.legPhase + li * 1.1) * 3;
    ctx.moveTo(lx, -r + 2); ctx.lineTo(lx + kick, -r - 5);
    ctx.moveTo(lx, r - 2); ctx.lineTo(lx - kick, r + 5);
  }
  ctx.stroke();
  ctx.fillStyle = s.diving ? POISON.glow : (s.head ? P.head : P.body);
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.arc(-3, -3, r * 0.45, 0, Math.PI * 2); ctx.fill();
  if (s.head) {
    const d = s.dir;
    ctx.fillStyle = '#0f0a1a';
    ctx.fillRect(d > 0 ? 1 : -5, -4, 4, 4);
    ctx.fillRect(d > 0 ? 5 : -8, 0, 3, 3);
    ctx.fillStyle = '#fef08a'; ctx.fillRect(d > 0 ? 2 : -4, -3, 1.5, 1.5);
    ctx.strokeStyle = P.head; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(d * 8, -6); ctx.lineTo(d * 14, -12);
    ctx.moveTo(d * 8, -3); ctx.lineTo(d * 16, -6);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(224,212,255,0.5)';
    ctx.beginPath(); ctx.arc(0, -2, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- Critters ----------
function drawCritter(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  switch (e.kind) {
    case 'bug': drawBug(e); break;
    case 'beetle': drawBeetle(e); break;
    case 'moth': drawMoth(e); break;
    case 'scorpion': drawScorpion(e); break;
    case 'ghost': drawGhost(e); break;
    case 'spider': drawSpider(e); break;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBug(bug) {
  ctx.rotate(Math.sin(bug.t) * 0.3);
  ctx.strokeStyle = '#166534'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let li = 0; li < 3; li++) {
    const ly = (li - 1) * 5, kick = Math.sin(bug.legPhase + li * 1.3) * 4;
    ctx.moveTo(-6, ly); ctx.lineTo(-11, ly + kick);
    ctx.moveTo(6, ly); ctx.lineTo(11, ly - kick);
  }
  ctx.stroke();
  ctx.fillStyle = '#4ade80'; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#166534'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke();
  ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.arc(0, 9, 3.5, 0, Math.PI * 2); ctx.fill();
}

function drawBeetle(bt) {
  ctx.scale(bt.vx > 0 ? 1 : -1, 1);
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let li = 0; li < 3; li++) {
    const lx = (li - 1) * 5, kick = Math.sin(bt.legPhase + li * 1.2) * 4;
    ctx.moveTo(lx, -6); ctx.lineTo(lx + kick, -11);
    ctx.moveTo(lx, 6); ctx.lineTo(lx - kick, 11);
  }
  ctx.stroke();
  ctx.fillStyle = '#f59e0b'; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(9, -2); ctx.lineTo(15, -5); ctx.moveTo(9, 2); ctx.lineTo(15, 5); ctx.stroke();
}

function drawMoth(m) {
  const flap = Math.abs(Math.sin(m.wing));
  ctx.fillStyle = 'rgba(253,230,138,0.85)'; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(-5, 0, 5 * flap + 2, 7, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, 0, 5 * flap + 2, 7, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.ellipse(0, 0, 2, 6, 0, 0, Math.PI * 2); ctx.fill();
}

function drawScorpion(sc) {
  ctx.scale(sc.vx > 0 ? 1 : -1, 1);
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let li = 0; li < 3; li++) {
    const lx = (li - 1) * 6, kick = Math.sin(sc.legPhase + li) * 4;
    ctx.moveTo(lx, -5); ctx.lineTo(lx + kick, -11);
    ctx.moveTo(lx, 5); ctx.lineTo(lx - kick, 11);
  }
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0'; ctx.shadowColor = '#94a3b8'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-20, -12, -12, -16); ctx.stroke();
  ctx.fillStyle = '#a3e635'; ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(-12, -17, 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(17, -6); ctx.moveTo(10, 3); ctx.lineTo(17, 6); ctx.stroke();
}

function drawGhost(g) {
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#67e8f9'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, -4, 11, Math.PI, 0);
  ctx.lineTo(11, 8);
  const w = Math.sin(g.t * 3) * 1.5;
  for (let i = 0; i < 4; i++) ctx.lineTo(11 - (i + 0.5) * 5.5, (i % 2 === 0 ? 12 : 8) + w * (i % 2 ? -1 : 1));
  ctx.lineTo(-11, 8);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0f0a1a';
  ctx.beginPath(); ctx.ellipse(-4, -5, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, -5, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 2, 2, 1.5 + Math.abs(w) * 0.4, 0, 0, Math.PI * 2); ctx.fill();
}

// Zone spider (the Centipede classic): hairy, fast, bounces through your zone
function drawSpider(sp) {
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    [-1, 1].forEach(side => {
      const a = (i - 1.5) * 0.45, kick = Math.sin(sp.legPhase + i * 1.4 + (side > 0 ? 1.6 : 0)) * 3;
      const kx = side * (9 + i * 1.5), ky = -8 + i * 5 + kick;
      ctx.beginPath(); ctx.moveTo(side * 4, (i - 1.5) * 2.5); ctx.lineTo(kx, ky - 4); ctx.lineTo(kx + side * 5, ky + 7 + a * 4); ctx.stroke();
    });
  }
  ctx.fillStyle = '#44403c'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f97316';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, 4); ctx.lineTo(0, 9); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ef4444';
  [[-2, -7], [2, -7], [-3.5, -5], [3.5, -5]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); });
}

function drawEgg(e) {
  const pulse = e.t < 90 ? Math.sin(e.t * 0.5) * 2 : 0;
  ctx.save(); ctx.translate(e.x + (e.t < 90 ? Math.sin(e.t * 1.3) * 1.5 : 0), e.y);
  ctx.fillStyle = e.hp > 1 ? '#f5f5f4' : '#d6d3d1';
  ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8 + pulse * 2;
  ctx.beginPath(); ctx.ellipse(0, 1, 8, 10 + pulse * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(192,38,211,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 3, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (e.hp <= 1 || e.t < 120) { ctx.strokeStyle = '#57534e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-1, -1); ctx.lineTo(-3, 3); ctx.moveTo(4, -6); ctx.lineTo(2, 0); ctx.stroke(); }
  ctx.restore();
}

// ---------- Hazard decals ----------
function drawWeb(w) {
  const a = Math.min(1, w.life / 40) * 0.55;
  ctx.save(); ctx.translate(w.x, w.y); ctx.globalAlpha = a;
  ctx.strokeStyle = '#f5f5f4'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * w.r, Math.sin(ang) * w.r * 0.6); }
  for (let ring = 1; ring <= 3; ring++) {
    const rr = w.r * ring / 3;
    for (let k = 0; k <= 8; k++) { const ang = k * Math.PI / 4; const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr * 0.6; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  }
  ctx.stroke();
  ctx.restore();
}
function drawAcid(a) {
  const warm = a.age < a.warm;
  ctx.save(); ctx.translate(a.x, a.y);
  const fade = Math.min(1, a.life / 30);
  if (warm) {
    ctx.strokeStyle = `rgba(190,242,100,${0.4 + (a.age % 8 < 4 ? 0.4 : 0)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, a.r, a.r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, a.r);
    g.addColorStop(0, `rgba(217,249,157,${0.75 * fade})`); g.addColorStop(0.7, `rgba(132,204,22,${0.55 * fade})`); g.addColorStop(1, 'rgba(132,204,22,0)');
    ctx.fillStyle = g; ctx.scale(1, 0.45); ctx.beginPath(); ctx.arc(0, 0, a.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(236,252,203,${0.7 * fade})`;
    for (let k = 0; k < 3; k++) { const t = (a.age * 0.08 + k * 2.1); ctx.beginPath(); ctx.arc(Math.cos(t) * a.r * 0.5, Math.sin(t * 1.3) * a.r * 0.5, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
function drawSpore(s) {
  const lethal = sporeLethal(s);
  const fade = Math.min(1, s.life / 40);
  ctx.save(); ctx.translate(s.x, s.y);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r);
  const rgb = lethal ? '190,242,100' : '214,211,209';
  g.addColorStop(0, `rgba(${rgb},${0.55 * fade})`); g.addColorStop(0.6, `rgba(${rgb},${0.3 * fade})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(236,252,203,${0.8 * fade})`;
  for (let k = 0; k < 6; k++) { const t = s.age * 0.05 + k; ctx.fillRect(Math.cos(t * 1.1) * s.r * 0.55, Math.sin(t * 0.9) * s.r * 0.55, 1.5, 1.5); }
  ctx.restore();
}
function drawArc(p, color) {                      // lobbed boss projectiles with landing ring
  const k = p.t / p.T, x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 90;
  ctx.strokeStyle = color; ctx.globalAlpha = 0.35 + k * 0.4; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(p.x1, p.y1, 14 * (1 - k) + 8, 5 * (1 - k) + 3, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

// ---------- Ambient animation over the painted backdrop ----------
function drawAmbient() {
  const G = ground(), t = Date.now();
  if (G.id === 'graveyard') {
    const m = G.source;
    ctx.fillStyle = 'rgba(232,121,249,0.7)';
    ctx.globalAlpha = 0.6 + Math.sin(t * 0.004) * 0.3;
    ctx.fillRect(m.x - 24, m.y - 22, 8, 10); ctx.fillRect(m.x + 2, m.y - 22, 8, 10); ctx.fillRect(m.x + 26, m.y - 40, 7, 9);
    ctx.globalAlpha = 1;
  } else if (G.id === 'pumpkin') {
    const bx = W - 150, by = 150;
    ctx.fillStyle = `rgba(251,146,60,${0.55 + Math.sin(t * 0.006) * 0.25})`;
    ctx.fillRect(bx - 8, by - 82, 16, 14);
    for (let i = 0; i < 14; i++) {                  // fireflies
      const x = (hash(i, 51) * W + Math.sin(t * 0.0007 + i) * 40 + W) % W;
      const y = 180 + hash(i, 52) * (ZONE_Y - 200) + Math.sin(t * 0.0011 + i * 2) * 20;
      const a = 0.3 + Math.max(0, Math.sin(t * 0.003 + i * 1.7)) * 0.6;
      ctx.fillStyle = `rgba(253,224,71,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (G.id === 'bog') {
    waterRows.forEach(r => {
      const y = r * CELL;
      for (let i = 0; i < 9; i++) {
        const x = ((hash(i, r + 60) * W + t * 0.012 * (r % 2 ? 1 : -1)) % W + W) % W;
        ctx.strokeStyle = `rgba(167,243,208,${0.12 + hash(i, r) * 0.12})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y + 8 + hash(i, r + 61) * 8, 10 + Math.sin(t * 0.002 + i) * 3, 2, 0, 0, Math.PI * 2); ctx.stroke();
      }
    });
  } else {
    ctx.globalAlpha = 0.5 + Math.sin(t * 0.0012) * 0.5;
    const beam = ctx.createLinearGradient(300, 0, 420, H);
    beam.addColorStop(0, 'rgba(200,230,255,0.05)'); beam.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(290, 0); ctx.lineTo(350, 0); ctx.lineTo(560, H); ctx.lineTo(380, H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {                   // pollen motes
      const x = (hash(i, 71) * W + t * 0.008 * (0.5 + hash(i, 72))) % W;
      const y = (hash(i, 73) * H + t * 0.005) % H;
      ctx.fillStyle = 'rgba(217,249,157,0.35)'; ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
}

// Soft fog wisps along the top of the player zone — each gradient fully
// contained in its own fill rect (an oversized radius clipped by the rect
// leaves hard-edged full-width bands).
function drawFog() {
  const rgb = ground().pal.mist, t = Date.now();
  for (let i = 0; i < 3; i++) {
    const fy = ZONE_Y - 26 + i * 16;
    const fx = ((t * 0.012 * (i % 2 ? 1 : -1)) % (W + 260) + W + 260) % (W + 260) - 130;
    ctx.save();
    ctx.translate(fx, fy); ctx.scale(3, 1);
    const fg = ctx.createRadialGradient(0, 0, 4, 0, 0, 54);
    fg.addColorStop(0, `rgba(${rgb},0.10)`); fg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = fg; ctx.fillRect(-56, -56, 112, 112);
    ctx.restore();
  }
}

// ---------- Player: the crystal wand turret ----------
function drawPlayer(x, y, muzzle, power, slowed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(192,132,252,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 11, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  const col = power === 'rapid' ? '#4ade80' : power === 'spread' ? '#38bdf8' : '#c084fc';
  ctx.fillStyle = '#3b0764';
  ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(11, 10); ctx.lineTo(8, 4); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8, 3); ctx.lineTo(4, 8); ctx.lineTo(-4, 8); ctx.lineTo(-8, 3); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(-6, 2); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5f3ff';
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(3, -9); ctx.lineTo(0, -5); ctx.lineTo(-3, -9); ctx.closePath(); ctx.fill();
  if (muzzle > 0) {
    ctx.fillStyle = `rgba(0,255,170,${muzzle / 5})`;
    ctx.beginPath(); ctx.arc(0, -17, 4 + muzzle, 0, Math.PI * 2); ctx.fill();
  }
  if (slowed) {
    ctx.strokeStyle = 'rgba(245,245,244,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(12, 8); ctx.moveTo(12, -8); ctx.lineTo(-12, 8); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
  }
  ctx.restore();
}

function drawPickup(p) {
  if (p.life < 120 && (p.life >> 3) % 2) return;
  ctx.save(); ctx.translate(p.x, p.y + Math.sin(p.t * 0.1) * 2);
  const col = p.type === 'rapid' ? '#4ade80' : '#38bdf8';
  ctx.fillStyle = 'rgba(15,10,26,0.8)'; ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.shadowColor = col; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = col;
  if (p.type === 'rapid') { ctx.fillRect(-5, -6, 3, 12); ctx.fillRect(2, -6, 3, 12); }
  else { [-0.5, 0, 0.5].forEach(a => { ctx.save(); ctx.rotate(a); ctx.fillRect(-1.2, -7, 2.4, 9); ctx.restore(); }); }
  ctx.restore();
}

// ---------- HUD ----------
function drawBanner(title, sub, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  const y = H * 0.42;
  const band = ctx.createLinearGradient(0, y - 56, 0, y + 46);
  band.addColorStop(0, 'rgba(7,4,15,0)'); band.addColorStop(0.3, 'rgba(7,4,15,0.8)'); band.addColorStop(0.7, 'rgba(7,4,15,0.8)'); band.addColorStop(1, 'rgba(7,4,15,0)');
  ctx.fillStyle = band; ctx.fillRect(0, y - 56, W, 102);
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = ground().pal.accent; ctx.shadowColor = ground().pal.accent; ctx.shadowBlur = 18;
  ctx.fillText(title, W / 2, y);
  ctx.shadowBlur = 0;
  ctx.font = '16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ede9fe';
  ctx.fillText(sub, W / 2, y + 30);
  ctx.restore();
}

function drawHudOverlay(label, power, powerTime) {
  ctx.save();
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(7,4,15,0.55)';
  const w = ctx.measureText ? ctx.measureText(label).width + 16 : 180;
  ctx.fillRect(8, 6, w, 20);
  ctx.fillStyle = ground().pal.accent;
  ctx.fillText(label, 16, 20);
  if (power) {
    const col = power === 'rapid' ? '#4ade80' : '#38bdf8';
    ctx.fillStyle = 'rgba(7,4,15,0.55)'; ctx.fillRect(8, 30, 120, 16);
    ctx.fillStyle = col; ctx.fillRect(12, 40, 112 * powerTime / POWER_TIME, 3);
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(power === 'rapid' ? 'RAPID FIRE' : 'SPREAD SHOT', 12, 38);
  }
  ctx.restore();
}

function drawBossBar(b) {
  const w = 340, x = W / 2 - w / 2, y = 10;
  ctx.save();
  ctx.fillStyle = 'rgba(7,4,15,0.7)'; ctx.fillRect(x - 4, y - 2, w + 8, 24);
  ctx.fillStyle = '#2e1065'; ctx.fillRect(x, y + 12, w, 7);
  const k = Math.max(0, b.hp / b.maxHp);
  ctx.fillStyle = b.enraged ? '#f43f5e' : ground().pal.accent;
  ctx.fillRect(x, y + 12, w * k, 7);
  ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#f5f3ff'; ctx.fillText(b.name + (b.enraged ? ' · ENRAGED' : ''), W / 2, y + 9);
  ctx.restore();
}
