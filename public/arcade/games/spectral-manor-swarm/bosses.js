// ============================================================
// SWARM — boss waves (every fifth wave)
//   GRAVEKEEPER GOLEM  stone giant. Charges in a straight line (the arrow shows
//                      the path first) and STAGGERS if it hits a crypt or a
//                      wall — double damage while dazed. Slams the ground for
//                      a shockwave ring (dash through it), and raises the dead.
//   BANSHEE ARCHON     floating spirit. Fires bolt spirals, telegraphs a scream
//                      cone from her mouth, and teleports — a shimmer marks
//                      where she will reappear.
// Interface for game.js: createBoss(type, hpScale) · updateBoss(b) ·
// bossHitBy(b, x, y) · damageBoss(b, n) · bossTouches(b) · drawBoss(b, t)
// ============================================================

const G_CHARGE_WIND = 48, G_CHARGE = 44, G_STAGGER = 110, G_SLAM_WIND = 42;
const B_SCREAM_WIND = 50, B_TELE = 30;

function createBoss(type, hpScale) {
  if (type === 'golem') {
    const hp = Math.round(60 * hpScale);
    return { type, x: W / 2, y: -40, w: 64, h: 70, hp, maxHp: hp, state: 'enter', t: 80, angle: Math.PI / 2, walk: 0, flash: 0, name: 'THE GRAVEKEEPER GOLEM' };
  }
  const hp = Math.round(48 * hpScale);
  return { type, x: W / 2, y: 170, w: 46, h: 60, hp, maxHp: hp, state: 'enter', t: 70, angle: 0, spin: 0, flash: 0, alpha: 0, name: 'THE BANSHEE ARCHON' };
}

function playerCenter() { return { x: player.x + player.w / 2, y: player.y + player.h / 2 }; }
function bossRect(b) { return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }; }

function updateBoss(b) {
  b.t--;
  if (b.flash > 0) b.flash--;
  const pc = playerCenter();
  const fast = 1 + cycleOfWave(wave) * 0.15;
  if (b.type === 'golem') updateGolem(b, pc, fast);
  else updateBanshee(b, pc, fast);
}

function updateGolem(b, pc, fast) {
  if (b.state === 'enter') { b.y += 2.2; b.walk += 0.1; if (b.t <= 0) { b.state = 'walk'; b.t = 70; } return; }
  if (b.state === 'stagger') { if (b.t <= 0) { b.state = 'walk'; b.t = 50; } return; }
  if (b.state === 'walk') {
    const dx = pc.x - b.x, dy = pc.y + 20 - b.y, d = Math.hypot(dx, dy) || 1;
    b.x += dx / d * 0.9 * fast; b.y += dy / d * 0.9 * fast; b.walk += 0.08;
    b.angle = Math.atan2(dy, dx);
    if (b.t <= 0) {
      const roll = Math.random();
      if (roll < 0.45) { b.state = 'chargeWind'; b.t = G_CHARGE_WIND; b.chargeA = b.angle; sfx.rumble(); }
      else if (roll < 0.8) { b.state = 'slamWind'; b.t = G_SLAM_WIND; sfx.rumble(); }
      else { b.state = 'summon'; b.t = 50; }
    }
    return;
  }
  if (b.state === 'chargeWind') {
    // keep tracking for most of the wind-up, then lock the path
    if (b.t > 14) { const dx = pc.x - b.x, dy = pc.y + 20 - b.y; b.chargeA = Math.atan2(dy, dx); }
    if (b.t <= 0) { b.state = 'charge'; b.t = G_CHARGE; }
    return;
  }
  if (b.state === 'charge') {
    const sp = 7.5 * fast;
    b.x += Math.cos(b.chargeA) * sp; b.y += Math.sin(b.chargeA) * sp; b.walk += 0.3;
    if (b.t % 3 === 0) burst(b.x, b.y, '#a8a29e', 2, false);
    const r = bossRect(b);
    const hitWall = r.x < 6 || r.x + r.w > W - 6 || r.y < 6 || r.y + r.h > H - 4;
    const crypt = obstacles.find(o => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
    if (hitWall || crypt) {
      if (crypt) { obstacles.splice(obstacles.indexOf(crypt), 1); burst(crypt.x + crypt.w / 2, crypt.y + crypt.h / 2, '#6b5f80', 24, false); }
      b.x = Math.max(b.w / 2 + 8, Math.min(W - b.w / 2 - 8, b.x));
      b.y = Math.max(b.h + 8, Math.min(H - 6, b.y));
      b.state = 'stagger'; b.t = G_STAGGER;
      triggerShake(14, 20); sfx.crash();
      bannerFlash('STAGGERED — FIRE!');
    } else if (b.t <= 0) { b.state = 'walk'; b.t = 60; }
    return;
  }
  if (b.state === 'slamWind') {
    if (b.t <= 0) {
      shockRings.push({ x: b.x, y: b.y - 4, r: 20, max: 230, speed: 5.5 * fast, life: 42, maxLife: 42, hurt: true, color: '#86efac' });
      shockRings.push({ x: b.x, y: b.y - 4, r: 0, max: 150, speed: 4 * fast, life: 38, maxLife: 38, hurt: true, color: '#86efac' });
      triggerShake(12, 18); sfx.slam();
      b.state = 'walk'; b.t = 80;
    }
    return;
  }
  if (b.state === 'summon') {
    if (b.t === 25) {
      for (let i = 0; i < 2 + Math.min(2, cycleOfWave(wave)); i++) {
        const a = Math.random() * Math.PI * 2;
        raiseFromGrave(b.x + Math.cos(a) * 140, b.y + Math.sin(a) * 90, Math.random() < 0.6 ? 'grunt' : 'horror');
      }
    }
    if (b.t <= 0) { b.state = 'walk'; b.t = 70; }
  }
}

function updateBanshee(b, pc, fast) {
  b.spin += 0.05;
  if (b.state === 'enter') { b.alpha = Math.min(1, b.alpha + 0.02); if (b.t <= 0) { b.state = 'drift'; b.t = 90; } return; }
  if (b.state === 'teleOut') {
    b.alpha = b.t / B_TELE;
    if (b.t <= 0) { b.x = b.tx; b.y = b.ty; b.state = 'teleIn'; b.t = B_TELE; }
    return;
  }
  if (b.state === 'teleIn') { b.alpha = 1 - b.t / B_TELE; if (b.t <= 0) { b.alpha = 1; b.state = 'drift'; b.t = 60; } return; }

  b.angle = Math.atan2(pc.y - b.y, pc.x - b.x);
  if (b.state === 'drift') {
    const d = Math.hypot(pc.x - b.x, pc.y - b.y) || 1, want = d < 200 ? -1 : d > 320 ? 1 : 0;
    b.x += Math.cos(b.angle) * want * 1.4 * fast + Math.cos(b.spin) * 1.2;
    b.y += Math.sin(b.angle) * want * 1.4 * fast + Math.sin(b.spin * 1.3) * 0.8;
    // she is drawn ~90px above her anchor: keep her clear of the boss bars at the top
    b.x = Math.max(60, Math.min(W - 60, b.x)); b.y = Math.max(160, Math.min(H - 20, b.y));
    if (b.t <= 0) {
      const roll = Math.random();
      if (roll < 0.4) { b.state = 'spiral'; b.t = 100; }
      else if (roll < 0.75) { b.state = 'screamWind'; b.t = B_SCREAM_WIND; b.screamA = b.angle; sfx.wail(); }
      else {
        b.state = 'teleOut'; b.t = B_TELE;
        const a = Math.random() * Math.PI * 2;
        b.tx = Math.max(70, Math.min(W - 70, pc.x + Math.cos(a) * 260));
        b.ty = Math.max(160, Math.min(H - 30, pc.y + Math.sin(a) * 170));
      }
    }
    return;
  }
  if (b.state === 'spiral') {
    if (b.t % 5 === 0) {
      for (let k = 0; k < 2; k++) {
        const a = b.spin * 2.2 + k * Math.PI;
        fireBolt(b.x, b.y - 40, a, 3.4 * fast, '#f472b6', 6, true);
      }
    }
    if (b.t <= 0) { b.state = 'drift'; b.t = 80; }
    return;
  }
  if (b.state === 'screamWind') {
    if (b.t > 12) b.screamA = b.angle;
    if (b.t <= 0) {
      for (let i = -4; i <= 4; i++) fireBolt(b.x, b.y - 44, b.screamA + i * 0.1, 6 * fast, '#fb7185', 5, false);
      triggerShake(8, 14); sfx.scream();
      b.state = 'drift'; b.t = 90;
    }
  }
}

function bossHitBy(b, x, y) {
  if (b.state === 'enter' || (b.type === 'banshee' && b.alpha < 0.5)) return false;
  const r = bossRect(b);
  return x > r.x && x < r.x + r.w && y > r.y - 10 && y < r.y + r.h;
}
function damageBoss(b, n) {
  const mult = b.state === 'stagger' ? 2 : 1;
  b.hp -= n * mult;
  b.flash = 5;
}
function bossTouches(b) {
  if (b.state === 'enter' || (b.type === 'banshee' && b.alpha < 0.5)) return false;
  const r = bossRect(b);
  return player.x < r.x + r.w && player.x + player.w > r.x && player.y < r.y + r.h && player.y + player.h > r.y + r.h * 0.35;
}

// ------------------------------------------------------------ art
function drawBoss(b, t) {
  if (b.type === 'golem') drawGolem(b, t);
  else drawBanshee(b, t);
}

function drawGolem(b, t) {
  const face = Math.cos(b.angle) < 0 ? -1 : 1;
  const stomp = Math.abs(Math.sin(b.walk)) * 3;
  const wind = b.state === 'slamWind' ? 1 - b.t / G_SLAM_WIND : 0;
  const daze = b.state === 'stagger';
  // TELL: the charge path, starting at the golem
  if (b.state === 'chargeWind') {
    const k = 1 - b.t / G_CHARGE_WIND;
    ctx.save();
    ctx.strokeStyle = `rgba(248,113,113,${0.25 + k * 0.6})`; ctx.lineWidth = 6 + k * 10; ctx.lineCap = 'round';
    ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y - 10); ctx.lineTo(b.x + Math.cos(b.chargeA) * 260, b.y - 10 + Math.sin(b.chargeA) * 260); ctx.stroke();
    ctx.restore();
  }
  if (b.state === 'slamWind') {
    ctx.strokeStyle = `rgba(134,239,172,${0.2 + wind * 0.6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 4, 60 + wind * 80, (60 + wind * 80) * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(b.x, b.y, 44, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y - stomp * 0.5);
  ctx.scale(face, 1);
  if (b.flash > 0) ctx.globalAlpha = 0.6;
  if (daze) ctx.rotate(Math.sin(t * 0.3) * 0.06);
  const stone = '#6b6480', dark = shade(stone, -0.35), lite = shade(stone, 0.2);
  // legs
  inkRect(-22, -30, 16, 30 - stomp, dark); inkRect(6, -30, 16, 30 + stomp - 4, stone);
  // back fist
  const raise = wind * 40;
  inkPoly([[-38, -62 - raise], [-24, -66 - raise], [-20, -46 - raise], [-36, -42 - raise]], dark, 2.5);
  // torso slab
  inkPoly([[-30, -86], [30, -86], [34, -52], [24, -30], [-24, -30], [-34, -52]], stone, 3);
  inkPoly([[-30, -86], [30, -86], [26, -76], [-26, -76]], lite, 0);
  ctx.strokeStyle = dark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -80); ctx.lineTo(-10, -62); ctx.lineTo(-16, -44); ctx.moveTo(20, -70); ctx.lineTo(12, -56); ctx.stroke();
  ctx.fillStyle = 'rgba(74,222,128,0.45)'; ctx.fillRect(-30, -86, 22, 5); ctx.fillRect(10, -86, 14, 4);   // moss
  // rune core: the weak point, brighter when dazed
  withLight(() => glow(0, -60, daze ? 38 : 24, '#4ade80', daze ? 1 : 0.7));
  inkOval(0, -60, 9, 9, daze ? '#d9f99d' : '#4ade80', 2);
  // head
  inkPoly([[-14, -104], [14, -104], [16, -86], [-16, -86]], stone, 2.5);
  ctx.fillStyle = dark; ctx.fillRect(-12, -98, 26, 4);
  if (daze) {
    ctx.fillStyle = '#fde047'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; ctx.fillText('★', Math.cos(a) * 20, -118 + Math.sin(a) * 5); }
  } else {
    ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 10; ctx.fillStyle = b.state === 'chargeWind' ? '#f87171' : '#bbf7d0';
    ctx.fillRect(2, -94, 5, 4); ctx.fillRect(10, -94, 4, 4); ctx.shadowBlur = 0;
  }
  // front fist
  inkPoly([[24, -64 - raise], [42, -60 - raise], [44, -38 - raise], [26, -40 - raise]], stone, 2.5);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBanshee(b, t) {
  if (b.state === 'teleOut' || b.state === 'teleIn') {   // TELL: shimmer where she lands
    const k = b.state === 'teleOut' ? 1 - b.t / B_TELE : b.t / B_TELE;
    ctx.strokeStyle = `rgba(244,114,182,${0.3 + k * 0.5})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const r = 14 + ((t * 1.5 + i * 12) % 36);
      ctx.beginPath(); ctx.ellipse(b.tx, b.ty - 30, r, r * 1.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (b.state === 'screamWind') {                         // TELL: the scream cone from her mouth
    const k = 1 - b.t / B_SCREAM_WIND;
    ctx.fillStyle = `rgba(251,113,133,${0.08 + k * 0.18})`;
    ctx.beginPath(); ctx.moveTo(b.x, b.y - 44);
    ctx.arc(b.x, b.y - 44, 90 + k * 160, b.screamA - 0.45, b.screamA + 0.45); ctx.closePath(); ctx.fill();
  }
  const face = Math.cos(b.angle) < 0 ? -1 : 1;
  const hover = Math.sin(t * 0.07) * 6;
  ctx.save();
  ctx.globalAlpha = b.alpha * (b.flash > 0 ? 0.55 : 1);
  ctx.translate(b.x, b.y - 20 + hover);
  ctx.scale(face, 1);
  withLight(() => glow(0, -26, 70, '#f472b6', 0.45));
  // gown dissolving into wisps
  for (let i = 0; i < 5; i++) {
    const w = Math.sin(t * 0.12 + i * 1.4) * 6;
    inkPoly([[-16 + i * 7, -10], [-10 + i * 7, -10], [-12 + i * 6 + w, 26 + (i % 2) * 8]], rgba('#f9a8d4', 0.55), 1.2);
  }
  inkPoly([[-14, -44], [14, -44], [20, -8], [-20, -8]], '#be185d', 2);
  inkPoly([[-8, -44], [8, -44], [10, -10], [-10, -10]], '#f472b6', 0);
  // outstretched arms
  const reach = b.state === 'screamWind' ? 1 : 0.4 + Math.sin(t * 0.1) * 0.2;
  ctx.strokeStyle = '#fbcfe8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, -40); ctx.quadraticCurveTo(24, -44 - reach * 10, 34, -40 - reach * 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, -40); ctx.quadraticCurveTo(-22, -32, -30, -24 - reach * 8); ctx.stroke();
  // streaming hair
  for (let i = 0; i < 6; i++) {
    const w = Math.sin(t * 0.15 + i) * 8;
    ctx.strokeStyle = i % 2 ? '#e9d5ff' : '#f5d0fe'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-6 + i * 2, -64); ctx.quadraticCurveTo(-26 + w, -58 + i * 3, -38 + w, -30 + i * 4); ctx.stroke();
  }
  inkOval(0, -58, 10, 12, '#fdf2f8', 2);
  ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 12; ctx.fillStyle = '#f472b6';
  ctx.fillRect(1, -62, 3, 3); ctx.fillRect(6, -62, 3, 3); ctx.shadowBlur = 0;
  const mouth = b.state === 'screamWind' ? 1 - b.t / B_SCREAM_WIND : 0.2;
  inkOval(4, -51, 2.5 + mouth * 2, 2 + mouth * 5, '#4c0519', 1.2);
  ctx.restore();
  ctx.globalAlpha = 1;
}
