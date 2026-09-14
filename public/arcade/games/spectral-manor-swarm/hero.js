// ============================================================
// SWARM — the hero: the arcade's Spaceman with a plasma rifle
// The body comes from the shared Hero Kit (../kit/hero-kit.js): long dark hair,
// gold aviators, white flight suit and the cosmic-print vest — the same figure
// as Graveyard Shift and Mess Hall. The rifle is held two-handed and aims in
// world space, so both arms are drawn here, from the shoulders the kit reports
// for the pose it is drawing; the muzzle is measured from the same shoulder.
// ============================================================

const RIFLE_REACH = 14;       // shoulder to grip
const RIFLE_LEN = 24;         // grip to muzzle

function heroFeet(p) { return { x: p.x + p.w / 2, y: p.y + p.h + 4 }; }
function heroKitOpts(p) {
  return { pose: p.moving ? 'run' : 'idle', phase: p.walkPhase || 0, face: Math.cos(p.angle) < 0 ? -1 : 1, arms: 'none' };
}
function heroShoulder(p, back) {
  const f = heroFeet(p), s = HeroKit.shoulder(heroKitOpts(p), back);
  return { x: f.x + s.x, y: f.y + s.y };
}
function heroMuzzle(p) {
  const s = heroShoulder(p), back = (p.recoil || 0) * 0.7;
  const d = RIFLE_REACH + RIFLE_LEN - back;
  return { x: s.x + Math.cos(p.angle) * d, y: s.y + Math.sin(p.angle) * d };
}

function drawRifle(p, t) {
  const s = heroShoulder(p), sb = heroShoulder(p, true);
  const a = p.angle, back = (p.recoil || 0) * 0.7;
  const gx = s.x + Math.cos(a) * (RIFLE_REACH - back), gy = s.y + Math.sin(a) * (RIFLE_REACH - back);
  const st = WEAPON_STYLE[p.weapon] || WEAPON_STYLE.dual;
  // support arm, from the far shoulder to the foregrip
  const fgx = gx + Math.cos(a) * 11, fgy = gy + Math.sin(a) * 11;
  HeroKit.arm(ctx, [[sb.x, sb.y], [(sb.x + fgx) / 2, (sb.y + fgy) / 2 + 5], [fgx, fgy]], { back: true });
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
  // trigger arm, from the near shoulder to the grip
  HeroKit.arm(ctx, [[s.x, s.y], [(s.x + gx) / 2 + Math.cos(a + 1.6) * 4, (s.y + gy) / 2 + 4], [gx, gy]]);
  withLight(() => glow(s.x + Math.cos(a) * (RIFLE_REACH + RIFLE_LEN - back), s.y + Math.sin(a) * (RIFLE_REACH + RIFLE_LEN - back), 12, st.mid, 0.6));
}

function drawHero(p, t) {
  const f = heroFeet(p);

  // dash afterimages: cyan silhouettes left along the dash path
  (p.trail || []).forEach(g => {
    ctx.save();
    ctx.globalAlpha = g.life / 16 * 0.35;
    ctx.translate(g.x, g.y); ctx.scale(g.face, 1);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath(); ctx.ellipse(0, -30, 11, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1, -55, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(f.x, f.y, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (p.invuln > 0 && !p.shieldT && Math.floor(p.invuln / 3) % 2 === 0) ctx.globalAlpha = 0.4;

  const aimUp = Math.sin(p.angle) < -0.3;
  if (aimUp) drawRifle(p, t);
  HeroKit.spaceman(ctx, f.x, f.y, heroKitOpts(p));
  if (!aimUp) drawRifle(p, t);
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
