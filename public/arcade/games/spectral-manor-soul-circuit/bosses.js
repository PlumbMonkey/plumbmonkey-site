// ============================================================
// SOUL CIRCUIT — bosses
// Every boss floats ABOVE the maze (walls don't stop it) and moves slower than
// the Soul. It can only be hurt by ramming it while the MAGIC FIELD is up; each
// hit spends the field. On a boss level the four power crystals regrow.
//   SCARECROW KING  lobs pumpkins; each lands on a marked cell and bursts in a
//                   + along the corridors (walls stop the blast)
//   GRAVE LORD      marks a whole row or column, then fires a soul beam down it;
//                   below half health it marks a cross; raises ghosts
//   MIRROR WRAITH   the maze is symmetric, so your SHADOW walks the mirror of
//                   your path (harmless near the centre line); the wraith
//                   shimmers where it will teleport, then rings out slow orbs
//   BAT QUEEN       draws her swoop line, then dives along it and is dazed after;
//                   bats flutter through the walls toward you
// ============================================================

const BOSS_TOUCH = 22;

function createBoss(type, cyc) {
  const b = {
    type, name: REALMS.find(r => r.boss === type).bossName,
    x: MW / 2, y: 3.5 * CELL, vx: 0, vy: 0,
    hp: 4 + cyc, maxHp: 4 + cyc, cyc,
    state: 'drift', t: 150, invuln: 60, attackT: 200, summonAt: [0.5], bob: 0, face: 1
  };
  if (type === 'mirror') { b.trail = []; b.shadowOff = 0; }
  return b;
}

function bossSpeed(b) { return 0.55 + b.cyc * 0.08 + (1 - b.hp / b.maxHp) * 0.25; }

function updateBoss(b) {
  b.bob += 0.05;
  if (b.invuln > 0) b.invuln--;
  const dx = player.x - b.x, dy = player.y - b.y, d = Math.hypot(dx, dy) || 1;

  // movement: drift toward the Soul, flee it while the field is up
  if (b.state !== 'swoop' && b.state !== 'shimmer') {
    const sp = magicField > 0 ? 1.15 : (b.state === 'dazed' ? 0.2 : bossSpeed(b));
    const sgn = magicField > 0 ? -1 : 1;
    b.vx += (sgn * dx / d * sp - b.vx) * 0.06;
    b.vy += (sgn * dy / d * sp - b.vy) * 0.06;
    b.x = Math.max(30, Math.min(MW - 30, b.x + b.vx));
    b.y = Math.max(30, Math.min(MH - 30, b.y + b.vy));
    if (Math.abs(b.vx) > 0.05) b.face = b.vx > 0 ? 1 : -1;
  }

  // summons at health thresholds
  if (b.summonAt.length && b.hp / b.maxHp <= b.summonAt[0]) {
    b.summonAt.shift();
    spawnHunter(b.type === 'gravelord' ? 'ghost' : b.type === 'batqueen' ? 'vampire' : b.type === 'mirror' ? 'witch' : 'frank', true);
    bannerFlash(b.name + ' CALLS FOR HELP');
  }

  ({ scarecrow: updateScarecrow, gravelord: updateGraveLord, mirror: updateMirror, batqueen: updateBatQueen })[b.type](b);
  updateBossFx(b);
}

/* ---- Scarecrow King ---- */
function updateScarecrow(b) {
  if (b.state === 'windup') {
    if (--b.t <= 0) {
      const targets = [cellOf(player.x, player.y)];
      const n = b.hp / b.maxHp <= 0.5 ? 4 : 3;
      for (let tries = 0; targets.length < n && tries < 60; tries++) {
        const r = targets[0].r + Math.floor(Math.random() * 9) - 4, c = targets[0].c + Math.floor(Math.random() * 9) - 4;
        if (walkable(r, c) && !targets.some(q => q.r === r && q.c === c)) targets.push({ r, c });
      }
      targets.forEach((q, i) => bombs.push({ r: q.r, c: q.c, fromX: b.x, fromY: b.y - 20, t: 0, fall: 64 + i * 8, state: 'fall', blast: [] }));
      sfx.lob();
      b.state = 'drift'; b.attackT = Math.max(150, 260 - b.cyc * 20);
    }
  } else if (--b.attackT <= 0) { b.state = 'windup'; b.t = 36; }
}

function blastCells(r, c) {
  const cells = [{ r, c }];
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
    for (let i = 1; i <= 3; i++) { if (!walkable(r + dr * i, c + dc * i)) break; cells.push({ r: r + dr * i, c: c + dc * i }); }
  });
  return cells;
}

/* ---- Grave Lord ---- */
function updateGraveLord(b) {
  if (--b.attackT > 0) return;
  const pc = cellOf(player.x, player.y), cross = b.hp / b.maxHp <= 0.5;
  b.beamAxis = b.beamAxis === 'row' ? 'col' : 'row';
  const warn = cross ? 95 : 80;
  if (cross || b.beamAxis === 'row') beams.push({ axis: 'row', idx: pc.r, t: warn, state: 'warn' });
  if (cross || b.beamAxis === 'col') beams.push({ axis: 'col', idx: pc.c, t: warn, state: 'warn' });
  sfx.charge();
  b.attackT = Math.max(170, 280 - b.cyc * 20);
}

/* ---- Mirror Wraith ---- */
function updateMirror(b) {
  // the shadow follows the mirror image of where the Soul was 40 frames ago
  b.trail.push({ x: player.x, y: player.y });
  if (b.trail.length > 40) b.trail.shift();
  const src = b.trail[0];
  b.shadow = { x: MW - src.x, y: src.y, dir: player.dir };
  if (b.shadowOff > 0) b.shadowOff--;

  if (b.state === 'shimmer') {
    if (--b.t <= 0) {
      b.x = b.dest.x; b.y = b.dest.y; b.state = 'drift';
      const n = b.hp / b.maxHp <= 0.5 ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        bossShots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 1.25, vy: Math.sin(a) * 1.25, life: 260, color: '#e879f9' });
      }
      sfx.orbs();
    }
  } else if (--b.attackT <= 0) {
    // choose a cell far enough from the Soul to be fair
    for (let tries = 0; tries < 40; tries++) {
      const r = 1 + Math.floor(Math.random() * (ROWS - 2)), c = 1 + Math.floor(Math.random() * (COLS - 2));
      const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
      if (Math.hypot(x - player.x, y - player.y) > 200) { b.dest = { x, y }; break; }
    }
    if (b.dest) { b.state = 'shimmer'; b.t = 45; sfx.charge(); }
    b.attackT = Math.max(180, 300 - b.cyc * 20);
  }
}
const SHADOW_SAFE = 36;   // the shadow is harmless this close to the centre line
function shadowActive(b) { return b.shadow && b.shadowOff <= 0 && Math.abs(b.shadow.x - MW / 2) > SHADOW_SAFE; }

/* ---- Bat Queen ---- */
function updateBatQueen(b) {
  if (b.state === 'aim') {
    if (--b.t <= 0) { b.state = 'swoop'; b.t = 0; sfx.swoop(); }
  } else if (b.state === 'swoop') {
    const dx = b.lineX - b.x, dy = b.lineY - b.y, d = Math.hypot(dx, dy);
    const sp = 7 + b.cyc * 0.5;
    if (d <= sp) { b.x = b.lineX; b.y = b.lineY; b.state = 'dazed'; b.t = 75; shake(5, 10); }
    else { b.x += dx / d * sp; b.y += dy / d * sp; b.face = dx > 0 ? 1 : -1; }
  } else if (b.state === 'dazed') {
    if (--b.t <= 0) b.state = 'drift';
  } else if (--b.attackT <= 0) {
    // aim beyond the Soul so the dive carries through
    const dx = player.x - b.x, dy = player.y - b.y, d = Math.hypot(dx, dy) || 1;
    const len = Math.min(d + 90, 520);
    b.lineX = Math.max(20, Math.min(MW - 20, b.x + dx / d * len));
    b.lineY = Math.max(20, Math.min(MH - 20, b.y + dy / d * len));
    b.state = 'aim'; b.t = 60;
    sfx.charge();
    b.attackT = Math.max(170, 260 - b.cyc * 20);
    if (bats.length < 6) {
      for (let i = 0; i < 3; i++) bats.push({ x: b.x + (i - 1) * 20, y: b.y, life: 420, off: Math.random() * 6 });
    }
  }
}

/* ---- shared projectiles & markers ---- */
function updateBossFx(b) {
  bombs.forEach(k => {
    k.t++;
    if (k.state === 'fall' && k.t >= k.fall) {
      k.state = 'burst'; k.t = 0; k.blast = blastCells(k.r, k.c);
      sfx.boom(); shake(6, 10);
      k.blast.forEach(q => burst((q.c + 0.5) * CELL, (q.r + 0.5) * CELL, '#fb923c', 3));
    }
    if (k.state === 'burst') {
      const pc = cellOf(player.x, player.y);
      if (k.t < 24 && k.blast.some(q => q.r === pc.r && q.c === pc.c)) hurtSoul();
      if (k.t > 30) k.done = true;
    }
  });
  bombs = bombs.filter(k => !k.done);

  beams.forEach(m => {
    if (--m.t > 0) return;
    if (m.state === 'warn') {
      m.state = 'fire'; m.t = 26; sfx.beam(); shake(7, 14);
    } else m.done = true;
  });
  beams.forEach(m => {
    if (m.state !== 'fire') return;
    const band = m.axis === 'row' ? Math.abs(player.y - (m.idx + 0.5) * CELL) : Math.abs(player.x - (m.idx + 0.5) * CELL);
    if (band < 12) hurtSoul();
  });
  beams = beams.filter(m => !m.done);

  bossShots.forEach(s => {
    s.x += s.vx; s.y += s.vy; s.life--;
    if (Math.hypot(s.x - player.x, s.y - player.y) < 11) { s.life = 0; hurtSoul(); }
  });
  bossShots = bossShots.filter(s => s.life > 0 && s.x > -20 && s.x < MW + 20 && s.y > -20 && s.y < MH + 20);

  bats.forEach(k => {
    k.life--;
    const dx = player.x - k.x, dy = player.y - k.y, d = Math.hypot(dx, dy) || 1;
    k.x += dx / d * 0.95 + Math.cos(tick * 0.1 + k.off) * 0.6;
    k.y += dy / d * 0.95 + Math.sin(tick * 0.13 + k.off) * 0.6;
    if (d < 13) {
      if (magicField > 0) { k.life = 0; addScore(100); burst(k.x, k.y, '#fb7185', 8); sfx.eat(); }
      else { k.life = 0; hurtSoul(); }
    }
  });
  bats = bats.filter(k => k.life > 0);

  if (b.type === 'mirror' && shadowActive(b) && Math.hypot(b.shadow.x - player.x, b.shadow.y - player.y) < 16) {
    if (magicField > 0) { b.shadowOff = 300; addScore(300); popup(b.shadow.x, b.shadow.y, '300', '#f0abfc'); sfx.eat(); burst(b.shadow.x, b.shadow.y, '#6366f1', 14); }
    else hurtSoul();
  }
}

/* Ram the boss with the field up to hurt it; touch it without the field and
   the Soul is lost. Returns true on the killing blow. */
function bossCollide(b) {
  if (Math.hypot(b.x - player.x, b.y - (player.y - 8)) > BOSS_TOUCH + (b.type === 'batqueen' ? 6 : 0)) return false;
  if (magicField > 0) {
    if (b.invuln > 0) return false;
    b.hp--; b.invuln = 90; magicField = 0;
    b.vx = (b.x - player.x) * 0.2; b.vy = (b.y - player.y) * 0.2;
    if (b.state === 'aim' || b.state === 'swoop' || b.state === 'windup' || b.state === 'shimmer') { b.state = 'drift'; b.attackT = 120; }
    shake(10, 18); hitPause = 6;
    burst(b.x, b.y, '#fde68a', 24);
    popup(b.x, b.y - 30, b.hp > 0 ? 'HIT!' : 'DEFEATED', '#fde68a');
    sfx.bossHit();
    return b.hp <= 0;
  }
  if (b.invuln <= 0 && b.state !== 'dazed') hurtSoul();
  return false;
}

/* ============================ ART ============================ */
function drawBoss(c, b, t) {
  const blink = b.invuln > 0 && Math.floor(t / 4) % 2 === 0;
  const hover = Math.sin(b.bob) * 3;
  c.save();
  // shadow on the floor
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.ellipse(b.x, b.y + 30, 22, 6, 0, 0, Math.PI * 2); c.fill();
  if (b.state === 'shimmer' && b.dest) {
    c.globalAlpha = 0.4 + 0.4 * Math.sin(t * 0.5);
    c.strokeStyle = '#f0abfc'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(b.dest.x, b.dest.y + 6, 20 - b.t * 0.2, 7, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = b.t / 45;
  }
  if (blink) c.globalAlpha *= 0.45;
  c.translate(b.x, b.y + hover);
  c.scale(b.face, 1);
  ({ scarecrow: artScarecrow, gravelord: artGraveLord, mirror: artMirror, batqueen: artBatQueen })[b.type](c, b, t);
  c.restore();
  c.globalAlpha = 1; c.shadowBlur = 0;
}

function artScarecrow(c, b, t) {
  const raise = b.state === 'windup' ? -6 : 0, sway = Math.sin(t * 0.06) * 2;
  c.fillStyle = '#5b3a1e'; c.fillRect(-2.5, 4, 5, 30);                        // pole
  inkPath(c, [[-30, -6 + raise], [30, -6 + raise], [30, -1 + raise], [-30, -1 + raise]], '#6b4423', 1.5);   // crossbar
  // coat
  inkPath(c, [[-14, -10], [14, -10], [18 + sway, 22], [8, 17], [0, 24], [-8, 17], [-18 + sway, 22]], '#4d5b2f');
  inkPath(c, [[2, -10], [14, -10], [18 + sway, 22], [8, 17]], '#3a4523', 0);
  inkPath(c, [[-6, 0], [0, -2], [1, 8], [-5, 9]], '#8a5a2b', 1);            // patch
  // straw hands
  [-1, 1].forEach(s => {
    inkPath(c, [[s * 26, -8 + raise], [s * 36, -12 + raise], [s * 35, -4 + raise], [s * 38, 0 + raise]], '#e5c16a', 1.2);
  });
  // sack head
  inkOval(c, 0, -22, 13, 12, '#c7a46a', 1.8);
  c.strokeStyle = '#7a5a2a'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-8, -14); c.lineTo(8, -14); for (let i = -7; i <= 7; i += 3.5) { c.moveTo(i, -16); c.lineTo(i, -12); } c.stroke();
  c.shadowColor = '#f97316'; c.shadowBlur = 12;
  inkPath(c, [[-8, -26], [-3, -26], [-5.5, -21]], '#fb923c', 0);
  inkPath(c, [[3, -26], [8, -26], [5.5, -21]], '#fb923c', 0);
  c.shadowBlur = 0;
  // straw crown
  inkPath(c, [[-13, -30], [-10, -42], [-5, -33], [0, -45], [5, -33], [10, -42], [13, -30]], '#eab308', 1.5);
  c.fillStyle = '#dc2626'; c.beginPath(); c.arc(0, -36, 2, 0, Math.PI * 2); c.fill();
  // crow on the bar
  inkOval(c, -22, -12 + raise, 5, 4, '#111827', 1);
  inkPath(c, [[-26, -13 + raise], [-30, -12 + raise], [-26, -11 + raise]], '#f59e0b', 0.8);
  c.fillStyle = '#fca5a5'; c.fillRect(-25, -14 + raise, 1.5, 1.5);
}

function artGraveLord(c, b, t) {
  const hem = Math.sin(t * 0.1) * 3;
  c.shadowColor = '#4ade80'; c.shadowBlur = 16;
  inkPath(c, [[-16, -12], [16, -12], [22, 26], [12 + hem, 20], [4, 28], [-4 + hem, 20], [-14, 28], [-22, 26]], '#1e1b2e', 1.8);
  c.shadowBlur = 0;
  inkPath(c, [[2, -12], [16, -12], [22, 26], [12 + hem, 20]], '#12101d', 0);
  // ribcage glimpse
  c.strokeStyle = '#d6d3d1'; c.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-7, -4 + i * 5); c.quadraticCurveTo(0, -1 + i * 5, 7, -4 + i * 5); c.stroke(); }
  // staff with soul flame
  c.strokeStyle = '#57534e'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, -30); c.lineTo(24, 30); c.stroke();
  c.shadowColor = '#4ade80'; c.shadowBlur = 18;
  inkOval(c, 20, -34, 5, 7 + Math.sin(t * 0.3) * 1.5, '#86efac', 0);
  c.shadowBlur = 0;
  // hood + skull
  inkPath(c, [[-15, -12], [-12, -34], [0, -42], [12, -34], [15, -12]], '#2e2945', 1.8);
  inkOval(c, 0, -24, 8, 9, '#e7e5e4', 1.5);
  c.shadowColor = '#4ade80'; c.shadowBlur = 10;
  inkOval(c, -3.2, -25, 2.2, 2.6, '#4ade80', 0); inkOval(c, 3.2, -25, 2.2, 2.6, '#4ade80', 0);
  c.shadowBlur = 0;
  c.fillStyle = INK; for (let i = -3; i <= 3; i += 2) c.fillRect(i - 0.5, -18, 1, 3);
  // horned crown
  inkPath(c, [[-10, -36], [-16, -50], [-6, -40], [0, -48], [6, -40], [16, -50], [10, -36]], '#a8a29e', 1.4);
}

function artMirror(c, b, t) {
  for (let i = 0; i < 5; i++) {
    const a = t * 0.03 + i * Math.PI * 2 / 5, r = 30;
    c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r * 0.6 - 8); c.rotate(a);
    inkPath(c, [[0, -6], [3, 0], [0, 6], [-3, 0]], 'rgba(233,213,255,0.8)', 1);
    c.restore();
  }
  c.shadowColor = '#e879f9'; c.shadowBlur = 18;
  inkPath(c, [[-14, -14], [14, -14], [20, 20], [8, 14], [0, 26], [-8, 14], [-20, 20]], '#3b0764', 1.8);
  c.shadowBlur = 0;
  inkPath(c, [[-12, -14], [0, -14], [-6, 12], [-16, 16]], '#581c87', 0);
  // mirror face: an oval glass that holds a warped, dark soul
  inkOval(c, 0, -26, 12, 15, '#c7d2fe', 2.2);
  const g = c.createLinearGradient(-10, -40, 10, -12);
  g.addColorStop(0, '#e0e7ff'); g.addColorStop(0.5, '#818cf8'); g.addColorStop(1, '#1e1b4b');
  inkOval(c, 0, -26, 9, 12, g, 0);
  inkOval(c, Math.sin(t * 0.05) * 2, -26, 4, 5, '#0b0616', 0);
  c.fillStyle = '#f43f5e'; c.fillRect(-2.5 + Math.sin(t * 0.05) * 2, -27, 1.5, 1.5); c.fillRect(1 + Math.sin(t * 0.05) * 2, -27, 1.5, 1.5);
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-6, -33); c.lineTo(-3, -36); c.stroke();
  // silver frame points
  inkPath(c, [[0, -48], [4, -41], [-4, -41]], '#e5e7eb', 1.2);
}

function artBatQueen(c, b, t) {
  const f = b.state === 'swoop' ? 10 : Math.sin(t * 0.18) * 7;
  [-1, 1].forEach(s => {
    inkPath(c, [[s * 8, -14], [s * 30, -28 - f], [s * 46, -18 - f], [s * 38, -8], [s * 30, -12], [s * 24, -2], [s * 16, -8], [s * 10, 2]], '#3f0d12', 1.6);
    c.strokeStyle = '#7f1d1d'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(s * 10, -12); c.lineTo(s * 30, -26 - f); c.moveTo(s * 12, -8); c.lineTo(s * 38, -10); c.stroke();
  });
  // gown
  inkPath(c, [[-9, -12], [9, -12], [16, 24], [0, 20], [-16, 24]], '#991b1b', 1.8);
  inkPath(c, [[2, -12], [9, -12], [16, 24], [6, 21]], '#6b1111', 0);
  inkPath(c, [[-12, -16], [-6, -9], [0, -13], [6, -9], [12, -16], [9, -12], [-9, -12]], '#450a0a', 1.2);
  // face + hair
  inkOval(c, 0, -22, 7, 7.5, '#f1e4e8', 1.5);
  inkPath(c, [[-8, -22], [-7, -31], [0, -32], [7, -31], [8, -22], [4, -27], [0, -24], [-4, -27]], '#1c0a14', 1.2);
  c.shadowColor = '#f43f5e'; c.shadowBlur = 10;
  c.fillStyle = b.state === 'dazed' ? '#fecaca' : '#f43f5e';
  c.fillRect(-4, -23, 2.8, 2); c.fillRect(1.5, -23, 2.8, 2);
  c.shadowBlur = 0;
  c.fillStyle = '#fff'; c.fillRect(-1.5, -18.5, 1, 1.8); c.fillRect(1, -18.5, 1, 1.8);
  inkPath(c, [[-7, -31], [-5, -38], [-2, -33], [0, -39], [2, -33], [5, -38], [7, -31]], '#fbbf24', 1.2);
  if (b.state === 'dazed') {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.15 + i * 2.1;
      c.fillStyle = '#fde68a'; c.beginPath(); c.arc(Math.cos(a) * 12, -42 + Math.sin(a) * 3, 2, 0, Math.PI * 2); c.fill();
    }
  }
}

/* Telegraphs and projectiles, drawn under the hunters. */
function drawBossFx(c, b, t) {
  bombs.forEach(k => {
    const x = (k.c + 0.5) * CELL, y = (k.r + 0.5) * CELL;
    if (k.state === 'fall') {
      const p = k.t / k.fall;
      c.strokeStyle = `rgba(251,146,60,${0.4 + 0.5 * p})`; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, 12 - 6 * p, 0, Math.PI * 2); c.stroke();
      blastCells(k.r, k.c).forEach(q => { c.fillStyle = `rgba(251,146,60,${0.08 + 0.14 * p})`; c.fillRect(q.c * CELL + 2, q.r * CELL + 2, CELL - 4, CELL - 4); });
      const px = k.fromX + (x - k.fromX) * p, py = k.fromY + (y - k.fromY) * p - Math.sin(p * Math.PI) * 90;
      inkOval(c, px, py, 6, 5, '#f97316', 1.3);
      c.fillStyle = '#15803d'; c.fillRect(px - 1, py - 7, 2, 3);
    } else {
      const a = Math.max(0, 1 - k.t / 30);
      k.blast.forEach(q => {
        c.fillStyle = `rgba(254,215,170,${a})`; c.fillRect(q.c * CELL + 1, q.r * CELL + 1, CELL - 2, CELL - 2);
        c.fillStyle = `rgba(249,115,22,${a})`; c.fillRect(q.c * CELL + 5, q.r * CELL + 5, CELL - 10, CELL - 10);
      });
    }
  });
  beams.forEach(m => {
    const horiz = m.axis === 'row';
    const pos = (m.idx + 0.5) * CELL;
    if (m.state === 'warn') {
      c.strokeStyle = `rgba(74,222,128,${0.35 + 0.3 * Math.sin(t * 0.4)})`; c.lineWidth = 2; c.setLineDash([8, 6]);
      c.beginPath(); horiz ? (c.moveTo(0, pos), c.lineTo(MW, pos)) : (c.moveTo(pos, 0), c.lineTo(pos, MH)); c.stroke();
      c.setLineDash([]);
    } else {
      c.save(); c.globalCompositeOperation = 'lighter';
      [[22, 'rgba(34,197,94,0.35)'], [11, 'rgba(134,239,172,0.7)'], [4, '#f0fdf4']].forEach(([w, col]) => {
        c.fillStyle = col; horiz ? c.fillRect(0, pos - w / 2, MW, w) : c.fillRect(pos - w / 2, 0, w, MH);
      });
      c.restore();
    }
  });
  if (b && b.type === 'batqueen' && b.state === 'aim') {
    c.strokeStyle = `rgba(244,63,94,${0.4 + 0.4 * Math.sin(t * 0.5)})`; c.lineWidth = 3; c.setLineDash([10, 7]);
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.lineX, b.lineY); c.stroke(); c.setLineDash([]);
  }
  bossShots.forEach(s => {
    c.shadowColor = s.color; c.shadowBlur = 10;
    inkOval(c, s.x, s.y, 5, 5, s.color, 1.2);
    c.shadowBlur = 0; c.fillStyle = '#fff'; c.fillRect(s.x - 1.5, s.y - 1.5, 2, 2);
  });
  bats.forEach(k => drawBat(c, k.x, k.y, tick + k.off * 10));
  if (b && b.type === 'mirror' && b.shadow) {
    c.save();
    c.globalAlpha = shadowActive(b) ? 0.92 : 0.25;
    drawSoul(c, b.shadow.x, b.shadow.y, { t, dir: { x: -(b.shadow.dir.x || 0), y: b.shadow.dir.y || 0 }, palette: 'shadow' });
    c.restore();
  }
}
