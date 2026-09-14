// ============================================================
// LUNO'S FLIGHT — bosses (the fourth wave of every stage)
// All of them follow the joust rule: hit them from ABOVE.
//   THE SHRIEKER   hunts you, then SCREECHES (the tell) and dives along the
//                  line it shows. A missed dive crashes it into the ground:
//                  STUNNED, and hittable even from level height.
//   THE GARGOYLE   perches as STONE — touching it just clangs you off. It
//                  cracks and glows before it wakes, swoops and spits stone
//                  shards, then returns to a perch.
//   THE STORM HAG  rides a thundercloud along the top of the sky, calls
//                  lightning where you fly, summons brooms, then swoops low.
//                  A hit sends her fading to the other side.
//   THE MOON WYRM  a serpent weaving across the moon. The HEAD is the target;
//                  the body is safe to bounce on from above, but not to fly into.
// Interface for game.js: createBoss(type, cycle) · updateBoss(b) ·
// bossCollide(b) · drawBoss(b, t)
// ============================================================

const SHRIEK_WARN = 50, STUN_TIME = 130, GARG_WAKE = 60, HAG_CAST = 70;

function createBoss(type, cycle) {
  const more = cycle * 3;
  const base = { type, t: 90, hitFlash: 0, facing: 1, invulnT: 0 };
  if (type === 'shrieker') return Object.assign(base, { name: 'THE SHRIEKER', x: -70, y: 110, w: 64, h: 48, vx: 2.5, vy: 0, hp: 6 + more, maxHp: 6 + more, state: 'hunt', flapT: 10 });
  if (type === 'gargoyle') {
    const b = Object.assign(base, { name: 'THE GARGOYLE', w: 56, h: 50, vx: 0, vy: 0, hp: 8 + more, maxHp: 8 + more, state: 'stone', t: 150, shardT: 90 });
    perchGargoyle(b);
    return b;
  }
  if (type === 'storm') return Object.assign(base, { name: 'THE STORM HAG', x: W / 2 - 40, y: 60, w: 80, h: 60, vx: 1.6, hp: 9 + more, maxHp: 9 + more, state: 'drift', t: 120, casts: 0, alpha: 1 });
  const segs = Array.from({ length: 12 }, (_, i) => ({ x: -40 - i * 22, y: 260 }));
  return Object.assign(base, { name: 'THE MOON WYRM', x: -40, y: 260, w: 44, h: 34, vx: 2.3, hp: 10 + more, maxHp: 10 + more, state: 'weave', t: 200, segs, trail: [], swayT: 0 });
}

// Pick a perch. Only createBoss snaps onto it; a returning gargoyle flies there.
function pickPerch(b) {
  const perches = platforms.filter(p => p.kind === 'belfry' || (p.kind === 'stone' && p.y < 300));
  b.perch = perches[Math.floor(Math.random() * perches.length)] || { x: W / 2 - 40, y: 200, w: 80 };
}
function perchGargoyle(b) {
  pickPerch(b);
  b.x = b.perch.x + b.perch.w / 2 - b.w / 2; b.y = b.perch.y - b.h;
}

function lunoMid() { return { x: player.x + player.w / 2, y: player.y + player.h / 2 }; }

function updateBoss(b) {
  if (b.hitFlash > 0) b.hitFlash--;
  if (b.invulnT > 0) b.invulnT--;
  b.t--;
  const L = lunoMid();
  const fast = 1 + cycleOfWave(wave) * 0.15;

  if (b.type === 'shrieker') {
    if (b.state === 'hunt') {
      if (--b.flapT <= 0) { b.vy = b.y > player.y ? -6.5 : -3; b.flapT = 16 + Math.random() * 14; }
      b.vy = Math.min(7, b.vy + 0.24);
      b.vx = Math.max(-3.6 * fast, Math.min(3.6 * fast, b.vx + (L.x > b.x + b.w / 2 ? 0.12 : -0.12)));
      b.x += b.vx; b.y += b.vy;
      b.facing = b.vx > 0 ? 1 : -1;
      if (b.y > H - 110) { b.y = H - 110; b.vy = -5; }
      if (b.y < 26) b.vy = 1;
      if (b.x < -80) b.x = W + 20; if (b.x > W + 80) b.x = -20;
      if (b.t <= 0 && b.x > 20 && b.x < W - 80) {
        b.state = 'screech'; b.t = SHRIEK_WARN; b.vx = 0; b.vy = 0;
        b.tx = L.x; b.ty = Math.min(H - 70, L.y + 20);
        b.y = Math.min(b.y, player.y - 60);
        sfx.shrieker(); triggerShake(4, 10);
      }
    } else if (b.state === 'screech') {
      b.y += Math.sin(tick * 0.5) * 0.6;
      if (b.t > 12 || b.tx === undefined) { b.tx = L.x; b.ty = Math.min(H - 70, L.y + 20); b.facing = b.tx > b.x ? 1 : -1; }   // track, then lock
      if (b.t <= 0) {
        const dx = b.tx - (b.x + b.w / 2), dy = b.ty - (b.y + b.h / 2), d = Math.hypot(dx, dy) || 1;
        b.vx = dx / d * 9 * fast; b.vy = dy / d * 9 * fast;
        b.state = 'dive'; b.t = 70;
      }
    } else if (b.state === 'dive') {
      b.x += b.vx; b.y += b.vy;
      if (b.y + b.h >= H - 50 || b.t <= 0) {
        b.y = Math.min(b.y, H - 50 - b.h);
        b.state = 'stunned'; b.t = STUN_TIME;
        triggerShake(10, 16); sfx.crash();
        createParticles(b.x + b.w / 2, b.y + b.h, '#a8a29e', 20);
      }
    } else if (b.state === 'stunned' && b.t <= 0) { b.state = 'hunt'; b.t = 240; b.vy = -6; }
    return;
  }

  if (b.type === 'gargoyle') {
    if (b.state === 'stone') {
      if (b.perch) { b.x = b.perch.x + b.perch.w / 2 - b.w / 2; b.y = b.perch.y - b.h; }
      if (b.t <= 0) { b.state = 'waking'; b.t = GARG_WAKE; sfx.stone(); }
    } else if (b.state === 'waking') {
      if (b.t <= 0) { b.state = 'flying'; b.t = 420; b.vy = -4; sfx.roar(); }
    } else if (b.state === 'flying' || b.state === 'return') {
      let tx, ty;
      if (b.state === 'flying') { tx = L.x + Math.sin(tick * 0.02) * 160; ty = L.y - 60 + Math.cos(tick * 0.03) * 80; }
      else { tx = b.perch.x + b.perch.w / 2; ty = b.perch.y - b.h / 2; }
      b.vx += Math.sign(tx - (b.x + b.w / 2)) * 0.14 * fast;
      b.vy += Math.sign(ty - (b.y + b.h / 2)) * 0.12 * fast;
      b.vx = Math.max(-3.4, Math.min(3.4, b.vx)) * 0.99; b.vy = Math.max(-3, Math.min(3, b.vy)) * 0.99;
      b.x += b.vx; b.y += b.vy;
      b.facing = b.vx > 0 ? 1 : -1;
      if (b.state === 'flying') {
        if (--b.shardT <= 0) {
          const a = Math.atan2(L.y - (b.y + 20), L.x - (b.x + b.w / 2));
          [-0.25, 0, 0.25].forEach(o => fireBolt(b.x + b.w / 2, b.y + 20, a + o, 3.6 * fast, '#cbd5e1'));
          sfx.hexFire(); b.shardT = 100;
        }
        if (b.t <= 0) { b.state = 'return'; pickPerch(b); }
      } else if (Math.hypot(tx - (b.x + b.w / 2), ty - (b.y + b.h / 2)) < 20) {
        b.state = 'stone'; b.t = 200; b.vx = b.vy = 0; sfx.stone();
      }
    }
    return;
  }

  if (b.type === 'storm') {
    if (b.state === 'fade') {
      b.alpha = Math.abs(b.t - 20) / 20;
      if (b.t === 20) { b.x = b.x + b.w / 2 < W / 2 ? W - 140 : 60; b.y = 60; }
      if (b.t <= 0) { b.alpha = 1; b.state = 'drift'; b.t = 90; }
      return;
    }
    if (b.state === 'drift') {
      b.x += b.vx * fast; b.y = 60 + Math.sin(tick * 0.03) * 12;
      if (b.x < 20 || b.x + b.w > W - 20) b.vx *= -1;
      b.facing = L.x > b.x + b.w / 2 ? 1 : -1;
      if (b.t <= 0) { b.state = 'cast'; b.t = HAG_CAST; sfx.hexCharge(); }
    } else if (b.state === 'cast') {
      if (b.t === 20) {
        addStorm(L.x);
        if (cycleOfWave(wave) > 0 || b.hp < b.maxHp / 2) addStorm(L.x + (Math.random() < 0.5 ? -120 : 120));
        b.casts++;
        if (b.casts % 3 === 0) { spawnFlyingWitch(b.x, b.y + 40, 'broom'); spawnFlyingWitch(b.x + b.w, b.y + 40, 'broom'); }
      }
      if (b.t <= 0) {
        if (b.casts % 3 === 0) { b.state = 'swoop'; b.t = 150; }
        else { b.state = 'drift'; b.t = 110; }
      }
    } else if (b.state === 'swoop') {
      const k = 1 - b.t / 150;
      b.y = 60 + Math.sin(k * Math.PI) * 220;
      b.x += b.vx * 1.4 * fast;
      if (b.x < 20 || b.x + b.w > W - 20) b.vx *= -1;
      if (b.t <= 0) { b.state = 'drift'; b.t = 100; }
    }
    return;
  }

  // moon wyrm
  b.swayT += 0.02 * fast;
  b.x += b.vx * fast;
  b.y = 250 + Math.sin(b.swayT) * 150 + Math.sin(b.swayT * 2.7) * 30;
  if (b.x > W + 60) b.x = -60;
  if (b.x < -60) b.x = W + 60;
  b.facing = b.vx > 0 ? 1 : -1;
  b.trail.unshift({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  if (b.trail.length > 260) b.trail.pop();
  b.segs.forEach((s, i) => { const p = b.trail[Math.min(b.trail.length - 1, (i + 1) * 6)]; if (p) { s.x = p.x; s.y = p.y; } });
  if (b.state === 'weave' && b.t <= 0) { b.state = 'rear'; b.t = 50; sfx.hexCharge(); }
  else if (b.state === 'rear' && b.t <= 0) {
    const a = Math.atan2(L.y - (b.y + b.h / 2), L.x - (b.x + b.w / 2));
    [-0.2, 0, 0.2].forEach(o => fireBolt(b.x + b.w / 2 + b.facing * 20, b.y + b.h / 2, a + o, 4 * fast, '#fb7185'));
    sfx.hexFire();
    b.state = 'weave'; b.t = b.hp < b.maxHp / 2 ? 120 : 180;
  }
}

function damageBoss(b, n) {
  b.hp -= n;
  b.hitFlash = 12;
  hitPause = 3;
  triggerShake(6, 12);
  sfx.crystal();
  createParticles(b.x + b.w / 2, b.y, '#fde68a', 16);
  addScore(300);
  if (b.type === 'storm' && b.hp > 0) { b.state = 'fade'; b.t = 40; }
}

function bossCollide(b) {
  if (player.invuln > 0 || b.invulnT > 0) return;
  if (b.type === 'storm' && b.state === 'fade') return;

  if (b.type === 'wyrm' && !joust(b)) {
    // body segments: a safe pogo from above, a hazard from the side. Checked
    // only when Luno is NOT on the head — the neck always overlaps a head
    // landing, and used to swallow every head hit as a harmless bounce.
    for (const s of b.segs) {
      const r = wyrmSegRadius(b.segs.indexOf(s));
      const seg = { x: s.x - r, y: s.y - r * 0.85, w: r * 2, h: r * 1.7 };
      const j = joust(seg);
      if (!j) continue;
      if (j === 'above') { bounceLuno(-6.5); sfx.bump(); }
      else hurtLuno('#fb7185');
      return;
    }
  }
  const j = joust(b);
  if (!j) return;
  if (b.type === 'gargoyle' && b.state !== 'flying' && b.state !== 'return') {
    bounceLuno(j === 'above' ? -7 : 2);
    player.vx = (player.x < b.x ? -1 : 1) * 4;
    sfx.stone();
    return;
  }
  const stunned = b.type === 'shrieker' && b.state === 'stunned';
  if (j === 'above' || (stunned && j === 'level')) {
    damageBoss(b, 1);
    bounceLuno(-7.5);
    b.invulnT = 16;
    if (b.type === 'shrieker' && b.state === 'dive') { b.state = 'stunned'; b.t = STUN_TIME; }
  } else if (j === 'level' && !stunned) {
    bounceLuno(-3);
    player.vx = (player.x < b.x ? -1 : 1) * 5;
    sfx.bump();
  } else if (j === 'below') {
    hurtLuno('#f59e0b');
  }
}

// ------------------------------------------------------------ art
function drawBoss(b, t) {
  ctx.save();
  if (b.hitFlash > 0 && Math.floor(b.hitFlash / 3) % 2 === 0) ctx.globalAlpha = 0.55;
  ({ shrieker: drawShrieker, gargoyle: drawGargoyle, storm: drawHag, wyrm: drawWyrm })[b.type](b, t);
  ctx.restore();
}

function dizzyStars(x, y, t) {
  ctx.fillStyle = '#fde047'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; ctx.fillText('★', x + Math.cos(a) * 22, y + Math.sin(a) * 6); }
}

function drawShrieker(b, t) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (b.state === 'screech') {                   // TELL: rings + the dive line from the beak
    const k = 1 - b.t / SHRIEK_WARN;
    ctx.strokeStyle = `rgba(245,158,11,${0.3 + k * 0.6})`; ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) { const r = ((t * 2 + i * 20) % 40) + 20; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 2;
    ctx.strokeStyle = `rgba(248,113,113,${0.3 + k * 0.7})`; ctx.lineWidth = 4;
    const d = Math.hypot(b.tx - cx, b.ty - cy) || 1, len = Math.min(d, 90 + k * 260);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (b.tx - cx) / d * len, cy + (b.ty - cy) / d * len); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(b.facing, 1);
  if (b.state === 'dive') ctx.rotate(Math.atan2(b.vy, Math.abs(b.vx)) * 0.7);
  const stunned = b.state === 'stunned';
  const flap = stunned ? 10 : b.vy < 0 || b.state === 'screech' ? -34 + Math.sin(t * 0.6) * 8 : -12;
  inkPoly([[-8, -4], [-36, flap - 6], [-48, 10], [-36, 6], [-40, 18], [-26, 12], [-28, 22], [-10, 10]], '#1c1917', 2);   // far wing
  inkOval(0, 4, 25, 17, '#292524', 2.5);
  ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.ellipse(-4, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
  inkPoly([[12, -6], [22, -18], [30, -14], [20, 0]], '#3f3a36', 2);                 // neck ruff
  inkOval(24, -16, 8.5, 7.5, '#7f1d1d', 2, 0.3);                                     // bald red head
  inkPoly([[30, -18], [42, -12], [36, -8], [30, -10]], '#f59e0b', 1.6);              // hooked beak
  if (stunned) dizzyStars(10, -40, t);
  else { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12; ctx.fillStyle = b.state === 'screech' ? '#ef4444' : '#fbbf24'; ctx.beginPath(); ctx.arc(26, -18, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
  inkPoly([[-6, -2], [-30, flap], [-44, 14], [-30, 10], [-34, 22], [-20, 14], [-20, 24], [-4, 10]], '#1c1917', 2);      // near wing
  limb([[-2, 18], [-2, 26]], '#f59e0b', 2.5); limb([[8, 18], [10, 26]], '#f59e0b', 2.5);
  ctx.restore();
}

function drawGargoyle(b, t) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const stone = b.state === 'stone' || b.state === 'waking';
  const wake = b.state === 'waking' ? 1 - b.t / GARG_WAKE : 0;
  ctx.save();
  ctx.translate(cx + (wake ? Math.sin(t * 1.5) * wake * 2 : 0), cy);
  ctx.scale(b.facing, 1);
  const body = stone ? '#6b7280' : '#4b5563', dark = shade(body, -0.35);
  const flap = stone ? 0 : Math.sin(t * 0.3) * 14;
  // bat wings (folded when stone)
  if (stone) inkPoly([[-8, -16], [-26, -26], [-22, 4], [-10, 8]], dark, 2);
  else inkPoly([[-6, -10], [-40, -30 + flap], [-52, 0 + flap * 0.5], [-38, -4], [-40, 12], [-26, 2], [-22, 14], [-8, 6]], dark, 2);
  // crouched body
  inkOval(0, 6, 20, 17, body, 2.5);
  limb([[-10, 18], [-14, 24]], dark, 5); limb([[10, 18], [14, 24]], dark, 5);
  // head: horns, heavy brow, fangs
  inkPoly([[6, -22], [2, -36], [12, -26]], dark, 1.8);
  inkPoly([[16, -22], [22, -36], [22, -22]], dark, 1.8);
  inkOval(12, -14, 12, 10, body, 2.5);
  ctx.fillStyle = dark; ctx.fillRect(2, -19, 20, 3);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(14, -7, 2, 4); ctx.fillRect(19, -7, 2, 4);
  if (stone) {
    ctx.strokeStyle = wake > 0 ? `rgba(251,146,60,${0.4 + wake * 0.6})` : 'rgba(31,41,55,0.6)'; ctx.lineWidth = 1.5;
    if (wake > 0) { ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 12 * wake; }
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-2, 6); ctx.lineTo(-6, 14); ctx.moveTo(6, -12); ctx.lineTo(12, -4); ctx.lineTo(8, 4); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = wake > 0 ? '#fb923c' : '#374151'; ctx.fillRect(9, -15, 3, 3); ctx.fillRect(16, -15, 3, 3);
  } else {
    inkPoly([[-8, -10], [-32, -24 + flap * 0.8], [-44, 4], [-30, 0], [-30, 14], [-18, 4], [-12, 12], [-4, 4]], body, 2);   // near wing
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12; ctx.fillStyle = '#ef4444';
    ctx.fillRect(9, -15, 3, 3); ctx.fillRect(16, -15, 3, 3); ctx.shadowBlur = 0;
    if (b.shardT < 20) { ctx.fillStyle = `rgba(203,213,225,${1 - b.shardT / 20})`; ctx.beginPath(); ctx.arc(22, -8, 5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function drawHag(b, t) {
  ctx.globalAlpha *= b.alpha;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  // thundercloud mount
  for (let i = 0; i < 5; i++) inkOval(cx - 36 + i * 18, cy + 22 + (i % 2) * 5, 20, 12, i % 2 ? '#374151' : '#1f2937', 1.6);
  if ((t >> 3) % 5 === 0) { ctx.strokeStyle = 'rgba(165,243,252,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 10, cy + 32); ctx.lineTo(cx - 4, cy + 42); ctx.lineTo(cx - 12, cy + 50); ctx.stroke(); }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(b.facing, 1);
  const casting = b.state === 'cast' ? 1 - b.t / HAG_CAST : 0;
  // robe and long white hair
  inkPoly([[-14, -8], [14, -8], [22, 24], [-22, 24]], '#1e3a5f', 2);
  for (let i = 0; i < 5; i++) { const w = Math.sin(t * 0.1 + i) * 5; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6 + i, -22); ctx.quadraticCurveTo(-18 + w, -8, -24 + w, 10 + i * 3); ctx.stroke(); }
  inkOval(2, -20, 9, 10, '#a3b18a', 2);
  inkPoly([[8, -22], [18, -17], [9, -14]], '#8a9a70', 1.4);                         // hooked nose
  ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 10; ctx.fillStyle = '#67e8f9';
  ctx.fillRect(3, -23, 3, 3); ctx.shadowBlur = 0;
  inkPoly([[-16, -26], [18, -26], [12, -30], [4, -52], [-2, -38], [-10, -30]], '#111827', 2);   // storm hat
  ctx.fillStyle = '#67e8f9'; ctx.fillRect(-9, -30, 18, 3);
  // staff arm, the orb flaring during a cast
  const up = casting * 20;
  limb([[10, -8], [20, -14 - up * 0.5], [26, -20 - up]], '#1e3a5f', 3.5);
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, -20 - up + 30); ctx.lineTo(26, -20 - up - 12); ctx.stroke();
  ctx.shadowColor = '#a5f3fc'; ctx.shadowBlur = 10 + casting * 20;
  inkOval(26, -34 - up, 5 + casting * 3, 5 + casting * 3, '#cffafe', 1.5);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function wyrmSegRadius(i) { return 15 - i * 0.6; }

function drawWyrm(b, t) {
  // one continuous body: a thick inked stroke through the segments (broken
  // where the serpent wraps across the screen edge, so no line spans the sky)
  const chain = [{ x: b.x + b.w / 2, y: b.y + b.h / 2 }, ...b.segs];
  for (const [w, col] of [[24, INK], [19, '#991b1b']]) {
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1], c = chain[i];
      if (Math.hypot(a.x - c.x, a.y - c.y) > 50) continue;
      ctx.lineWidth = Math.max(6, w - i * (col === INK ? 1.1 : 1.1));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
  }
  for (let i = b.segs.length - 1; i >= 0; i--) {
    const s = b.segs[i], r = wyrmSegRadius(i);
    inkOval(s.x, s.y, r, r * 0.85, i % 2 ? '#7f1d1d' : '#991b1b', 2);
    inkPoly([[s.x - 4, s.y - r * 0.7], [s.x, s.y - r - 7], [s.x + 4, s.y - r * 0.7]], '#fca5a5', 1.2);   // dorsal spines
    ctx.fillStyle = 'rgba(254,202,202,0.35)'; ctx.beginPath(); ctx.arc(s.x - r * 0.3, s.y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rear = b.state === 'rear' ? 1 - b.t / 50 : 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(b.facing, 1);
  inkPoly([[-8, -10], [-18, -26], [-4, -14]], '#fca5a5', 1.6);                       // horns
  inkPoly([[2, -12], [-4, -30], [10, -14]], '#fca5a5', 1.6);
  inkPoly([[-16, -12], [14, -14], [26, -6], [28, 4], [14, 12], [-16, 12]], '#b91c1c', 2.5);   // skull
  inkPoly([[6, 4], [28, 4 + rear * 8], [14, 14 + rear * 6], [-6, 12]], '#7f1d1d', 2);   // jaw opens on the rear
  if (rear > 0) { ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 20 * rear; ctx.fillStyle = `rgba(254,205,211,${rear})`; ctx.beginPath(); ctx.arc(24, 6, 4 + rear * 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
  ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12; ctx.fillStyle = '#fde047';
  ctx.beginPath(); ctx.ellipse(8, -5, 4, 2.5, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.restore();
}
