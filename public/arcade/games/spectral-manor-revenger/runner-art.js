// ============================================================
// REVENGER — runner art: the mothership interior, pods, monsters, the
// Spaceman and Plumbmonkey from the Hero Kit, the runner HUD, and the
// mothership exterior seen from the ship.
// ============================================================

const runArt = {};
function runLayers(kind) {
  if (runArt[kind]) return runArt[kind];
  const core = kind === 'core';
  const far = mkCanvas(W, H), f = far.getContext('2d');
  const g = f.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, core ? '#12030a' : '#07031a'); g.addColorStop(1, core ? '#3a0a1e' : '#1b0b3a');
  f.fillStyle = g; f.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) {                       // fractured viewports onto the Rift
    const x = 40 + i * 160, y = 190;
    f.save(); f.translate(x, y);
    f.fillStyle = '#05010c'; f.fillRect(-4, -4, 108, 128);
    const sky = f.createLinearGradient(0, 0, 100, 120);
    sky.addColorStop(0, core ? '#ff5577' : '#ff7ad9'); sky.addColorStop(1, core ? '#40061a' : '#22d3ee');
    f.globalAlpha = 0.35; f.fillStyle = sky; f.fillRect(0, 0, 100, 120); f.globalAlpha = 1;
    f.strokeStyle = 'rgba(165,243,252,0.35)'; f.lineWidth = 1.2;
    f.beginPath(); f.moveTo(20, 0); f.lineTo(46, 52); f.lineTo(30, 120); f.moveTo(46, 52); f.lineTo(100, 70); f.stroke();
    f.restore();
  }
  const mid = mkCanvas(480, H), m = mid.getContext('2d');
  m.fillStyle = core ? '#1e0712' : '#120a26';
  m.fillRect(0, 0, 480, CEIL_Y);
  for (let i = 0; i < 6; i++) { m.fillStyle = core ? '#2e0b1c' : '#1d1238'; m.fillRect(i * 80 + 6, CEIL_Y - 30, 68, 30); }
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 160;
    m.fillStyle = core ? 'rgba(46,11,28,0.9)' : 'rgba(29,18,56,0.9)';
    m.fillRect(x, CEIL_Y, 26, FLOOR_Y - CEIL_Y);
    m.fillStyle = core ? '#ff4d6d' : '#67e8f9';
    for (let k = 0; k < 5; k++) { m.globalAlpha = 0.5; m.fillRect(x + 10, CEIL_Y + 30 + k * 60, 6, 22); }
    m.globalAlpha = 1;
  }
  const glow = m.createLinearGradient(0, CEIL_Y, 0, CEIL_Y + 40);
  glow.addColorStop(0, core ? 'rgba(255,77,109,0.35)' : 'rgba(192,132,252,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = glow; m.fillRect(0, CEIL_Y, 480, 40);
  return (runArt[kind] = { far, mid });
}

function drawRunner(c, r) {
  const L = runLayers(r.kind), cam = r.camX, sx = x => x - cam;
  c.drawImage(L.far, -((cam * 0.2) % W), 0);
  c.drawImage(L.far, W - ((cam * 0.2) % W), 0);
  for (let k = -((cam * 0.5) % 480); k < W; k += 480) c.drawImage(L.mid, k, 0);
  const pitGlow = c.createLinearGradient(0, FLOOR_Y, 0, H);
  pitGlow.addColorStop(0, 'rgba(0,0,0,0.9)'); pitGlow.addColorStop(1, r.kind === 'core' ? 'rgba(255,77,109,0.35)' : 'rgba(34,211,238,0.3)');
  c.fillStyle = pitGlow; c.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

  if (r.kind === 'core') drawReactor(c, r);
  if (r.kind === 'rescue') drawExit(c, sx(r.exitX));

  // decks, blocks and platforms
  r.solids.forEach(s => {
    const x = sx(s.x);
    if (x > W || x + s.w < 0) return;
    const h = Math.min(s.h, H - s.y);
    c.fillStyle = s.h <= 16 ? '#3b2f5c' : '#241a3d'; c.fillRect(x, s.y, s.w, h);
    c.fillStyle = '#6d5a9e'; c.fillRect(x, s.y, s.w, 4);
    c.fillStyle = '#120b1e'; c.fillRect(x, s.y + 4, s.w, 2);
    for (let px = 24; px < s.w - 8; px += 48) { c.fillStyle = '#1a1230'; c.fillRect(x + px, s.y + 12, 2, Math.min(h - 16, 40)); }
    if (s.h <= 16) drawGlow(c, '#c084fc', x + s.w / 2, s.y + 18, 30, 0.35);
    c.fillStyle = '#fbbf24';
    for (const ex of [x + 2, x + s.w - 8]) for (let k = 0; k < 2; k++) c.fillRect(ex, s.y + 8 + k * 7, 6, 3);
  });

  // laser gates
  r.gates.forEach(g => {
    const x = sx(g.x); if (x < -30 || x > W + 30) return;
    const live = gateLive(r, g);
    const ph = g.kind === 'pulse' ? (r.t + g.off0) % g.period : 0;
    const warn = g.kind === 'pulse' && !live && g.period - ph < 24;
    c.fillStyle = '#4b5563';
    if (g.kind !== 'high') c.fillRect(x - 9, g.y0 - 8, 18, 12);
    if (g.kind !== 'low') c.fillRect(x - 9, g.y1 - 4, 18, 8);
    if (live || warn) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const a = live ? 0.9 + Math.sin(r.t * 0.6) * 0.1 : (Math.floor(r.t / 3) % 2 ? 0.35 : 0.1);
      const col = g.kind === 'pulse' ? '255,77,109' : g.kind === 'low' ? '251,146,60' : '250,204,21';
      const grad = c.createLinearGradient(x - 8, 0, x + 8, 0);
      grad.addColorStop(0, `rgba(${col},0)`); grad.addColorStop(0.5, `rgba(${col},${a})`); grad.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = grad; c.fillRect(x - 8, g.y0, 16, g.y1 - g.y0);
      c.fillStyle = `rgba(255,255,255,${a * 0.9})`; c.fillRect(x - 1, g.y0, 2, g.y1 - g.y0);
      c.restore();
    }
  });

  // stasis pods
  r.pods.forEach(pd => {
    const x = sx(pd.x); if (x < -60 || x > W + 60) return;
    c.fillStyle = '#374151'; c.fillRect(x - 26, pd.y - 10, 52, 10); c.fillRect(x - 22, pd.y - 84, 44, 10);
    if (!pd.open) {
      const liquid = c.createLinearGradient(0, pd.y - 74, 0, pd.y - 10);
      liquid.addColorStop(0, 'rgba(103,232,249,0.35)'); liquid.addColorStop(1, 'rgba(34,211,238,0.6)');
      c.fillStyle = liquid; c.fillRect(x - 20, pd.y - 74, 40, 64);
      drawPodFan(c, x - 7, pd.y - 14, pd.look, r.t, 0.8);
      drawPodFan(c, x + 8, pd.y - 16, pd.look + 3, r.t + 40, 0.8);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; c.strokeRect(x - 20, pd.y - 74, 40, 64);
      c.strokeStyle = 'rgba(15,23,42,0.9)'; c.lineWidth = 1.2;
      if (pd.hp <= 2) { c.beginPath(); c.moveTo(x - 12, pd.y - 70); c.lineTo(x - 2, pd.y - 50); c.lineTo(x - 10, pd.y - 34); c.stroke(); }
      if (pd.hp <= 1) { c.beginPath(); c.moveTo(x + 14, pd.y - 66); c.lineTo(x + 4, pd.y - 44); c.lineTo(x + 16, pd.y - 22); c.stroke(); }
      if (pd.flash) drawGlow(c, '#ffffff', x, pd.y - 42, 40, pd.flash / 6);
    } else {
      const k = Math.min(1, (r.t - (pd.openT || 0)) / 70);
      c.fillStyle = 'rgba(148,163,184,0.5)';
      c.beginPath(); c.moveTo(x - 20, pd.y - 10); c.lineTo(x - 20, pd.y - 30); c.lineTo(x - 10, pd.y - 20); c.lineTo(x, pd.y - 34); c.lineTo(x + 8, pd.y - 18); c.lineTo(x + 20, pd.y - 28); c.lineTo(x + 20, pd.y - 10); c.fill();
      if (k < 1) {
        c.globalAlpha = 1 - k;
        drawPodFan(c, x - 7 - k * 20, pd.y - 14 - k * 70, pd.look, r.t, 0.8);
        drawPodFan(c, x + 8 + k * 20, pd.y - 16 - k * 80, pd.look + 3, r.t, 0.8);
        drawGlow(c, '#a5f3fc', x, pd.y - 50 - k * 60, 30, 1 - k);
        c.globalAlpha = 1;
      }
    }
  });

  r.hearts.forEach(h => {
    if (h.taken) return;
    const x = sx(h.x), y = h.y + Math.sin(r.t * 0.08) * 4;
    drawGlow(c, '#fb7185', x, y, 20, 0.6);
    c.fillStyle = '#fb7185'; c.strokeStyle = '#120b1e'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y + 8); c.bezierCurveTo(x - 14, y - 2, x - 6, y - 12, x, y - 4); c.bezierCurveTo(x + 6, y - 12, x + 14, y - 2, x, y + 8); c.fill(); c.stroke();
  });

  // monsters
  r.foes.forEach(f => {
    const x = sx(f.x); if (x < -80 || x > W + 80) return;
    c.save();
    c.translate(x, f.y);
    c.scale(f.face, 1);
    if (f.kind === 'mutant') { const spr = ENEMY_ART.mutant(Math.floor(f.t / 8) % 4); c.drawImage(spr, -28, -46); }
    else if (typeof SpriteKit !== 'undefined') {
      const crouch = f.kind === 'werewolf' && f.state === 'crouch' ? 0.85 : 1;
      c.scale(1, crouch);
      SpriteKit.draw(c, f.kind, 0, -21, { t: f.t / 60, scale: 0.8, stomp: f.kind === 'frank' ? Math.sin(f.t * 0.15) : 0 });
    }
    c.restore();
    if (f.kind === 'werewolf' && f.state === 'crouch') { c.fillStyle = '#fde047'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('!', x, f.y - 76); }
    if (f.flash) drawGlow(c, '#ffffff', x, f.y - FOE[f.kind].h / 2, 36, f.flash / 6);
  });

  if (r.boss) drawPM(c, r, r.boss);

  // hazards and shots
  c.save(); c.globalCompositeOperation = 'lighter';
  r.waves.forEach(w => {
    const x = sx(w.x);
    const g2 = c.createRadialGradient(x, FLOOR_Y, 2, x, FLOOR_Y, 34);
    g2.addColorStop(0, 'rgba(255,255,255,0.9)'); g2.addColorStop(0.5, 'rgba(185,150,224,0.7)'); g2.addColorStop(1, 'rgba(185,150,224,0)');
    c.fillStyle = g2; c.beginPath(); c.ellipse(x, FLOOR_Y, 20, 32, 0, Math.PI, 0); c.fill();
  });
  r.bolts.forEach(b => {
    const x = sx(b.x);
    const g3 = c.createLinearGradient(x - b.vx * 2, 0, x, 0);
    g3.addColorStop(0, 'rgba(103,232,249,0)'); g3.addColorStop(1, 'rgba(165,243,252,0.95)');
    c.strokeStyle = g3; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - b.vx * 2, b.y); c.lineTo(x, b.y); c.stroke();
    drawGlow(c, '#a5f3fc', x, b.y, 10, 0.9);
  });
  r.shots.forEach(s => { drawGlow(c, '#4ade80', sx(s.x), s.y, 16, 0.8); });
  c.restore();
  r.shots.forEach(s => {
    const x = sx(s.x);
    c.fillStyle = '#86efac'; c.strokeStyle = '#120b1e'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, s.y, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#a16207'; c.fillRect(x - 2, s.y - 11, 4, 5);
  });
  r.barrels.forEach(b => {
    const x = sx(b.x);
    c.save(); c.translate(x, b.y); c.rotate(b.rot);
    c.fillStyle = '#b91c1c'; c.strokeStyle = '#120b1e'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#f5f5f4'; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a4ca0'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PM', 0, 1);
    c.restore();
  });

  drawRunnerHero(c, r);
  FX.draw(c, sx);
}

function drawPodFan(c, x, feet, look, t, s) {
  const [shirt, hair] = FAN_LOOKS[((look % 6) + 6) % 6];
  const bob = Math.sin(t * 0.05) * 1.5;
  c.save(); c.translate(x, feet + bob); c.scale(s, s);
  c.fillStyle = '#1e293b'; c.fillRect(-3, -9, 2, 9); c.fillRect(1, -9, 2, 9);
  c.fillStyle = shirt; c.fillRect(-4, -19, 8, 10);
  c.fillStyle = '#e8c39e'; c.beginPath(); c.arc(0, -23, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = hair; c.beginPath(); c.arc(0, -24.5, 4, Math.PI, 0); c.fill();
  c.restore();
}

function drawExit(c, x) {
  if (x < -120 || x > W + 120) return;
  c.fillStyle = '#1f2937'; c.fillRect(x - 40, FLOOR_Y - 130, 80, 130);
  const g = c.createLinearGradient(0, FLOOR_Y - 120, 0, FLOOR_Y);
  g.addColorStop(0, 'rgba(134,239,172,0.9)'); g.addColorStop(1, 'rgba(34,197,94,0.3)');
  c.fillStyle = g; c.fillRect(x - 30, FLOOR_Y - 120, 60, 120);
  drawGlow(c, '#86efac', x, FLOOR_Y - 60, 80, 0.5);
  c.fillStyle = '#052e16'; c.font = 'bold 16px "Segoe UI", sans-serif'; c.textAlign = 'center';
  c.fillText('EXIT', x, FLOOR_Y - 60);
}

function drawReactor(c, r) {
  const x = r.arenaX + W / 2 - r.camX;
  if (x < -300 || x > W + 300) return;
  const pulse = 0.6 + Math.sin(r.t * 0.06) * 0.25;
  drawGlow(c, '#ff4d6d', x, 290, 150, pulse * 0.6);
  c.strokeStyle = '#f472b6'; c.lineWidth = 6;
  c.beginPath(); c.arc(x, 290, 110, 0, Math.PI * 2); c.stroke();
  c.save(); c.translate(x, 290); c.rotate(r.t * 0.01);
  for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillStyle = '#3b0a1e'; c.fillRect(96, -10, 28, 20); }
  c.restore();
  drawGlow(c, '#ffffff', x, 290, 40, pulse);
}

function drawPM(c, r, b) {
  const x = b.x - r.camX;
  const map = { intro: 'horns', idle: 'idle', throw: 'throw', command: 'command', stomp: 'stomp', taunt: 'taunt', dizzy: 'dizzy', defeat: 'defeat' };
  const pose = map[b.state] || 'idle';
  let phase = r.t * 0.22;
  if (b.state === 'throw') phase = Math.min(1, b.t / 60) * Math.PI * 2;
  if (b.state === 'stomp') phase = b.y < FLOOR_Y - 2 ? Math.PI / 2 : Math.PI * 1.5;
  if (b.state === 'defeat') phase = Math.min(Math.PI, (180 - b.dying) / 40);
  if (pmOpen(b)) drawGlow(c, '#f0abfc', x, b.y - 60, 90, 0.35 + Math.sin(r.t * 0.3) * 0.15);
  if (typeof HeroKit !== 'undefined') HeroKit.plumbmonkey(c, x, b.y, { pose, phase, face: b.face, scale: 1.05, rage: pmRage(b) });
  if (b.state === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const a = r.t * 0.12 + (i * Math.PI * 2) / 3;
      c.fillStyle = '#fde68a'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
      c.fillText('★', x + Math.cos(a) * 26, b.y - 128 + Math.sin(a) * 8);
    }
  }
  if (b.flash) drawGlow(c, '#ffffff', x, b.y - 60, 70, b.flash / 8);
}

function drawRunnerHero(c, r) {
  const p = r.p;
  if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 && !r.result) return;
  if (typeof HeroKit === 'undefined') return;
  const moving = Math.abs(p.vx) > 0.6, shooting = p.shootT > 0;
  let pose = 'idle', n = 4, i = Math.floor(r.t / 12) % 4;
  if (p.inv > 60) { pose = 'hurt'; n = 1; i = 0; }
  else if (p.slideT > 0) { pose = 'slide'; n = 1; i = 0; }
  else if (p.duck) { pose = 'duck'; n = 1; i = 0; }
  else if (!p.ground) { pose = shooting ? 'airShoot' : p.vy < 0 ? 'jump' : 'fall'; n = 1; i = 0; }
  else if (moving) { pose = shooting ? 'runShoot' : 'run'; n = 8; i = Math.floor(p.dist / 9) % 8; }
  else if (p.land > 0) { pose = 'land'; n = 1; i = 0; }
  else if (shooting) { pose = 'shoot'; n = 1; i = 0; }
  if (r.result === 'success' && r.phaseT < 100) { pose = 'victory'; n = 2; i = Math.floor(r.t / 15) % 2; }
  const cv = HeroKit.frames('spaceman', pose, n)[i];
  HeroKit.blit(c, cv, p.x - r.camX, p.y, p.face);
  if (p.shootT > 10) {
    const low = p.slideT > 0 || p.duck;
    drawGlow(c, '#a5f3fc', p.x - r.camX + p.face * 24, p.y - (low ? 16 : 36), 16, 0.9);
  }
}

function drawRunnerHUD(c, r) {
  const g = c.createLinearGradient(0, 0, 0, 46);
  g.addColorStop(0, 'rgba(7,3,15,0.95)'); g.addColorStop(1, 'rgba(7,3,15,0.65)');
  c.fillStyle = g; c.fillRect(0, 0, W, 46);
  c.textBaseline = 'alphabetic';
  c.font = 'bold 18px "Segoe UI", sans-serif'; c.textAlign = 'left'; c.fillStyle = '#f5f3ff';
  c.fillText(String(score).padStart(7, '0'), 12, 22);
  for (let i = 0; i < RUN_HP; i++) {
    c.fillStyle = i < r.p.hp ? '#fb7185' : 'rgba(148,163,184,0.3)';
    c.font = 'bold 16px sans-serif'; c.fillText('♥', 12 + i * 20, 40);
  }
  c.fillStyle = '#86efac'; c.font = 'bold 12px "Segoe UI", sans-serif';
  c.fillText(`SHIPS ${lives}`, 80, 38);
  for (let i = 0; i < ship.bombs; i++) { c.fillStyle = '#f472b6'; c.fillText('♪', 140 + i * 12, 38); }
  c.textAlign = 'center';
  if (!r.boss) {
    const secs = Math.ceil(r.timer / 60);
    c.fillStyle = secs <= 15 && Math.floor(r.t / 15) % 2 ? '#f87171' : '#f5f3ff';
    c.font = 'bold 22px "Segoe UI", sans-serif';
    c.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, 28);
  } else if (!r.boss.dying) {
    const bw = 360, bx = W / 2 - bw / 2;
    c.fillStyle = 'rgba(15,8,28,0.8)'; c.fillRect(bx, 14, bw, 10);
    c.fillStyle = pmRage(r.boss) ? '#ff4d6d' : '#b996e0'; c.fillRect(bx, 14, bw * (r.boss.hp / r.boss.maxHp), 10);
    c.font = 'bold 11px "Segoe UI", sans-serif'; c.fillStyle = '#f5f3ff';
    c.fillText(pmOpen(r.boss) ? 'PLUMBMONKEY · HIT HIM NOW!' : 'PLUMBMONKEY', W / 2, 38);
  }
  c.textAlign = 'right'; c.font = 'bold 13px "Segoe UI", sans-serif';
  if (r.kind === 'rescue') { c.fillStyle = '#67e8f9'; c.fillText(`FANS FREED ${r.freed} / ${r.podsTotal * 2}`, W - 12, 20); }
  c.fillStyle = r.kind === 'core' ? '#ff8fab' : '#c084fc';
  c.fillText(r.kind === 'core' ? 'THE CORE' : 'INSIDE THE MOTHERSHIP', W - 12, 38);
}

function runnerBanner(r) {
  if (r.phase === 'intro') return r.kind === 'core'
    ? { text: 'THE CORE', sub: 'Plumbmonkey waits at the heart of the invasion', a: Math.min(1, r.phaseT / 20) }
    : { text: 'INSIDE THE MOTHERSHIP', sub: 'break the stasis pods · reach the exit before time runs out', a: Math.min(1, r.phaseT / 20) };
  if (r.phase === 'result') return { text: r.result === 'success' ? (r.kind === 'core' ? 'INVASION REPELLED' : 'RESCUE COMPLETE') : r.why,
    sub: r.result === 'success' ? r.why : (r.kind === 'core' ? 'try the core again' : 'the Rift persists'), a: Math.min(1, (120 - r.phaseT) / 15) };
  return null;
}

// ---------- the mothership, seen from the ship ----------
function drawMothership(c, m, sx) {
  if (sx < -300 || sx > W + 300) return;
  const y = m.y, t = tick;
  c.save();
  c.translate(sx, y + Math.sin(t * 0.02) * 4);
  c.lineJoin = 'round';
  drawGlow(c, m.finale ? '#ff4d6d' : '#c084fc', 0, 0, 230, 0.25);
  c.fillStyle = '#1a1030'; c.strokeStyle = '#120b1e'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-210, 10); c.lineTo(-120, -30); c.lineTo(120, -30); c.lineTo(210, 10); c.lineTo(130, 40); c.lineTo(-130, 40); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#2b1b4d'; c.beginPath(); c.ellipse(0, -30, 90, 46, 0, Math.PI, 0); c.fill(); c.stroke();
  for (let i = 0; i < 14; i++) {
    const on = (Math.floor(t / 5) + i) % 4 === 0;
    c.fillStyle = on ? (m.finale ? '#ff4d6d' : '#f0abfc') : '#3b2466';
    c.beginPath(); c.arc(-182 + i * 28, 12, 4, 0, Math.PI * 2); c.fill();
  }
  if (m.finale) {
    c.fillStyle = '#7a4ca0'; c.beginPath(); c.arc(0, -46, 20, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0b0b0e'; c.fillRect(-14, -52, 28, 7);
  }
  const pulse = 0.6 + Math.sin(t * 0.15) * 0.3;
  c.fillStyle = '#05010c'; c.fillRect(-46, 26, 92, 34);
  c.save(); c.globalCompositeOperation = 'lighter';
  const bay = c.createLinearGradient(0, 26, 0, 60);
  bay.addColorStop(0, `rgba(103,232,249,${pulse})`); bay.addColorStop(1, 'rgba(103,232,249,0.1)');
  c.fillStyle = bay; c.fillRect(-42, 30, 84, 30);
  for (let k = 0; k < 3; k++) {
    const a = ((t * 0.04 + k / 3) % 1);
    c.strokeStyle = `rgba(165,243,252,${1 - a})`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-14, 90 + a * 50); c.lineTo(0, 76 + a * 50); c.lineTo(14, 90 + a * 50); c.stroke();
  }
  c.restore();
  c.fillStyle = '#a5f3fc'; c.font = 'bold 12px "Segoe UI", sans-serif'; c.textAlign = 'center';
  c.fillText(m.finale ? 'COMMAND SHIP' : 'DOCK HERE', 0, 150);
  c.restore();
}
