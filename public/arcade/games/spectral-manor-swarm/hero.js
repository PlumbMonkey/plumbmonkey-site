// ============================================================
// SWARM — the hero: the arcade's helmeted spaceman with a plasma rifle
// Same figure as Mess Hall's hero (ink outline, shaded suit, lit visor) so
// the manor has one recognisable protagonist. The rifle is held two-handed
// and aims in world space; the body mirrors to face the aim.
// ============================================================

const HERO = { suit: '#e6ecf7', trim: '#7c3aed', limb: '#6d28d9', visor: '#16305c', lamp: '#67e8f9', boot: '#3b2b52' };
const RIFLE_REACH = 14;       // shoulder to grip
const RIFLE_LEN = 24;         // grip to muzzle

function heroFeet(p) { return { x: p.x + p.w / 2, y: p.y + p.h + 4 }; }
function heroShoulder(p) {
  const f = heroFeet(p), face = Math.cos(p.angle) < 0 ? -1 : 1;
  return { x: f.x + face * 3, y: f.y - 38 - (p.moving ? Math.abs(Math.sin(p.walkPhase || 0)) * 2 : 0) };
}
function heroMuzzle(p) {
  const s = heroShoulder(p), back = (p.recoil || 0) * 0.7;
  const d = RIFLE_REACH + RIFLE_LEN - back;
  return { x: s.x + Math.cos(p.angle) * d, y: s.y + Math.sin(p.angle) * d };
}

function limb(pts, color, w) {
  const run = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 3; run();
  ctx.strokeStyle = color; ctx.lineWidth = w; run();
}

function drawRifle(p, s, t) {
  const a = p.angle, back = (p.recoil || 0) * 0.7;
  const gx = s.x + Math.cos(a) * (RIFLE_REACH - back), gy = s.y + Math.sin(a) * (RIFLE_REACH - back);
  const st = WEAPON_STYLE[p.weapon] || WEAPON_STYLE.dual;
  // support arm to the foregrip, trigger arm to the grip
  const fgx = gx + Math.cos(a) * 11, fgy = gy + Math.sin(a) * 11;
  limb([[s.x - Math.cos(a) * 4, s.y + 3], [(s.x + fgx) / 2, (s.y + fgy) / 2 + 5], [fgx, fgy]], shade(HERO.limb, -0.25), 4.5);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(a);
  if (Math.cos(a) < 0) ctx.scale(1, -1);       // keep the rifle upright when aiming left
  inkPoly([[-8, -2], [-8, 4], [-2, 5], [0, 10], [4, 10], [4, 4], [RIFLE_LEN - 6, 3], [RIFLE_LEN - 6, -4], [2, -5]], '#312e81', 1.8); // stock + body
  inkRect(RIFLE_LEN - 7, -2.5, 8, 4.5, '#1e1b4b', 1.5);                  // barrel shroud
  // energy coils along the body, pulsing with the weapon colour
  for (let i = 0; i < 3; i++) {
    const on = 0.5 + Math.sin(t * 0.4 - i * 1.3) * 0.5;
    ctx.fillStyle = rgba(st.mid, 0.45 + on * 0.55);
    ctx.fillRect(5 + i * 4.5, -3.5, 2.5, 6);
  }
  ctx.fillStyle = st.core; ctx.fillRect(RIFLE_LEN, -1.2, 2.5, 2.4);          // emitter
  ctx.restore();
  limb([[s.x, s.y], [(s.x + gx) / 2 + Math.cos(a + 1.6) * 4, (s.y + gy) / 2 + 4], [gx, gy]], HERO.limb, 5);
  withLight(() => glow(s.x + Math.cos(a) * (RIFLE_REACH + RIFLE_LEN - back), s.y + Math.sin(a) * (RIFLE_REACH + RIFLE_LEN - back), 12, st.mid, 0.6));
}

function drawHeroBody(p, t, face) {
  const sw = p.moving ? Math.sin(p.walkPhase || 0) : 0;
  const leg = (hx, s, l) => [[hx, -20], [hx + s * 0.5, -10 - Math.abs(s) * 0.05], [hx + s, -l]];
  const a = leg(-5, sw * 12, Math.max(0, sw * 6)), b = leg(5, -sw * 12, Math.max(0, -sw * 6));
  limb(a, shade(HERO.limb, -0.3), 5);
  inkRect(a[2][0] - 4, a[2][1] - 3, 9, 4, shade(HERO.boot, -0.3), 1.6);
  const TORSO = [[-9, -44], [9, -44], [11, -28], [8, -20], [-8, -20], [-11, -28]];
  inkPoly(TORSO, HERO.suit);
  ctx.save(); ctx.beginPath(); ctx.rect(-12, -46, 6, 30); ctx.clip(); inkPoly(TORSO, shade(HERO.suit, -0.3), 0); ctx.restore();
  inkPoly([[-12, -42], [-16, -40], [-15, -26], [-11, -27]], '#94a3b8', 1.6);   // power pack on the back
  ctx.fillStyle = HERO.trim; ctx.fillRect(-8, -38, 16, 3.5);
  ctx.fillStyle = shade(HERO.trim, -0.3); ctx.fillRect(-8, -25, 16, 3);
  limb(b, HERO.limb, 5);
  inkRect(b[2][0] - 4, b[2][1] - 3, 9, 4, HERO.boot, 1.6);
  const hy = -54;
  ctx.fillStyle = '#25203a'; ctx.fillRect(-6, -46, 12, 4);
  inkOval(0, hy, 11.5, 11, '#eef3fa');
  inkOval(-4, hy - 4, 4.5, 3, '#ffffff', 0);
  inkOval(2, hy + 0.5, 8.2, 7, HERO.visor, 2);
  ctx.shadowColor = HERO.lamp; ctx.shadowBlur = 8; ctx.fillStyle = HERO.lamp;
  ctx.fillRect(0, hy - 1.5, 3, 3); ctx.fillRect(5, hy - 1.5, 3, 3);
  ctx.strokeStyle = HERO.lamp; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-7, hy - 8); ctx.lineTo(-11, hy - 16); ctx.stroke();
  ctx.beginPath(); ctx.arc(-11, hy - 17, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawHero(p, t) {
  const f = heroFeet(p);
  const face = Math.cos(p.angle) < 0 ? -1 : 1;
  const bob = p.moving ? Math.abs(Math.sin(p.walkPhase || 0)) * 2 : 0;

  // dash afterimages: cyan silhouettes left along the dash path
  (p.trail || []).forEach(g => {
    ctx.save();
    ctx.globalAlpha = g.life / 16 * 0.35;
    ctx.translate(g.x, g.y); ctx.scale(g.face, 1);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath(); ctx.ellipse(0, -32, 12, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -54, 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(f.x, f.y, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (p.invuln > 0 && !p.shieldT && Math.floor(p.invuln / 3) % 2 === 0) ctx.globalAlpha = 0.4;

  const s = heroShoulder(p);
  const aimUp = Math.sin(p.angle) < -0.3;
  if (aimUp) drawRifle(p, s, t);
  ctx.save();
  ctx.translate(f.x, f.y - bob);
  ctx.scale(face, 1);
  drawHeroBody(p, t, face);
  ctx.restore();
  if (!aimUp) drawRifle(p, s, t);
  ctx.globalAlpha = 1;

  if (p.shieldT > 0) {
    const pulse = 0.5 + Math.sin(t * 0.2) * 0.2, fading = p.shieldT < 90 && (p.shieldT >> 3) % 2;
    if (!fading) {
      withLight(() => glow(f.x, f.y - 28, 44, '#4ade80', 0.35));
      ctx.strokeStyle = `rgba(134,239,172,${pulse})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 28, 26, 34, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
