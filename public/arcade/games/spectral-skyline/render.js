// ============================================================
// LUNO'S FLIGHT — draw pass and overlays
// ============================================================

function draw() {
  const t = tick;
  ctx.save();
  if (shakeTime > 0) ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);

  drawSky(stageIdx, t);
  if (bell) drawBell(bell, t);
  platforms.forEach(p => drawPlatform(p, t));
  drawGround(stageIdx, t);

  nests.forEach(n => { if (!n.taken) drawNest(n, t); });
  crystalPickups.forEach(c => drawCrystal(c, t));
  ghosts.forEach(g => drawGhost(g, t));
  witches.forEach(w => drawWitch(w, t));
  if (boss) drawBoss(boss, t);
  if (gameRunning || gameOver) drawLuno(player, t);
  witchBolts.forEach(b => drawHexBolt(b, t));

  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 25);
    if (p.feather) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  drawRings(rings);
  storms.forEach(s => drawStorm(s, t));
  ctx.restore();

  // ---- UI ----
  if (gameRunning || gameOver) {
    ctx.textAlign = 'left'; ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(233,213,255,0.85)';
    ctx.fillText(`${STAGES[stageIdx].name} · WAVE ${wave}`, 12, H - 12);
    ctx.fillStyle = player.diveCd <= 0 ? '#c4b5fd' : 'rgba(196,181,253,0.3)';
    ctx.fillText('↓ DIVE', 12, H - 28);
  }
  if (boss) {
    const w = 320, x = W / 2 - w / 2, y = 10;
    ctx.fillStyle = 'rgba(10,6,18,0.8)'; ctx.fillRect(x - 3, y - 3, w + 6, 15);
    ctx.fillStyle = '#3b0764'; ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 9);
    ctx.fillStyle = '#fef3c7'; ctx.font = 'bold 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    const hint = boss.type === 'gargoyle' && boss.state === 'stone' ? ' — STONE, WAIT FOR IT TO WAKE'
      : boss.type === 'shrieker' && boss.state === 'stunned' ? ' — STUNNED! HIT IT!'
        : boss.type === 'wyrm' ? ' — STRIKE THE HEAD' : '';
    ctx.fillText(boss.name + hint, W / 2, y + 22);
  }
  if (gameRunning && comboMult() > 1) {
    ctx.save();
    ctx.fillStyle = '#f0abfc'; ctx.shadowColor = '#f0abfc'; ctx.shadowBlur = 12;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('COMBO ×' + comboMult(), W / 2, boss ? 58 : 44);
    ctx.restore();
  }
  if (stageFade > 0) { ctx.fillStyle = `rgba(5,3,12,${stageFade / 40})`; ctx.fillRect(0, 0, W, H); }
  if (waveDelay > 0 && waveDelay < 40 && (wave - 1) % WAVES_PER_STAGE === 0) { ctx.fillStyle = `rgba(5,3,12,${1 - waveDelay / 40})`; ctx.fillRect(0, 0, W, H); }

  const banner = (title, sub, alpha) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(5,3,12,0.5)'; ctx.fillRect(0, H / 2 - 58, W, 96);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9d5ff'; ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 26;
    ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 6);
    ctx.shadowBlur = 0;
    if (sub) { ctx.fillStyle = '#fde68a'; ctx.font = '600 17px "Segoe UI", system-ui, sans-serif'; ctx.fillText(sub, W / 2, H / 2 + 24); }
    ctx.restore();
  };
  if (ending) banner('GAME OVER', `${crystals} crystals · wave ${wave}`, (ENDING_FRAMES - ending) / 30);
  else if (bannerTime > 0) banner(bannerText, bannerSub, bannerTime / 18);
}
