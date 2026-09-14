// ============================================================
// LUNO'S FLIGHT — Luno, the riders, ghosts, nests and crystals
// Luno is an owl-griffin: owl head and wings, lion haunch and tail. The rider
// is the arcade's helmeted spaceman (same hero as Mess Hall and Swarm).
// Everything is drawn in the house style: ink outline, a shade pass, lit eyes.
// ============================================================

function limb(pts, color, w) {
  const run = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 2.5; run();
  ctx.strokeStyle = color; ctx.lineWidth = w; run();
}

// Wing lift from the flap animation: up-stroke, power down-stroke, recovery.
function wingLiftFor(p) {
  const prog = p.flapAnim > 0 ? (24 - p.flapAnim) / 24 : -1;
  if (p.dive) return 14;                        // folded back in a dive
  if (prog < 0) return -6 + Math.sin(p.flightPhase) * 3;
  if (prog < 0.22) return -8 - (prog / 0.22) * 20;
  if (prog < 0.58) return -28 + ((prog - 0.22) / 0.36) * 42;
  return 14 - ((prog - 0.58) / 0.42) * 20;
}

function drawWing(lift, near, strong) {
  const base = near ? '#8a7f74' : '#5f564d';
  const tip = near ? '#d6d3d1' : '#a8a29e';
  // primaries: five long feathers fanning from the wrist
  for (let i = 4; i >= 0; i--) {
    const ang = -0.2 - i * 0.22 + lift * 0.02, len = 30 - i * 2.5;
    const wx = -6, wy = lift * 0.45 - 2;
    const tx = wx + Math.cos(Math.PI + ang) * len, ty = wy + Math.sin(Math.PI + ang) * len * 0.6 + lift * 0.5;
    inkPoly([[wx, wy - 3], [tx, ty], [tx + 3, ty + 4], [wx + 2, wy + 4]], i === 0 && strong ? '#fde68a' : (i % 2 ? tip : shade(tip, -0.12)), 1.4);
  }
  // coverts
  inkPoly([[6, -2], [-6, lift * 0.45 - 4], [-18, lift * 0.55 + 4], [-4, 8], [8, 6]], base, 1.8);
  ctx.strokeStyle = shade(base, 0.25); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(-10, lift * 0.5 + 2); ctx.stroke();
}

function drawLuno(p, t) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (p.invuln > 0 && Math.floor(p.invuln / 3) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.scale(p.facing, 1);
  const squash = p.landSquash > 0 ? 1 - p.landSquash * 0.018 : 1;
  ctx.scale(1 / squash, squash);
  ctx.rotate(p.dive ? 0.5 : Math.max(-0.2, Math.min(0.2, p.vy * 0.02)));
  const lift = wingLiftFor(p);

  if (p.dive) {                                  // streaks behind a spirit dive
    ctx.strokeStyle = 'rgba(196,181,253,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 6, -20); ctx.lineTo(-18 + i * 6, -44 - i * 4); ctx.stroke(); }
  }
  // far wing
  if (!p.grounded) { ctx.save(); ctx.translate(4, -2); drawWing(lift * 0.8, false, false); ctx.restore(); }

  // lion hind legs + tail tuft
  const run = p.grounded && Math.abs(p.vx) > 0.4, sw = run ? Math.sin(p.walkPhase) : 0;
  if (p.grounded) {
    limb([[-12, 6], [-14 + sw * 5, 13], [-12 + sw * 8, 18]], '#8a7f74', 4);
    limb([[8, 8], [9 - sw * 5, 14], [11 - sw * 7, 18]], '#b45309', 3);   // taloned front leg
  } else {
    limb([[-12, 6], [-20, 10], [-26, 9]], '#8a7f74', 4);
    limb([[8, 8], [6, 13], [10, 15]], '#b45309', 3);
  }
  const tw = Math.sin(p.flightPhase) * 4;
  ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(-16, 4); ctx.quadraticCurveTo(-30, 2 + tw, -36, -6 + tw); ctx.stroke();
  ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 3; ctx.stroke();
  inkOval(-37, -7 + tw, 4, 3, '#57534e', 1.4);

  // body: tawny haunch into a feathered chest
  inkOval(-8, 5, 12, 9, '#a8a29e', 2, -0.1);
  inkOval(4, 2, 15, 11, '#c7bfb6', 2);
  ctx.fillStyle = '#e7e5e4';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(8 - i * 1, -2 + i * 4, 3, 0, Math.PI); ctx.fill(); }

  // rider: the spaceman in a violet saddle, leaning with the flight
  inkOval(-3, -8, 11, 4, '#4c1d95', 1.6);
  ctx.save();
  ctx.translate(-2, -10);
  ctx.rotate(Math.max(-0.2, Math.min(0.2, p.vy * 0.03)) + (p.dive ? -0.3 : 0));
  inkPoly([[-5, 0], [5, 0], [6, -11], [-5, -11]], '#e6ecf7', 1.6);
  ctx.fillStyle = '#7c3aed'; ctx.fillRect(-5, -7, 11, 2.5);
  inkOval(1, -17, 6.5, 6, '#eef3fa', 1.6);
  inkOval(2.5, -16.5, 4.5, 3.8, '#16305c', 1.2);
  ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 6; ctx.fillStyle = '#67e8f9';
  ctx.fillRect(2, -17.5, 1.8, 1.8); ctx.fillRect(4.5, -17.5, 1.8, 1.8);
  ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-3, -21); ctx.lineTo(-5, -26); ctx.stroke();
  ctx.shadowBlur = 0;
  limb([[3, -8], [9, -6], [13, -3]], '#6d28d9', 2.5);                    // arm on the reins
  ctx.restore();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(11, -13); ctx.quadraticCurveTo(16, -12, 18, -6); ctx.stroke();

  // owl head: facial disk, ear tufts, big lit eyes, hooked beak
  inkPoly([[8, -14], [5, -26], [12, -16]], '#8a7f74', 1.6);
  inkPoly([[17, -15], [21, -26], [22, -13]], '#8a7f74', 1.6);
  inkOval(15, -7, 11, 10, '#a8a29e');
  inkOval(17, -7, 8.5, 7.5, '#f5f5f4', 1.4);
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 8;
  inkOval(14.5, -8, 3.4, 3.4, '#fbbf24', 1);
  inkOval(21, -8, 3, 3, '#fbbf24', 1);
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(15.3, -8, 1.5, 0, Math.PI * 2); ctx.arc(21.6, -8, 1.3, 0, Math.PI * 2); ctx.fill();
  inkPoly([[18, -4], [24, -2], [19, 2]], '#f59e0b', 1.2);

  // near wing (in front of the body)
  if (!p.grounded) drawWing(lift, true, p.flapStrength);
  else inkPoly([[6, -2], [-14, 2], [-20, 10], [-4, 10]], '#8a7f74', 1.8);
  ctx.restore();
}

// ------------------------------------------------------------ witches
function drawMount(w, t) {
  if (w.mount === 'skimmer') {
    const hover = Math.sin(t * 0.16 + w.wingPhase) * 2;
    ctx.save(); ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 16;
    inkOval(0, 10 + hover, 22, 6, '#0f766e', 1.8);
    ctx.restore();
    ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 10 + hover, 26, 8, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.fillStyle = '#cffafe'; ctx.fillRect(-5, 9 + hover, 10, 3);
    return;
  }
  if (w.mount === 'crow') {
    const flap = Math.sin(t * 0.35 + w.wingPhase) * 9;
    inkPoly([[-12, 8], [-26, 3], [-24, 13]], '#1c1426', 1.4);                // tail
    inkPoly([[-2, 5], [-14, 5 - flap], [-20, 12 - flap * 0.4], [2, 10]], '#231a30', 1.4);  // far wing
    inkOval(0, 9, 14, 6.5, '#1c1426', 1.8);
    inkOval(13, 4, 5.5, 5, '#1c1426', 1.6);
    inkPoly([[17, 3], [25, 5], [17, 7]], '#f59e0b', 1.2);
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6; ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(14.5, 3, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    inkPoly([[4, 5], [-6, 4 - flap], [-12, 11 - flap * 0.5], [6, 10]], '#2d2140', 1.4);   // near wing
    return;
  }
  // broom: handle forward, bristles trailing, a few magic sparks
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(19, 4); ctx.lineTo(-14, 7); ctx.stroke();
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3; ctx.stroke();
  inkPoly([[-12, 3], [-26, -2], [-28, 7], [-25, 14], [-12, 10]], '#d6b36a', 1.4);
  ctx.strokeStyle = '#a16207'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-14, 5); ctx.lineTo(-25, 2); ctx.moveTo(-14, 8); ctx.lineTo(-26, 9); ctx.stroke();
  if (w.state === 'flying') for (let i = 0; i < 3; i++) {
    const k = ((t * 0.05 + i / 3) % 1);
    ctx.fillStyle = rgba(w.accent || '#4ade80', 1 - k);
    ctx.fillRect(-28 - k * 18, 6 + Math.sin(i * 2 + t * 0.2) * 5, 2, 2);
  }
}

function drawWitch(w, t) {
  ctx.save();
  ctx.translate(w.x + w.w / 2, w.y + w.h / 2);
  ctx.scale(w.facing, 1);
  if (w.state === 'walking') {
    const stride = Math.sin(w.walkPhase) * 5;
    limb([[-3, 8], [-3 + stride, 15]], '#1f1733', 2.5);
    limb([[3, 8], [3 - stride, 15]], '#1f1733', 2.5);
    if (w.mountTimer > 0 && !w.nest.taken) limb([[4, 0], [12, -4]], w.color, 2.5);
  } else drawMount(w, t);
  const hat = w.mount === 'crow' ? '#4a0418' : w.mount === 'skimmer' ? '#134e4a' : '#4c1d95';
  if (!(window.SpriteKit && SpriteKit.drawMini(ctx, 'witchRider', 0, w.state === 'walking' ? -2 : 0, { color: w.color, hat, accent: w.accent }))) {
    ctx.fillStyle = w.color; ctx.fillRect(-8, -6, 16, 20);
  }
  if (w.boltCharge > 0) {
    const charge = 1 - w.boltCharge / (w.mount === 'skimmer' ? 48 : 36);
    ctx.strokeStyle = rgba(w.accent, 0.4 + charge * 0.6); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 12 + charge * 10, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------ ghosts (destroyable)
// visible → fading → phased (harmless, can't be hit) → returning
function drawGhost(g, t) {
  const vis = g.vis;
  ctx.save();
  ctx.translate(g.x + g.w / 2, g.y + g.h / 2 + Math.sin(t * 0.06 + g.phase) * 3);
  if (vis < 0.2) {
    ctx.strokeStyle = `rgba(196,181,253,${0.15 + Math.sin(t * 0.2 + g.phase) * 0.08})`; ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 17, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = vis * (g.hurt > 0 ? 0.6 : 0.92);
  const dir = g.vx < 0 ? -1 : 1;
  ctx.scale(dir, 1);
  ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 16;
  const hem = [];
  for (let i = 0; i <= 5; i++) hem.push([13 - i * 5.2, 14 + Math.sin(t * 0.18 + i * 1.4 + g.phase) * 3 + (i % 2 ? 3 : 0)]);
  inkPoly([[-13, 14], [-14, -4], [-9, -15], [2, -18], [12, -12], [14, 2], ...hem], '#e0e7ff', 1.8);
  ctx.shadowBlur = 0;
  ctx.save(); ctx.beginPath(); ctx.rect(-15, -20, 9, 40); ctx.clip();
  inkPoly([[-13, 14], [-14, -4], [-9, -15], [2, -18], [12, -12], [14, 2], [14, 14]], '#c7d2fe', 0);
  ctx.restore();
  // sheet-flap arm reaching forward
  inkPoly([[10, -2], [20, -6 + Math.sin(t * 0.1 + g.phase) * 2], [20, 0], [11, 5]], '#e0e7ff', 1.4);
  const angry = g.vis >= 1;
  inkOval(1, -6, 3, angry ? 4.5 : 3.5, '#1e1b4b', 0);
  inkOval(8, -6, 2.6, angry ? 4 : 3, '#1e1b4b', 0);
  ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 6; ctx.fillStyle = '#c4b5fd';
  ctx.fillRect(0.5, -7, 1.5, 1.5); ctx.fillRect(7.5, -7, 1.5, 1.5); ctx.shadowBlur = 0;
  inkOval(4, 4, 2.5, 3.5 + Math.sin(t * 0.12 + g.phase), '#1e1b4b', 0);
  ctx.restore();
}

// ------------------------------------------------------------ nests, crystals, bolts
function drawNest(n, t) {
  ctx.save();
  ctx.translate(n.x + 8, n.y + 8);
  if (n.mount === 'crow') {
    inkOval(0, 3, 10, 5, '#1c1426', 1.4); inkOval(8, -1, 4, 3.5, '#1c1426', 1.2);
    inkPoly([[11, -2], [16, 0], [11, 1]], '#f59e0b', 1);
  } else if (n.mount === 'skimmer') {
    ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 12;
    inkOval(0, 4, 12, 4, '#0f766e', 1.4); ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(13, -2); ctx.lineTo(-10, 5); ctx.stroke();
    inkPoly([[-9, 2], [-18, -1], [-19, 8], [-9, 8]], '#d6b36a', 1.2);
  }
  if (n.stealable) {
    const pulse = 1 + Math.sin(t * 0.1) * 0.15;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 14;
    inkPoly([[0, -12], [4, -7], [0, -2], [-4, -7]], '#f5d0fe', 1);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawCrystal(c, t) {
  if (c.life < 90 && (c.life >> 3) % 2) return;
  ctx.save();
  ctx.translate(c.x + 9, c.y + 9);
  ctx.rotate(Math.sin(t * 0.05 + c.x) * 0.5);
  ctx.shadowColor = c.soul ? '#a5f3fc' : '#e879f9'; ctx.shadowBlur = 16;
  if (c.soul) {                                  // a ghost's soul wisp
    inkOval(0, 0, 6, 6, '#cffafe', 1.2);
    ctx.fillStyle = 'rgba(165,243,252,0.6)';
    ctx.beginPath(); ctx.moveTo(-4, 3); ctx.quadraticCurveTo(-2, 12 + Math.sin(t * 0.3) * 2, 2, 14); ctx.quadraticCurveTo(3, 8, 4, 3); ctx.fill();
  } else {
    inkPoly([[0, -10], [7, -1], [0, 10], [-7, -1]], '#c026d3', 1.4);
    inkPoly([[0, -10], [7, -1], [0, -1]], '#f5d0fe', 0);
  }
  ctx.restore();
}

function drawHexBolt(b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  g.addColorStop(0, rgba(b.color, 0.8)); g.addColorStop(1, rgba(b.color, 0));
  ctx.fillStyle = g; ctx.fillRect(-16, -16, 32, 32);
  ctx.rotate(t * 0.15);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, r = i % 2 ? 3 : 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
