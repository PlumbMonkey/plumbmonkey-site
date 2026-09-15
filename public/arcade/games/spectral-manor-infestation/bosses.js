// ============================================================
// INFESTATION — the four ground bosses
//   createBoss(def)          → boss object
//   updateBoss(b)            one fixed step
//   bossBulletHit(b, shot)   → -1 blocked · 0 missed · n damage
//   bossTouches(b, x, y, r)  → true if it hurts something at x,y
//   bossNear(b, x, y, r)     → for lantern blasts
//   bossRetreat(b)           after the player loses a life
//   drawBoss(b)
// RULE for segmented bosses: resolve the weak point before the body.
// ============================================================

function createBoss(def) {
  const scale = 1 + cycle * 0.25;
  const b = { type: def.type, name: def.name, t: 0, flash: 0, enraged: false, dying: 0 };
  if (def.type === 'mother') {
    Object.assign(b, { hp: Math.round(18 * scale), gap: 21, nodes: [], eggT: 200 });
    for (let i = 0; i < 12; i++) b.nodes.push({ hp: 3, x: 0, y: 0, flash: 0 });
    motherInit(b);
  } else if (def.type === 'widow') {
    Object.assign(b, { hp: Math.round(34 * scale), x: W / 2, y: -60, vx: 2.2, state: 'enter', wait: 0, atk: 0, shots: [], legPhase: 0 });
  } else if (def.type === 'wyrm') {
    Object.assign(b, { hp: Math.round(30 * scale), gap: 19, nodes: [], state: 'under', wait: 80, shots: [], trail: [], x: -100, y: 0, dir: 1, surfaces: 0 });
    for (let i = 0; i < 9; i++) b.nodes.push({ x: -100, y: 0, sub: true });
  } else if (def.type === 'mandrake') {
    Object.assign(b, { hp: Math.round(28 * scale), x: W / 2, y: 80, state: 'idle', wait: 90, atk: 0, vines: [], shots: [], volley: 0 });
  }
  b.maxHp = b.hp;
  return b;
}

// ---------- shared trail follower (Grave Mother, Bog Wyrm) ----------
function trailReset(b, backX, backY) {
  b.trail = [];
  const n = Math.ceil((b.nodes.length + 2) * b.gap / 2);
  for (let i = n; i >= 0; i--) b.trail.push({ x: b.x + backX * i * 2, y: b.y + backY * i * 2 });
  placeNodes(b);
}
function trailPush(b) {
  const last = b.trail[b.trail.length - 1];
  const dx = b.x - last.x, dy = b.y - last.y, d = Math.hypot(dx, dy);
  if (d < 2) return;
  const n = Math.floor(d / 2);
  for (let i = 1; i <= n; i++) b.trail.push({ x: last.x + dx * (i * 2 / d), y: last.y + dy * (i * 2 / d) });
  const keep = Math.ceil((b.nodes.length + 3) * b.gap / 2);
  if (b.trail.length > keep) b.trail.splice(0, b.trail.length - keep);
}
function placeNodes(b) {
  const L = b.trail.length;
  b.nodes.forEach((n, i) => {
    const p = b.trail[Math.max(0, L - 1 - Math.round((i + 1) * b.gap / 2))];
    n.x = p.x; n.y = p.y;
  });
}

function updateBoss(b) {
  b.t++;
  if (b.flash > 0) b.flash--;
  b.enraged = b.hp <= b.maxHp / 2;
  if (b.type === 'mother') updateMother(b);
  else if (b.type === 'widow') updateWidow(b);
  else if (b.type === 'wyrm') updateWyrm(b);
  else if (b.type === 'mandrake') updateMandrake(b);
  // lobbed projectiles (webs, acid, seeds)
  if (b.shots) {
    for (let i = b.shots.length - 1; i >= 0; i--) {
      const s = b.shots[i];
      if (++s.t >= s.T) { b.shots.splice(i, 1); s.land(s); }
    }
  }
}

function bossBulletHit(b, s) {
  if (b.type === 'mother') {
    if (Math.hypot(s.x - b.x, s.y - b.y) < 21) return 1;
    for (let i = 0; i < b.nodes.length; i++) {
      const n = b.nodes[i];
      if (Math.hypot(s.x - n.x, s.y - n.y) < 16) {
        n.flash = 6;
        if (--n.hp <= 0) motherShed(b, i);
        return -1;
      }
    }
    return 0;
  }
  if (b.type === 'widow') {
    if (Math.hypot(s.x - b.x, s.y - (b.y + 4)) < 26) return b.state === 'bottom' ? 3 : 1;
    return 0;
  }
  if (b.type === 'wyrm') {
    if (b.state === 'under' || b.state === 'rumble') return 0;
    if (Math.hypot(s.x - b.x, s.y - b.y) < 19) return 1;
    for (const n of b.nodes) if (!n.sub && Math.hypot(s.x - n.x, s.y - n.y) < 13) return -1;
    return 0;
  }
  if (b.type === 'mandrake') {
    if (Math.hypot(s.x - b.x, s.y - b.y) < 34) return b.state === 'open' ? 1 : -1;
    return 0;
  }
  return 0;
}

function bossTouches(b, x, y, r) {
  if (b.type === 'mother') {
    if (Math.hypot(x - b.x, y - b.y) < 18 + r) return true;
    return b.nodes.some(n => Math.hypot(x - n.x, y - n.y) < 13 + r);
  }
  if (b.type === 'widow') return Math.hypot(x - b.x, y - (b.y + 4)) < 24 + r;
  if (b.type === 'wyrm') {
    if (b.state === 'under' || b.state === 'rumble') return false;
    if (Math.hypot(x - b.x, y - b.y) < 16 + r) return true;
    return b.nodes.some(n => !n.sub && Math.hypot(x - n.x, y - n.y) < 11 + r);
  }
  if (b.type === 'mandrake') return b.vines.some(v => v.phase === 'slam' && v.t > 4 && v.t < 30 && Math.abs(x - v.cx) < 18 + r * 0.3 && y > ZONE_Y - 30);
  return false;
}

function bossNear(b, x, y, r) {
  return Math.hypot(x - b.x, y - b.y) < r + 24;
}

function bossRetreat(b) {
  if (b.shots) b.shots = [];
  if (b.type === 'mother') motherInit(b);
  else if (b.type === 'widow') { b.state = b.y > 72 ? 'climb' : 'patrol'; b.wait = 120; }
  else if (b.type === 'wyrm') { b.state = 'under'; b.wait = 120; b.x = -200; b.nodes.forEach(n => { n.sub = true; n.x = -200; }); }
  else if (b.type === 'mandrake') { b.vines = []; b.state = 'idle'; b.wait = 100; }
}

// ============================================================
// THE GRAVE MOTHER — an armored giant hauntipede. Body plates soak shots
// (3 hits each, and a broken plate is shed as a toadstool); only the head
// takes damage. Every few seconds she lays an egg that hatches into a
// small hauntipede unless it is shot first.
// ============================================================
function motherInit(b) {
  b.x = W + 30; b.y = cellY(1); b.dir = -1; b.vdir = 1; b.descend = 0;
  trailReset(b, 1, 0);
}
function motherShed(b, i) {
  const n = b.nodes[i];
  explode(n.x, n.y, '#e9d5ff', 14);
  addScore(50, n.x, n.y);
  sfx.crack();
  const c = Math.floor(n.x / CELL), r = Math.floor(n.y / CELL);
  if (r >= FIELD_TOP && r < PLAYER_ZONE_ROW && c >= 0 && c < COLS && !blocks[key(c, r)]) mushrooms[key(c, r)] = 4;
  b.nodes.splice(i, 1);
}
function updateMother(b) {
  const sp = 1.9 * cycleMult * (b.enraged ? 1.3 : 1) * (1 + (12 - b.nodes.length) * 0.04);
  if (b.descend > 0) {
    const s = Math.min(sp, b.descend);
    b.y += s * b.vdir; b.descend -= s;
    if (b.descend <= 0) b.dir *= -1;
  } else {
    b.x += b.dir * sp;
    if ((b.dir < 0 && b.x <= 30) || (b.dir > 0 && b.x >= W - 30)) {
      if (b.vdir > 0 && b.y >= H - 60) b.vdir = -1;
      else if (b.vdir < 0 && b.y <= cellY(2)) b.vdir = 1;
      b.descend = CELL * 2;
    }
  }
  b.y = Math.max(cellY(1), Math.min(H - 24, b.y));
  // she ploughs through toadstools
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const c = Math.floor((b.x + dx * 12) / CELL), r = Math.floor((b.y + dy * 12) / CELL), k = key(c, r);
    if (mushrooms[k]) { delete mushrooms[k]; delete poisoned[k]; delete puffs[k]; }
  }
  trailPush(b); placeNodes(b);
  b.nodes.forEach(n => { if (n.flash > 0) n.flash--; });
  if (--b.eggT <= 0) {
    b.eggT = b.enraged ? 170 : 250;
    const tail = b.nodes[b.nodes.length - 1] || b;
    const c = Math.floor(tail.x / CELL), r = Math.floor(tail.y / CELL);
    if (r >= FIELD_TOP && r <= FIELD_BOTTOM && c >= 1 && c < COLS - 1) layEgg(c, r);
  }
}
function drawMother(b) {
  for (let i = b.nodes.length - 1; i >= 0; i--) {
    const n = b.nodes[i], next = i ? b.nodes[i - 1] : b;
    const ang = Math.atan2(next.y - n.y, next.x - n.x);
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(ang);
    ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const sd of [-1, 1]) { const kick = Math.sin(b.t * 0.3 + i * 0.9) * 4 * sd; ctx.moveTo(0, sd * 10); ctx.lineTo(-4 + kick, sd * 19); ctx.lineTo(-8 + kick, sd * 22); }
    ctx.stroke();
    ctx.fillStyle = n.flash ? '#ffffff' : ['#57534e', '#7c3aed', '#a78bfa'][Math.max(0, n.hp - 1)];
    ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e7e5e4';                       // bone plate + spine
    ctx.beginPath(); ctx.ellipse(-1, 0, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#44403c';
    ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(0, -19); ctx.lineTo(3, -11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(0, 19); ctx.lineTo(3, 11); ctx.closePath(); ctx.fill();
    if (n.hp < 3) { ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(0, -1); ctx.lineTo(-3, 5); if (n.hp < 2) { ctx.moveTo(3, -7); ctx.lineTo(2, 6); } ctx.stroke(); }
    ctx.restore();
  }
  // head
  ctx.save(); ctx.translate(b.x, b.y);
  const heading = b.descend > 0 ? (b.vdir > 0 ? Math.PI / 2 : -Math.PI / 2) : (b.dir > 0 ? 0 : Math.PI);
  ctx.rotate(heading);
  const bite = Math.abs(Math.sin(b.t * 0.12)) * 0.5;
  ctx.strokeStyle = '#f5f5f4'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(14, sd * 8); ctx.quadraticCurveTo(26, sd * (12 + bite * 8), 24, sd * (2 - bite * 4)); ctx.stroke(); }
  ctx.fillStyle = b.flash ? '#ffffff' : '#c026d3'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f5f5f4';                          // skull face plate
  ctx.beginPath(); ctx.ellipse(5, 0, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d6d3d1';                          // bone crown
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-8, k * 6 - 2); ctx.lineTo(-20 - Math.abs(k) * -2, k * 8); ctx.lineTo(-8, k * 6 + 2); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = b.enraged ? '#f43f5e' : '#e879f9'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
  [[8, -6], [8, 6], [13, 0]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-2, -16); ctx.quadraticCurveTo(10, -30, 24, -26); ctx.moveTo(-2, 16); ctx.quadraticCurveTo(10, 30, 24, 26); ctx.stroke();
  ctx.restore();
}

// ============================================================
// THE HARVEST WIDOW — a giant spider with a carved-pumpkin abdomen.
// She patrols the top of the patch, then marks a spot and drops on it on her
// silk. While she's on the ground (after a drop) she takes triple damage.
// She also spits webs that slow you, and once enraged she drops spiderlings.
// ============================================================
function updateWidow(b) {
  const moving = b.state === 'patrol' || b.state === 'aim';
  b.legPhase += moving ? 0.3 : b.state === 'drop' || b.state === 'climb' ? 0.2 : 0.06;
  const top = 72;
  switch (b.state) {
    case 'enter':
      b.y += 2.5; if (b.y >= top) { b.y = top; b.state = 'patrol'; b.wait = 90; }
      break;
    case 'patrol':
      b.x += b.vx * cycleMult * (b.enraged ? 1.3 : 1);
      if (b.x < 90 || b.x > W - 90) { b.vx *= -1; b.x = Math.max(90, Math.min(W - 90, b.x)); }
      b.y = top + Math.sin(b.t * 0.05) * 6;
      if (--b.wait <= 0) {
        const pattern = b.enraged ? ['drop', 'web', 'brood', 'drop', 'web', 'drop'] : ['drop', 'web', 'drop'];
        const a = pattern[b.atk++ % pattern.length];
        b.state = a === 'drop' ? 'aim' : a;
        b.wait = a === 'drop' ? (b.enraged ? 44 : 56) : 40;
        sfx.hiss();
      }
      break;
    case 'aim':
      b.x += Math.max(-7, Math.min(7, (player.x - b.x) * 0.12));
      if (--b.wait <= 0) { b.state = 'drop'; b.targetX = b.x; }
      break;
    case 'drop':
      b.y += 9;
      for (let dx = -1; dx <= 1; dx++) {
        const k = key(Math.floor((b.x + dx * 18) / CELL), Math.floor(b.y / CELL));
        if (mushrooms[k]) { delete mushrooms[k]; delete poisoned[k]; delete puffs[k]; }
      }
      if (b.y >= H - 58) { b.y = H - 58; b.state = 'bottom'; b.wait = 50; shake(6); sfx.thud(); }
      break;
    case 'bottom':
      if (--b.wait <= 0) b.state = 'climb';
      break;
    case 'climb':
      b.y -= 3.5;
      if (b.y <= top) { b.y = top; b.state = 'patrol'; b.wait = 60 + Math.random() * 60; }
      break;
    case 'web':
      if (b.wait === 20) {
        sfx.spit();
        [-100, 0, 100].forEach(dx => {
          const x1 = Math.max(40, Math.min(W - 40, player.x + dx));
          b.shots.push({ x0: b.x, y0: b.y + 10, x1, y1: ZONE_Y + 30 + Math.random() * (H - ZONE_Y - 60), t: 0, T: 48, color: '#f5f5f4',
            land: s => { webs.push({ x: s.x1, y: s.y1, r: 44, life: 420 }); } });
        });
      }
      if (--b.wait <= 0) { b.state = 'patrol'; b.wait = 70; }
      break;
    case 'brood':
      if (b.wait === 15) { spawnCritter('spider', b.x - 24, b.y + 20); spawnCritter('spider', b.x + 24, b.y + 20); }
      if (--b.wait <= 0) { b.state = 'patrol'; b.wait = 80; }
      break;
  }
}
function drawWidow(b) {
  const silk = b.state !== 'patrol' && b.state !== 'enter' && b.state !== 'web' && b.state !== 'brood';
  if (silk || b.y > 80) {
    ctx.strokeStyle = 'rgba(245,245,244,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(b.x, 0); ctx.lineTo(b.x, b.y - 10); ctx.stroke();
  }
  if (b.state === 'aim') {                          // landing marker in the zone
    const p = 0.4 + Math.sin(b.t * 0.5) * 0.25;
    ctx.strokeStyle = `rgba(248,113,113,${p})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(b.x, H - 40, 30, 10, 0, 0, Math.PI * 2); ctx.stroke();
    const col = ctx.createLinearGradient(0, ZONE_Y, 0, H);
    col.addColorStop(0, 'rgba(248,113,113,0)'); col.addColorStop(1, `rgba(248,113,113,${p * 0.25})`);
    ctx.fillStyle = col; ctx.fillRect(b.x - 26, ZONE_Y, 52, H - ZONE_Y);
  }
  ctx.save(); ctx.translate(b.x, b.y);
  // eight jointed legs
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const phase = b.legPhase + i * 1.3 + (sd > 0 ? Math.PI : 0);
    const spread = (i - 1.5) * 0.5;
    const hipX = sd * 8, hipY = -6 + i * 3;
    const kneeX = sd * (30 + Math.cos(spread) * 4), kneeY = -24 + i * 10 + Math.sin(phase) * 5;
    const footX = sd * (40 + i * 2), footY = -2 + i * 12 + Math.cos(phase) * 4;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
  }
  // abdomen: a carved pumpkin
  const exposed = b.state === 'bottom';
  ctx.fillStyle = b.flash ? '#ffffff' : '#c2410c';
  ctx.shadowColor = '#fb923c'; ctx.shadowBlur = exposed ? 26 : 12;
  ctx.beginPath(); ctx.ellipse(0, 12, 24, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(67,20,7,0.5)';
  [-10, 0, 10].forEach(x => { ctx.beginPath(); ctx.ellipse(x, 12, 4, 19, 0, 0, Math.PI * 2); ctx.fill(); });
  const glowA = exposed ? 1 : 0.65 + Math.sin(b.t * 0.2) * 0.2;
  ctx.fillStyle = `rgba(254,240,138,${glowA})`;
  ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-4, 6); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, 6); ctx.lineTo(4, 6); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(14, 14); ctx.lineTo(10, 24); ctx.lineTo(5, 19); ctx.lineTo(0, 25); ctx.lineTo(-5, 19); ctx.lineTo(-10, 24); ctx.closePath(); ctx.fill();
  // head with six red eyes and fangs
  ctx.fillStyle = '#292524';
  ctx.beginPath(); ctx.ellipse(0, -12, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = b.enraged ? '#fb7185' : '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
  [[-4, -15, 2.2], [4, -15, 2.2], [-8, -12, 1.5], [8, -12, 1.5], [-2, -10, 1.2], [2, -10, 1.2]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e7e5e4';
  ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-2, 3); ctx.lineTo(-1, -4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(2, 3); ctx.lineTo(1, -4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ============================================================
// THE BOG WYRM — swims under the channels, comes up in a wave of bubbles and
// swims across with its head out of the water. Only the head can be hurt,
// and the body above the water blocks shots. It spits acid into your zone
// and, once enraged, rears up and lunges down the column you're standing in.
// ============================================================
function updateWyrm(b) {
  const spd = 3.8 * cycleMult * (b.enraged ? 1.3 : 1);
  switch (b.state) {
    case 'under':
      if (--b.wait <= 0) {
        b.row = waterRows[b.surfaces % waterRows.length] ?? 9;
        b.dir = b.surfaces % 2 ? -1 : 1;
        b.surfaces++;
        b.x = b.dir > 0 ? -30 : W + 30;
        b.y0 = cellY(b.row); b.y = b.y0 - 10;
        b.state = 'rumble'; b.wait = 60;
        sfx.bubble();
      }
      break;
    case 'rumble':
      if (--b.wait <= 0) {
        b.state = 'swim'; b.spat = 0; b.lunged = false;
        trailReset(b, -b.dir, 0);
      }
      break;
    case 'swim': {
      b.x += b.dir * spd;
      b.y = b.y0 - 8 - Math.abs(Math.sin(b.x * 0.018)) * 12;
      const prog = b.dir > 0 ? b.x / W : 1 - b.x / W;
      if (b.spat < 2 && prog > [0.3, 0.65][b.spat]) {
        b.spat++;
        sfx.spit();
        b.shots.push({ x0: b.x, y0: b.y, x1: Math.max(30, Math.min(W - 30, player.x + (Math.random() - 0.5) * 60)),
          y1: Math.max(ZONE_Y + 24, Math.min(H - 20, player.y)), t: 0, T: 52, color: '#a3e635',
          land: s => { acids.push({ x: s.x1, y: s.y1, r: 30, life: 180, age: 0, warm: 24 }); } });
      }
      if (b.enraged && !b.lunged && prog > 0.15 && prog < 0.85 && Math.abs(b.x - player.x) < 26) {
        b.lunged = true; b.state = 'rear'; b.wait = 30; sfx.hiss();
      }
      lilies.forEach(l => { if (l.row === b.row && Math.abs(l.x - b.x) < 24 && l.bump <= 0) { l.vx *= -1; l.bump = 40; explode(l.x, cellY(l.row), '#a7f3d0', 6); } });
      const tail = b.nodes[b.nodes.length - 1];
      if (b.dir > 0 ? tail.x > W + 40 : tail.x < -40) { b.state = 'under'; b.wait = b.enraged ? 45 : 80; }
      break;
    }
    case 'rear':
      b.y -= 1.4;
      if (--b.wait <= 0) b.state = 'lunge';
      break;
    case 'lunge':
      b.y += 12;
      if (b.y >= H - 36) { b.y = H - 36; b.state = 'recoil'; shake(7); sfx.thud(); }
      break;
    case 'recoil':
      b.y -= 7;
      if (b.y <= b.y0 - 10) { b.y = b.y0 - 10; b.state = 'swim'; }
      break;
  }
  if (b.state !== 'under' && b.state !== 'rumble') {
    trailPush(b); placeNodes(b);
    b.nodes.forEach((n, i) => {
      const onRow = Math.abs(n.y - b.y0) < 26;
      n.sub = onRow && Math.sin(i * 0.9 - b.t * 0.12) < -0.35;
    });
  }
}
function drawWyrm(b) {
  if (b.state === 'rumble') {
    const x = b.dir > 0 ? 30 : W - 30;
    for (let i = 0; i < 8; i++) {
      const bx = x + b.dir * i * 14 + Math.sin(b.t * 0.4 + i) * 4, by = b.y0 + 6 - ((b.t * 1.5 + i * 11) % 22);
      ctx.fillStyle = `rgba(204,251,241,${0.6 - i * 0.06})`;
      ctx.beginPath(); ctx.arc(bx, by, 2.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (b.state === 'under') return;
  if (b.state === 'rear') {
    const p = 0.35 + Math.sin(b.t * 0.6) * 0.2;
    const col = ctx.createLinearGradient(0, ZONE_Y, 0, H);
    col.addColorStop(0, 'rgba(163,230,53,0)'); col.addColorStop(1, `rgba(163,230,53,${p * 0.3})`);
    ctx.fillStyle = col; ctx.fillRect(b.x - 24, ZONE_Y, 48, H - ZONE_Y);
  }
  for (let i = b.nodes.length - 1; i >= 0; i--) {
    const n = b.nodes[i], r = 14 - i * 0.7;
    if (n.sub) {
      ctx.strokeStyle = 'rgba(167,243,208,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(n.x, b.y0 + 4, r, 3, 0, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#14532d'; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#65a30d';
    ctx.beginPath(); ctx.arc(n.x, n.y + r * 0.3, r * 0.6, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#052e16';
    ctx.beginPath(); ctx.moveTo(n.x - 3, n.y - r + 1); ctx.lineTo(n.x, n.y - r - 7); ctx.lineTo(n.x + 3, n.y - r + 1); ctx.closePath(); ctx.fill();
    if (Math.abs(n.y - b.y0) < 20) { ctx.strokeStyle = 'rgba(204,251,241,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(n.x, b.y0 + 6, r + 4, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(b.x, b.y);
  const down = b.state === 'lunge' || b.state === 'recoil';
  ctx.rotate(down ? Math.PI / 2 : b.dir > 0 ? 0 : Math.PI);
  if (!down && b.dir < 0) ctx.scale(1, -1);
  const jaw = b.state === 'rear' || b.state === 'lunge' ? 0.55 : 0.15 + Math.abs(Math.sin(b.t * 0.1)) * 0.15;
  ctx.fillStyle = b.flash ? '#ffffff' : '#166534'; ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = b.flash ? '#ffffff' : '#15803d';     // upper snout
  ctx.save(); ctx.rotate(-jaw * 0.5);
  ctx.beginPath(); ctx.moveTo(8, -10); ctx.quadraticCurveTo(30, -10, 32, -1); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5f5f4'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(12 + k * 5, -1); ctx.lineTo(14 + k * 5, 4); ctx.lineTo(16 + k * 5, -1); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.rotate(jaw * 0.5);                  // lower jaw
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(28, 2); ctx.quadraticCurveTo(24, 9, 8, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = b.enraged ? '#f43f5e' : '#facc15'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(6, -8, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000'; ctx.fillRect(6, -10, 1.5, 4);
  ctx.strokeStyle = '#84cc16'; ctx.lineWidth = 1.2;           // barbels
  ctx.beginPath(); ctx.moveTo(24, 4); ctx.quadraticCurveTo(26, 16, 18, 22); ctx.moveTo(20, 5); ctx.quadraticCurveTo(18, 14, 10, 18); ctx.stroke();
  ctx.fillStyle = '#052e16';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-12 + k * 7, -12); ctx.lineTo(-16 + k * 7, -22); ctx.lineTo(-6 + k * 7, -13); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// ============================================================
// THE MANDRAKE — rooted under the glass dome. It marks a column in your
// zone, then slams a thorned vine down it (the vine also clears the column).
// After each attack its petals open and the core is exposed; the rest of the
// time it's armored. It also spits seeds that grow into toadstools or
// puffballs (sometimes a hauntipede pod), and once enraged it screams out
// spore clouds.
// ============================================================
function updateMandrake(b) {
  switch (b.state) {
    case 'idle':
      if (--b.wait <= 0) {
        const pattern = b.enraged ? ['lash', 'seeds', 'scream', 'lash', 'lash', 'seeds'] : ['lash', 'seeds', 'lash'];
        const a = pattern[b.atk++ % pattern.length];
        if (a === 'lash') {
          const snap = x => cellX(Math.floor(Math.max(24, Math.min(W - 24, x)) / CELL));
          b.vines = [{ cx: snap(player.x), phase: 'warn', t: b.enraged ? 34 : 42 }];
          if (b.enraged) b.vines.push({ cx: snap(player.x + (player.x < W / 2 ? 1 : -1) * 132), phase: 'warn', t: 44 });   // enraged: a second vine cuts off the escape
          b.state = 'lash';
          sfx.hiss();
        } else { b.state = a; b.wait = a === 'seeds' ? 36 : 48; }
      }
      break;
    case 'lash': {
      let busy = false;
      b.vines.forEach(v => {
        if (v.phase === 'done') return;
        busy = true;
        if (--v.t > 0) return;
        if (v.phase === 'warn') {
          v.phase = 'slam'; v.t = 34; shake(5); sfx.lash();
          const c = Math.floor(v.cx / CELL);
          for (let r = FIELD_TOP; r < ROWS; r++) {
            const k = key(c, r);
            if (mushrooms[k]) { delete mushrooms[k]; delete poisoned[k]; delete puffs[k]; explode(cellX(c), cellY(r), '#86efac', 3); }
          }
        } else if (v.phase === 'slam') { v.phase = 'retract'; v.t = 20; }
        else v.phase = 'done';
      });
      if (!busy) { b.state = 'open'; b.wait = b.enraged ? 70 : 84; b.vines = []; sfx.open(); }
      break;
    }
    case 'open':
      if (--b.wait <= 0) { b.state = 'idle'; b.wait = 50 + Math.random() * 30; }
      break;
    case 'seeds':
      if (b.wait === 12) {
        sfx.spit();
        const n = b.enraged ? 9 : 7, pod = b.volley++ % 3 === 2;
        for (let i = 0; i < n; i++) {
          let c = 0, r = 0, tries = 0;
          do { c = 1 + Math.floor(Math.random() * (COLS - 2)); r = FIELD_TOP + 3 + Math.floor(Math.random() * (FIELD_BOTTOM - FIELD_TOP - 3)); }
          // seeds never plug the lane straight under the bulb
          while ((blocks[key(c, r)] || mushrooms[key(c, r)] || (c >= 15 && c <= 24)) && ++tries < 20);
          const isPod = pod && i === 0;
          b.shots.push({ x0: b.x, y0: b.y, x1: cellX(c), y1: cellY(r), t: 0, T: 44 + i * 3, color: isPod ? '#f472b6' : '#86efac',
            land: s => {
              const k = key(c, r);
              if (isPod) { spawnHauntipede(5, c, r); explode(s.x1, s.y1, '#f472b6', 12); return; }
              if (blocks[k]) return;
              mushrooms[k] = 4; if (Math.random() < 0.4) puffs[k] = true;
            } });
        }
      }
      if (--b.wait <= 0) { b.state = 'idle'; b.wait = 60; }
      break;
    case 'scream':
      if (b.wait === 10) {
        sfx.scream();
        for (let i = 0; i < 5; i++) spores.push(makeSpore(b.x + (i - 2) * 50, b.y + 40, (i - 2) * 0.35, 1.0));
      }
      if (--b.wait <= 0) { b.state = 'idle'; b.wait = 70; }
      break;
  }
}
function drawMandrake(b) {
  const sway = Math.sin(b.t * 0.03) * 0.1;
  // vines
  b.vines.forEach(v => {
    if (v.phase === 'done') return;
    if (v.phase === 'warn') {
      const p = 0.3 + Math.sin(b.t * 0.7) * 0.2;
      const col = ctx.createLinearGradient(0, ZONE_Y - 40, 0, H);
      col.addColorStop(0, 'rgba(244,114,182,0)'); col.addColorStop(1, `rgba(244,114,182,${p * 0.45})`);
      ctx.fillStyle = col; ctx.fillRect(v.cx - 16, ZONE_Y - 40, 32, H - ZONE_Y + 40);
      ctx.strokeStyle = '#166534'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x + (v.cx > b.x ? 20 : -20), b.y + 10);
      ctx.quadraticCurveTo(v.cx, b.y - 30, v.cx + Math.sin(b.t * 0.4) * 6, b.y + 30); ctx.stroke();
      return;
    }
    const k = v.phase === 'slam' ? Math.min(1, (34 - v.t) / 4) : v.t / 20;
    const tipY = b.y + 20 + (H - 14 - b.y - 20) * k;
    ctx.strokeStyle = '#14532d'; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x + (v.cx > b.x ? 20 : -20), b.y + 10);
    ctx.bezierCurveTo(v.cx, b.y + 10, v.cx, (b.y + tipY) / 2, v.cx, tipY); ctx.stroke();
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(b.x + (v.cx > b.x ? 20 : -20), b.y + 10);
    ctx.bezierCurveTo(v.cx, b.y + 10, v.cx, (b.y + tipY) / 2, v.cx, tipY); ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    for (let y = b.y + 60; y < tipY - 10; y += 26) { ctx.beginPath(); ctx.moveTo(v.cx + 5, y); ctx.lineTo(v.cx + 12, y - 4); ctx.lineTo(v.cx + 5, y + 4); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(v.cx - 5, y + 13); ctx.lineTo(v.cx - 12, y + 9); ctx.lineTo(v.cx - 5, y + 17); ctx.closePath(); ctx.fill(); }
    if (v.phase === 'slam' && v.t > 26) { ctx.fillStyle = 'rgba(134,239,172,0.35)'; ctx.beginPath(); ctx.ellipse(v.cx, H - 12, 30, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(sway * (b.state === 'scream' ? 3 : 1));
  if (b.state === 'scream' || (b.state === 'seeds' && b.wait > 12)) ctx.translate(Math.sin(b.t * 2) * 2, 0);
  // leaf crown
  ctx.fillStyle = '#15803d';
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.38 + Math.sin(b.t * 0.05 + k) * 0.06;
    ctx.save(); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.ellipse(0, -44, 8, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // roots
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo((k - 1.5) * 10, 24); ctx.quadraticCurveTo((k - 1.5) * 24, 34, (k - 1.5) * 34, 30 + (k % 2) * 8); ctx.stroke(); }
  const open = b.state === 'open';
  // petals — closed they're armor, open they peel back to expose the core
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + b.t * 0.004;
    const out = open ? 20 : 6;
    ctx.save(); ctx.rotate(a); ctx.translate(0, -out);
    ctx.fillStyle = b.flash ? '#ffffff' : (open ? '#be185d' : '#831843');
    ctx.beginPath(); ctx.ellipse(0, 0, open ? 11 : 17, open ? 16 : 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  if (open) {
    ctx.fillStyle = b.flash ? '#ffffff' : '#f472b6'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#500724';                         // the screaming root face
    ctx.beginPath(); ctx.ellipse(-6, -4, 3, 4, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -4, 3, 4, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 7, 5, 6 + Math.sin(b.t * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(244,114,182,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBoss(b) {
  if (b.shots) b.shots.forEach(s => drawArc(s, s.color));
  if (b.type === 'mother') drawMother(b);
  else if (b.type === 'widow') drawWidow(b);
  else if (b.type === 'wyrm') drawWyrm(b);
  else if (b.type === 'mandrake') drawMandrake(b);
}
