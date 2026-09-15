// ============================================================
// SWARM — the draw pass
// 1 floor, scorches, graves, atmosphere     (the ground)
// 2 props + characters, depth-sorted        (the world)
// 3 darkness with a light pool on the hero
// 4 the LIGHT layer, additive: lasers, lance, plasma, flashes, impacts,
//   embers, lightning — drawn over the darkness so they light it up
// 5 UI
// ============================================================

function draw() {
  const t = tick;
  ctx.save();
  if (shakeTime > 0) ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);

  drawArenaFloor(arenaIdx);
  drawScorches(scorches);
  drawAtmosphere(arenaIdx, t);
  graves.forEach(g => drawGrave(g, t));
  strikes.forEach(s => { if (s.state === 'warn') drawStrikeWarn(s, t); });

  drops.forEach(d => {
    const y = d.y + 11 + Math.sin(d.bob) * 3;
    const fade = d.life < 120 && (d.life >> 3) % 2 ? 0.35 : 1;
    ctx.globalAlpha = fade;
    withLight(() => glow(d.x + 11, y, 30, d.color, 0.6));
    ctx.strokeStyle = d.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(d.x + 11, y, 12, t * 0.05, t * 0.05 + 4.6); ctx.stroke();
    ctx.fillStyle = 'rgba(10,6,18,0.85)';
    ctx.beginPath(); ctx.arc(d.x + 11, y, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d.color; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.label, d.x + 11, y);
    ctx.globalAlpha = 1;
  });
  ctx.textBaseline = 'alphabetic';

  // ---- depth-sorted world ----
  const beat = (Math.sin(t * 0.21) + 1) / 2;
  const items = [];
  obstacles.forEach(o => items.push({ y: o.y + o.h, d: () => drawObstacle(o, t, beat) }));
  fans.forEach(f => items.push({ y: f.y + f.h, d: () => drawFan(f) }));
  monsters.forEach(m => items.push({ y: m.y + m.h, d: () => drawMonster(m, t) }));
  bosses.forEach(b => items.push({ y: b.y, d: () => drawBoss(b, t) }));
  if (gameRunning || gameOver) items.push({ y: player.y + player.h, d: () => drawHero(player, t) });
  items.sort((a, b) => a.y - b.y).forEach(i => i.d());
  drawShockRings(shockRings);

  // ---- darkness, then light ----
  const pc = heroFeet(player);
  drawDarkness(pc.x, pc.y - 26, arenaIdx, flash);
  withLight(() => {
    monsters.forEach(m => glow(m.x + m.w / 2, m.y + m.h / 2 - 6, 26 * m.size, m.color, m.hitFlash > 0 ? 0.8 : 0.22));
    fans.forEach(f => { if (f.grabbed) glow(f.x + f.w / 2, f.y + f.h / 2, 18, '#fbbf24', 0.5); });
    graves.forEach(g => { if (g.state === 'crack') glow(g.x, g.y, 40, '#4ade80', 1 - g.t / GRAVE_CRACK); });
    obstacles.forEach(o => { if (o.pulse && o.pulse.phase === 'warn') glow(o.x + o.w / 2, o.y + o.h / 2, 60, '#f472b6', 1 - o.pulse.t / SPEAKER_WARN); });
  });
  drawLasers(bullets, t);
  drawLance(lance, t);
  drawPlasma(enemyBolts, t);
  drawMuzzleFlashes(muzzles);
  drawImpacts(impacts);
  drawParticles(particles);
  strikes.forEach(s => { if (s.state === 'bolt') drawStrikeBolt(s); });

  // monster tells on top of the dark so they are never missed
  monsters.forEach(m => {
    const cx = m.x + m.w / 2, cy = m.y + m.h / 2 - 6;
    if (m.boltCharge > 0) {
      const charge = 1 - m.boltCharge / (m.type === 'archon' ? 42 : 32);
      withLight(() => glow(cx, cy, 20 + charge * 30, m.color, charge));
      ctx.strokeStyle = rgba(m.color, 0.35 + charge * 0.65); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, (12 + charge * 12) * m.size, 0, Math.PI * 2); ctx.stroke();
    }
    if (m.lunge && m.lunge.phase === 'crouch') {
      ctx.fillStyle = '#fb923c'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', cx, m.y - 18 + Math.sin(t * 0.7) * 2);
    }
  });

  // no reticle or sight line: the rifle in the hero's hands shows the aim
  ctx.restore();

  // ---- UI ----
  if (gameRunning || gameOver) {
    ctx.textAlign = 'left'; ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(233,213,255,0.8)';
    ctx.fillText(`${ARENAS[arenaIdx].name} · WAVE ${wave}`, 14, H - 12);
    // dash readiness pip
    const ready = player.dashCd <= 0;
    ctx.fillStyle = ready ? '#67e8f9' : 'rgba(103,232,249,0.25)';
    ctx.fillRect(14, H - 40, 44 * (1 - player.dashCd / DASH_CD), 5);
    ctx.fillStyle = ready ? '#67e8f9' : 'rgba(233,213,255,0.5)';
    ctx.fillText('DASH', 62, H - 35);
  }
  bosses.forEach((b, i) => {
    if (b.state === 'enter') return;
    const w = 320, x = W / 2 - w / 2, y = 12 + i * 30;
    ctx.fillStyle = 'rgba(10,6,18,0.8)'; ctx.fillRect(x - 3, y - 3, w + 6, 15);
    ctx.fillStyle = '#3b0764'; ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = b.type === 'golem' ? '#4ade80' : '#f472b6'; ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 9);
    ctx.fillStyle = '#f5f3ff'; ctx.font = 'bold 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(b.name, W / 2, y + 22);
  });
  if (gameRunning && comboMult() > 1) {
    ctx.save();
    ctx.fillStyle = '#f0abfc'; ctx.shadowColor = '#f0abfc'; ctx.shadowBlur = 12;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('COMBO ×' + comboMult(), W / 2, bosses.length ? 44 + bosses.length * 30 : 44);
    ctx.restore();
  }
  if (gameRunning && (player.powerType || player.shieldT > 0)) {
    const type = player.shieldT > 0 && !player.powerType ? 'shield' : player.powerType;
    const def = DROP_TYPES.find(d => d.type === type);
    const frac = type === 'shield' ? player.shieldT / 420 : player.powerTime / 480;
    ctx.save();
    ctx.fillStyle = def.color; ctx.textAlign = 'right'; ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillText(def.label, W - 14, H - 24);
    ctx.fillRect(W - 94, H - 16, 80 * frac, 4);
    ctx.restore();
  }

  if (arenaFade > 0) { ctx.fillStyle = `rgba(4,2,10,${arenaFade / 40})`; ctx.fillRect(0, 0, W, H); }
  if (waveDelay > 0 && waveDelay < 40 && (wave - 1) % WAVES_PER_ARENA === 0) { ctx.fillStyle = `rgba(4,2,10,${1 - waveDelay / 40})`; ctx.fillRect(0, 0, W, H); }

  const banner = (title, sub, alpha) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(7,4,15,0.5)'; ctx.fillRect(0, H / 2 - 58, W, 96);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9d5ff'; ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 26;
    ctx.font = 'bold 46px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 6);
    ctx.shadowBlur = 0;
    if (sub) { ctx.fillStyle = '#f0abfc'; ctx.font = '600 17px "Segoe UI", system-ui, sans-serif'; ctx.fillText(sub, W / 2, H / 2 + 24); }
    ctx.restore();
  };
  if (ending) banner('GAME OVER', `${saved} fans saved · wave ${wave}`, (ENDING_FRAMES - ending) / 30);
  else if (bannerTime > 0) banner(bannerText, bannerSub, bannerTime / 18);

  TouchPad.draw(ctx);
}

function drawFan(f) {
  ctx.save();
  ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
  if (f.panic > 0 || f.grabbed) ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, f.h / 2 + 2, 8 * f.scale, 3, 0, 0, Math.PI * 2); ctx.fill();
  SpriteKit.draw(ctx, 'fan', 0, 0, {
    variant: f.type, color: f.color, S: f.scale, phase: f.walkPhase || 0, t: tick / 60,
    moving: f.moving, grabbed: f.grabbed, panic: f.panic > 0,
    hair: ['#1e1b4b', '#4c1d95', '#831843', '#0f172a'][Math.floor(f.x) % 4]
  });
  ctx.restore();
}

function drawMonster(m, t) {
  ctx.save();
  ctx.translate(m.x + m.w / 2, m.y + m.h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, m.h / 2 + 3, 12 * m.size, 4 * m.size, 0, 0, Math.PI * 2); ctx.fill();
  if (m.lunge && m.lunge.phase === 'crouch') ctx.scale(1.12, 0.86);
  const wraith = m.type === 'specter' || m.type === 'archon';
  const drew = SpriteKit.draw(ctx, wraith ? 'wraith' : m.type, 0, 0, {
    variant: m.type, color: m.color, S: m.size,
    stride: Math.sin(m.walkPhase || 0) * 5 * m.size, phase: m.walkPhase || 0
  });
  if (!drew) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(0, 0, 12 * m.size, 0, Math.PI * 2); ctx.fill(); }
  if (m.maxHp > 1) {
    ctx.fillStyle = 'rgba(15,10,26,0.85)'; ctx.fillRect(-13, 20 * m.size, 26, 4);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-12, 20 * m.size + 1, 24 * (m.hp / m.maxHp), 2.5);
  }
  ctx.restore();
}
