// ============================================================
// SOUL CIRCUIT — draw pass: maze, props, actors, darkness, HUD band, overlays
// World space is maze space (0..MW × 0..MH), placed at (OX, OY) on the canvas.
// ============================================================

const DARK = makeCanvas(MW, MH);
let motes = [];

function draw() {
  const t = tick, R = REALMS[realmOf(level)];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = '#07040f'; ctx.fillRect(0, 0, W, H);
  if (!maze) return;

  ctx.save();
  const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeMag : 0, sy = shakeT > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  ctx.translate(OX + sx, OY + sy);
  ctx.beginPath(); ctx.rect(-OX, 0, W, MH); ctx.clip();

  if (art) ctx.drawImage(art, 0, 0); else drawFallbackMaze();
  drawTorches(t);
  drawGate(t);
  drawPortals(t);
  drawPuddles(t);
  drawHands(t);
  drawGems(t);
  drawExit(t);
  if (relic) drawRelic(ctx, relic.kind, (relic.c + 0.5) * CELL, (relic.r + 0.5) * CELL, t);
  pickups.forEach(p => drawPickup(ctx, p, t));
  const dark = R.hazard === 'dark';
  if (boss && !dark) drawBossFx(ctx, boss, t);

  hunters.filter(m => m.type !== 'ghost').forEach(m => drawHunter(ctx, m, m.x, m.y, t));
  drawPlayer(t);
  hunters.filter(m => m.type === 'ghost').forEach(m => drawHunter(ctx, m, m.x, m.y, t));
  if (boss) drawBoss(ctx, boss, t);

  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  drawMotes(R, t);
  if (dark) { drawDarkness(t); if (boss) drawBossFx(ctx, boss, t); }

  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHudBand(R, t);
  drawOverlays(R, t);
}

function drawFallbackMaze() {
  ctx.fillStyle = REALMS[realmOf(level)].wall.top;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === WALL) ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
}

function flame(x, y, t, s = 1) {
  const f = Math.sin(t * 0.35 + x) * 1.2;
  ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#f97316';
  ctx.beginPath(); ctx.ellipse(x, y, 3 * s, (5 + f) * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.ellipse(x, y + 1.5 * s, 1.4 * s, (2.6 + f * 0.5) * s, 0, 0, Math.PI * 2); ctx.fill();
}

function drawTorches(t) {
  maze.torches.forEach(q => {
    const x = (q.c + 0.5) * CELL, y = q.r * CELL + CELL - 8;
    ctx.fillStyle = '#3f2a1c'; ctx.fillRect(x - 2, y, 4, 7);
    flame(x, y - 4, t);
  });
}

function drawGate(t) {
  const { r, c } = PEN.gate, x = c * CELL, y = r * CELL;
  const open = hunters.some(m => m.state === 'leaving' || m.state === 'entering');
  ctx.fillStyle = 'rgba(12,6,24,0.9)'; ctx.fillRect(x - CELL, y + 4, CELL * 3, CELL - 8);
  ctx.globalAlpha = open ? 0.25 : 1;
  ctx.fillStyle = '#7c3aed';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - CELL + 6 + i * 18, y + 3, 3, CELL - 6);
  ctx.fillStyle = '#a78bfa'; ctx.fillRect(x - CELL, y + 3, CELL * 3, 2.5); ctx.fillRect(x - CELL, y + CELL - 5.5, CELL * 3, 2.5);
  ctx.globalAlpha = 1;
  ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8 + Math.sin(t * 0.1) * 4;
  ctx.fillStyle = '#f0abfc'; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPortals(t) {
  const cols = ['#22d3ee', '#f472b6'];
  maze.portals.forEach((pair, i) => pair.forEach(q => {
    const x = (q.c + 0.5) * CELL, y = (q.r + 0.5) * CELL;
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = cols[i]; ctx.shadowBlur = 14;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = rgba(cols[i], 0.9 - k * 0.25); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 10 - k * 3, 10 - k * 3, 0, t * 0.08 * (k % 2 ? -1 : 1) + k, t * 0.08 * (k % 2 ? -1 : 1) + k + Math.PI * 1.4); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }));
}

function drawPuddles(t) {
  puddles.forEach(p => {
    const x = (p.c + 0.5) * CELL, y = (p.r + 0.5) * CELL, a = Math.min(1, p.t / 60);
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = '#4d7c0f'; ctx.beginPath(); ctx.ellipse(x, y + 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#86efac'; ctx.beginPath(); ctx.ellipse(x - 2, y + 2, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const b = (t * 0.05 + p.c) % 1;
    ctx.strokeStyle = '#d9f99d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + 4, y + 2 - b * 4, 1.5 + b, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function drawHands(t) {
  hands.forEach(h => {
    const x = (h.c + 0.5) * CELL, y = (h.r + 0.5) * CELL;
    if (h.state === 'warn') {
      const p = 1 - h.t / 70, j = Math.sin(t * 1.3) * p * 1.5;
      ctx.strokeStyle = `rgba(28,25,23,${0.5 + p * 0.5})`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + h.c; ctx.moveTo(x + j, y + 4); ctx.lineTo(x + j + Math.cos(a) * 11 * p, y + 4 + Math.sin(a) * 7 * p); }
      ctx.stroke();
      ctx.fillStyle = `rgba(239,68,68,${0.15 + 0.2 * Math.sin(t * 0.4) ** 2})`;
      ctx.fillRect(h.c * CELL + 1, h.r * CELL + 1, CELL - 2, CELL - 2);
    } else {
      const rise = Math.min(1, (45 - h.t) / 8);
      ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.ellipse(x, y + 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(x, y + 6); ctx.scale(1, rise);
      inkPath(ctx, [[-3, 0], [-3, -8], [-6, -14], [-4, -15], [-2, -11], [-1, -17], [1, -17], [1.5, -11], [3.5, -16], [5.5, -15], [3, -9], [6, -11], [7, -9], [3, -4], [3, 0]], '#e7e5e4', 1.3);
      ctx.restore();
    }
  });
}

function drawGems(t) {
  if (!gems) return;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const g = gems[r][c];
      if (!g) continue;
      const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
      if (g === 1) {
        if (GEM_SPRITE) ctx.drawImage(GEM_SPRITE, x - 11, y - 11);
        else { ctx.fillStyle = '#67e8f9'; ctx.fillRect(x - 3, y - 3, 6, 6); }
        if ((t + r * 37 + c * 53) % 150 < 8) {
          ctx.fillStyle = '#fff'; ctx.fillRect(x - 0.5, y - 6, 1, 5); ctx.fillRect(x - 2.5, y - 4, 5, 1);
        }
      } else {
        const s = 1 + Math.sin(t * 0.1 + r) * 0.12;
        if (POWER_SPRITE) ctx.drawImage(POWER_SPRITE, x - 20 * s, y - 20 * s, 40 * s, 40 * s);
        else { ctx.fillStyle = '#e879f9'; ctx.fillRect(x - 6, y - 6, 12, 12); }
      }
    }
  }
}

function drawExit(t) {
  if (!exitOpen || !exitCell) return;
  const { x, y } = centreOf(exitCell);
  const beat = 1 + Math.sin(exitPulse * 0.12) * 0.12, spin = exitPulse * 0.05;
  ctx.save(); ctx.translate(x, y);
  const ring = (exitPulse % 60) / 60;
  ctx.strokeStyle = `rgba(253,230,138,${1 - ring})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 14 + ring * 40, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 26;
  ctx.fillStyle = 'rgba(253,230,138,0.2)'; ctx.beginPath(); ctx.arc(0, 0, 16 * beat, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 11 * beat, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = spin + i * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 14 * beat, Math.sin(a) * 14 * beat); ctx.stroke();
  }
  ctx.fillStyle = '#fffbeb'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawPlayer(t) {
  if (dying > 0 || (gameOver && !gameRunning)) return;
  if (player.invuln > 0 && Math.floor(t / 4) % 2 === 0) return;
  const flashing = magicField > 0 && magicField < 120 && Math.floor(t / 6) % 2 === 0;
  const palette = magicField > 0 && !flashing ? 'field' : 'soul';
  if (speedBoost > 0 && t % 3 === 0 && (player.dir.x || player.dir.y)) {
    particles.push({ x: player.x - player.dir.x * 8, y: player.y - player.dir.y * 8 + (Math.random() - 0.5) * 8, vx: -player.dir.x * 0.5, vy: -player.dir.y * 0.5, life: 14, size: 1.8, color: '#fbbf24' });
  }
  drawSoul(ctx, player.x, player.y, { t, dir: player.dir, face: player.face, chomp: player.chomp, palette });
  if (magicField > 0) {
    ctx.strokeStyle = `rgba(232,121,249,${0.3 + Math.sin(t * 0.3) * 0.2})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(player.x, player.y, 20 + Math.sin(t * 0.3) * 3, 0, Math.PI * 2); ctx.stroke();
  }
}

/* Ambient life per realm: fireflies, drifting fog, aether sparks, dust. Purely
   visual, so it advances here rather than in update(). */
function drawMotes(R, t) {
  if (motes.realm !== R.key) { motes = []; motes.realm = R.key; }
  while (motes.length < 26) motes.push({ x: Math.random() * MW, y: Math.random() * MH, vx: (Math.random() - 0.5) * 0.3, vy: -0.05 - Math.random() * 0.2, ph: Math.random() * 6, life: 200 + Math.random() * 400 });
  motes.forEach(m => {
    m.x += m.vx + Math.sin(t * 0.02 + m.ph) * 0.2; m.y += m.vy; m.life--;
    const a = Math.min(1, m.life / 60) * (0.35 + 0.35 * Math.sin(t * 0.07 + m.ph));
    if (R.key === 'grave') {
      ctx.fillStyle = `rgba(203,213,225,${a * 0.12})`;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = rgba(R.mote, Math.max(0, a));
      ctx.fillRect(m.x, m.y, R.key === 'hedge' ? 2 : 1.5, R.key === 'hedge' ? 2 : 1.5);
    }
  });
  motes = Object.assign(motes.filter(m => m.life > 0 && m.y > -10), { realm: R.key });
}

/* The Catacombs: black except where light falls. The Soul carries a lantern
   glow, torches hold their own pools, and the hunters' eyes always show. */
function drawDarkness(t) {
  if (!DARK) return;
  const d = DARK.getContext('2d');
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, MW, MH);
  d.fillStyle = 'rgba(3,2,6,0.95)'; d.fillRect(0, 0, MW, MH);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, rad) => {
    const g = d.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g; d.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  if (dying === 0) hole(player.x, player.y, (lantern > 0 ? 190 : 115) + Math.sin(t * 0.2) * 4 + (magicField > 0 ? 30 : 0));
  maze.torches.forEach(q => hole((q.c + 0.5) * CELL, (q.r + 1) * CELL, 58 + Math.sin(t * 0.3 + q.c) * 4));
  if (exitOpen && exitCell) hole((exitCell.c + 0.5) * CELL, (exitCell.r + 0.5) * CELL, 60);
  pickups.forEach(p => hole(p.x, p.y, 26));
  d.globalCompositeOperation = 'source-over';
  ctx.drawImage(DARK, 0, 0);
  hunters.forEach(m => {
    if (m.state === 'pen') return;
    const col = m.scared ? '#93c5fd' : (HUNTER_COLORS[m.type] || '#fff');
    ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = col;
    ctx.fillRect(m.x - 3.5, m.y - 11, 2.5, 2); ctx.fillRect(m.x + 1.5, m.y - 11, 2.5, 2);
  });
  if (boss) { ctx.fillStyle = '#f43f5e'; ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 10; ctx.fillRect(boss.x - 4, boss.y - 23, 3, 2); ctx.fillRect(boss.x + 1.5, boss.y - 23, 3, 2); }
  ctx.shadowBlur = 0;
}

function drawHudBand(R, t) {
  const g = ctx.createLinearGradient(0, 0, 0, OY);
  g.addColorStop(0, '#120a22'); g.addColorStop(1, '#07040f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, OY);
  ctx.fillStyle = rgba(R.glow, 0.5); ctx.fillRect(0, OY - 1.5, W, 1.5);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '600 10px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#a78bfa';
  ctx.fillText('SCORE', 14, 12);
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#f3e8ff';
  ctx.fillText(String(score), 14, 26);
  const shown = Math.min(lives, 5);
  for (let i = 0; i < shown; i++) {
    ctx.save(); ctx.translate(130 + i * 20, 21); ctx.scale(0.62, 0.62);
    drawSoul(ctx, 0, 0, { t: 0, palette: 'soul' });
    ctx.restore();
  }
  if (lives > 5) { ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.fillStyle = '#e9d5ff'; ctx.fillText('×' + lives, 130 + 5 * 20, 21); }

  ctx.textAlign = 'center';
  if (boss) {
    const bw = 240, bx = W / 2 - bw / 2;
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#fef3c7';
    const hint = magicField > 0 ? ' — RAM IT NOW!' : ' — GRAB A POWER CRYSTAL';
    ctx.fillText(boss.name + hint, W / 2, 11);
    ctx.fillStyle = '#3b0764'; ctx.fillRect(bx, 20, bw, 8);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(bx, 20, bw * Math.max(0, boss.hp / boss.maxHp), 8);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(bx, 20, bw, 8);
  } else {
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = rgba(R.accent, 0.95);
    ctx.fillText(R.name, W / 2, 13);
    ctx.font = '600 10px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#c4b5fd';
    ctx.fillText(`LEVEL ${level} · ${stageOf(level) + 1} OF ${LEVELS_PER_REALM}${cycleOf(level) ? ' · CYCLE ' + (cycleOf(level) + 1) : ''}`, W / 2, 27);
  }

  ctx.textAlign = 'right';
  if (magicField > 0) {
    ctx.fillStyle = '#4a044e'; ctx.fillRect(W - 250, 14, 90, 8);
    ctx.fillStyle = magicField < 120 && Math.floor(t / 6) % 2 ? '#fdf4ff' : '#e879f9';
    ctx.fillRect(W - 250, 14, 90 * magicField / fieldMax, 8);
    ctx.font = '600 9px "Segoe UI", sans-serif'; ctx.fillStyle = '#f0abfc'; ctx.fillText('FIELD', W - 256, 18);
  }
  ctx.font = '600 10px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#67e8f9';
  ctx.fillText(boss ? 'BEST' : 'CRYSTALS', W - 14, 12);
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#ecfeff';
  ctx.fillText(String(boss ? Math.max(best, score) : gemsLeft), W - 14, 26);
  ctx.textBaseline = 'alphabetic';
}

function drawOverlays(R, t) {
  const cx = W / 2, cy = OY + MH / 2;
  if (levelFade > 0) { ctx.fillStyle = `rgba(5,3,12,${levelFade / 40})`; ctx.fillRect(0, OY, W, MH); }
  if (levelDelay > 0 && levelDelay < 40) { ctx.fillStyle = `rgba(5,3,12,${1 - levelDelay / 40})`; ctx.fillRect(0, OY, W, MH); }

  const banner = (title, sub, alpha, y = cy) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(5,3,12,0.55)'; ctx.fillRect(0, y - 52, W, 88);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9d5ff'; ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 24;
    ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(title, W / 2, y - 4);
    ctx.shadowBlur = 0;
    if (sub) { ctx.fillStyle = '#fde68a'; ctx.font = '600 16px "Segoe UI", system-ui, sans-serif'; ctx.fillText(sub, W / 2, y + 22); }
    ctx.restore();
  };

  if (ending) { banner('SOUL LOST', `level ${level} · ${R.name.toLowerCase()}`, (ENDING_FRAMES - ending) / 30); return; }
  if (!gameRunning) return;
  if (bannerTime > 0 && !ready) banner(bannerText, bannerSub, bannerTime / 18, OY + 150);
  if (ready > 0 && dying === 0 && !levelDelay) {
    if (bannerTime > 0) banner(bannerText, bannerSub, 1, OY + 150);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fde68a'; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 16;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.2);
    ctx.fillText('READY?', cx, OY + (START_CELL.r + 0.5) * CELL + 50);
    ctx.restore();
  }
  if (paused) {
    ctx.fillStyle = 'rgba(5,3,12,0.6)'; ctx.fillRect(0, OY, W, MH);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif'; ctx.fillText('PAUSED', cx, cy);
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#c4b5fd'; ctx.fillText('P / Esc to resume', cx, cy + 28);
  }
}
