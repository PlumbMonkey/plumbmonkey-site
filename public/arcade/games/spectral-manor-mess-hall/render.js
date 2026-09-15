// ============================================================
// MESS HALL — the draw pass, food shapes and overlays
// Floor-level things first (splats, puddles, pickups, shadows), then every
// piece of furniture and every character DEPTH-SORTED by where it touches
// the floor, then things in the air (food, lobs, chandeliers), then UI.
// ============================================================

function drawFoodShape(type, s) {
  switch (type) {
    case 'pie':
      ctx.fillStyle = '#b45309';
      ctx.beginPath(); ctx.ellipse(0, s * 0.3, s, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.85, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.4, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'tomato':
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16a34a';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * s * 0.22, -s * 0.75, s * 0.28, s * 0.11, a, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'banana':
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = s * 0.55; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, -s * 0.25, s * 0.85, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#854d0e';
      ctx.beginPath(); ctx.arc(Math.cos(Math.PI * 0.15) * s * 0.85, -s * 0.25 + Math.sin(Math.PI * 0.15) * s * 0.85, s * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(Math.cos(Math.PI * 0.85) * s * 0.85, -s * 0.25 + Math.sin(Math.PI * 0.85) * s * 0.85, s * 0.15, 0, Math.PI * 2); ctx.fill();
      break;
    case 'chicken':
      ctx.fillStyle = '#c2703d';
      ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.15, s * 0.72, s * 0.55, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(-s * 0.42, -s * 0.32, s * 0.26, s * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fef3c7'; ctx.lineWidth = s * 0.2;
      ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.2); ctx.lineTo(s * 0.6, s * 0.55); ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath(); ctx.arc(s * 0.75, s * 0.45, s * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.6, s * 0.72, s * 0.17, 0, Math.PI * 2); ctx.fill();
      break;
    case 'cake':
      ctx.fillStyle = '#f9a8d4';
      ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.6); ctx.lineTo(s * 0.9, s * 0.6); ctx.lineTo(0, -s * 0.65); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fdf2f8'; ctx.fillRect(-s * 0.55, s * 0.05, s * 1.1, s * 0.17);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(0, -s * 0.78, s * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'soup':
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.25, s * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ea580c';
      ctx.beginPath(); ctx.arc(s * 0.3, s * 0.2, s * 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    case 'burger':
    default:
      ctx.fillStyle = '#d97706';
      ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.85, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c2d12'; ctx.fillRect(-s * 0.8, s * 0.02, s * 1.6, s * 0.26);
      ctx.fillStyle = '#4ade80'; ctx.fillRect(-s * 0.85, -s * 0.12, s * 1.7, s * 0.15);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.85, s * 0.55, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-s * 0.32, -s * 0.4, s * 0.12, s * 0.07);
      ctx.fillRect(s * 0.14, -s * 0.32, s * 0.12, s * 0.07);
      break;
  }
}

function drawBuffet(t) {
  const o = buffet, top = 16;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h + 8, o.w / 2 + 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  const warn = o.flash > 0 && Math.floor(o.flash / 4) % 2 === 0;
  // glow so the objective reads in every room
  const g = ctx.createRadialGradient(o.x + o.w / 2, o.y + o.h / 2, 10, o.x + o.w / 2, o.y + o.h / 2, 120);
  g.addColorStop(0, warn ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(o.x + o.w / 2 - 120, o.y + o.h / 2 - 120, 240, 240);
  inkRect(o.x, o.y, o.w, o.h - top, '#fef3c7');
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(o.x + 2, o.y + o.h - top - 4, o.w - 4, 3);
  const hem = [];
  for (let x = 0; x <= o.w; x += 12) hem.push([o.x + x, o.y + o.h + 2 + (x / 12 % 2 ? 3 : 0)]);
  inkPoly([[o.x, o.y + o.h - top], [o.x + o.w, o.y + o.h - top], ...hem.reverse()], warn ? '#b91c1c' : '#6d28d9');
  ctx.fillStyle = '#fbbf24';
  for (let x = o.x + 8; x < o.x + o.w - 4; x += 12) ctx.fillRect(x, o.y + o.h - top + 5, 4, 4);
  for (let d = 0; d < o.maxDishes; d++) {
    const dx = o.x + 16 + d * ((o.w - 32) / (o.maxDishes - 1));
    const dy = o.y + (o.h - top) / 2 + 2;
    if (d < o.dishes) {
      inkOval(dx, dy + 4, 9, 4, '#f5f3ff', 1.2);
      ctx.save(); ctx.translate(dx, dy); drawFoodShape(FOOD_TYPES[d % FOOD_TYPES.length].name, 6); ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(15,10,26,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(dx, dy + 4, 9, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRAND BUFFET', o.x + o.w / 2, o.y - 6);
}

function drawMonsterMarkers(c) {
  const fx = c.x + c.w / 2, fy = c.y + c.h + 2;
  if (c.carryDish || c.stealTimer < 90) {
    const col = c.carryDish ? '#fbbf24' : '#f0abfc';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(fx, fy, 20, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
    ctx.fillText(c.carryDish ? 'THIEF!' : 'RAID', fx, fy - 84);
  }
  // TELL: a short dashed line from the throwing hand along the throw
  if (c.pendingThrow && !c.pendingThrow.potion && !c.carryDish) {
    const sh = monsterShoulder(c), { x: hx, y: hy } = releasePoint(sh.x, sh.y, c.pendingThrow.angle, 16);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,139,134,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(c.pendingThrow.angle) * 70, hy + Math.sin(c.pendingThrow.angle) * 70); ctx.stroke();
    ctx.restore();
  }
  if (c.pounce && c.pounce.phase === 'crouch') {
    ctx.fillStyle = '#facc15'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', fx, fy - 76 + Math.sin(tick * 0.6) * 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(fx, fy - 10); ctx.lineTo(fx + Math.cos(c.pounce.angle) * 110, fy - 10 + Math.sin(c.pounce.angle) * 110); ctx.stroke();
    ctx.restore();
  }
}

function draw() {
  const t = tick;
  ctx.save();
  if (shakeTime > 0) ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);

  drawRoomBase(roomIdx, t);
  const room = ROOMS[roomIdx];
  drawIce(room, t);
  puddles.forEach(drawPuddle);
  splats.forEach(s => {
    ctx.globalAlpha = Math.min(0.8, s.life / 60);
    ctx.fillStyle = s.color;
    s.blobs.forEach(b => { ctx.beginPath(); ctx.ellipse(s.x + b.dx, s.y + b.dy, b.r, b.r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); });
  });
  ctx.globalAlpha = 1;
  chandeliers.forEach(drawChandelierShadow);

  pickups.forEach(p => {
    if (p.power) { drawPowerPickup(p, t); return; }
    const by = Math.sin(p.bob) * 3;
    drawShadow(p.x + 8, p.y + 16, 7, 0.25);
    ctx.save();
    ctx.translate(p.x + 8, p.y + 6 + by);
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    drawFoodShape(p.type, 8);
    ctx.restore();
  });
  ctx.shadowBlur = 0;

  // ---- depth-sorted pass ----
  const items = [];
  tables.forEach(o => {
    if (o.kind === 'buffet') items.push({ y: o.y + o.h, d: () => drawBuffet(t) });
    else {
      items.push({ y: o.y + o.h, d: () => drawObstacle(o, t) });
      if (o.flare && o.flare.phase !== 'idle') items.push({ y: o.y + o.h + STOVE_REACH, d: () => drawStoveFlames(o, t) });
    }
  });
  chefs.forEach(c => items.push({ y: c.y + c.h, d: () => { drawMonster(c, t); drawMonsterMarkers(c); } }));
  if (gameRunning || gameOver) items.push({ y: player.y + player.h, d: () => {
    if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.45;
    drawHero(player, t);
    ctx.globalAlpha = 1;
  } });
  if (boss) items.push({ y: boss.y, d: () => drawHeadChef(boss, t) });
  items.sort((a, b) => a.y - b.y).forEach(i => i.d());

  // ---- in the air ----
  lobs.forEach(l => drawLob(l, t));
  foods.forEach(f => {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot || 0);
    if (f.fromChef) {
      ctx.strokeStyle = '#ff9b8f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, f.r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowColor = f.fromChef ? '#f87171' : f.color; ctx.shadowBlur = 6;
    drawFoodShape(f.type, f.r + 2);
    ctx.restore();
  });
  ctx.shadowBlur = 0;
  if (boss) drawCleavers(boss, t);
  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 25);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  chandeliers.forEach(c => drawChandelier(c, t));

  // no aim guide or cursor ring: the hero's throwing arm shows where the food goes
  ctx.restore();

  // ---- UI ----
  if (gameRunning || gameOver) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(233,213,255,0.85)';
    ctx.fillText(`${room.name} · LEVEL ${level}`, 12, H - 4);
    if (player.power) {
      ctx.fillStyle = POWER_COLORS[player.power];
      const label = player.power === 'bigpie' ? `BIG PIES ×${player.powerShots}` : player.power === 'hotsauce' ? 'HOT SAUCE' : 'TRIPLE';
      ctx.textAlign = 'right';
      ctx.fillText(label, W - 12, H - 4);
    }
  }
  if (boss && boss.state !== 'enter') {
    const w = 320, x = W / 2 - w / 2, y = 8;
    ctx.fillStyle = 'rgba(15,10,26,0.8)'; ctx.fillRect(x - 3, y - 3, w + 6, 16);
    ctx.fillStyle = '#44403c'; ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = boss.phase2 ? '#f87171' : '#fbbf24'; ctx.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 10);
    ctx.fillStyle = '#fef3c7'; ctx.font = 'bold 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(boss.state === 'dizzy' ? 'THE HEAD CHEF — DIZZY! HIT HIM!' : 'THE HEAD CHEF', W / 2, y + 26);
  }
  if (gameRunning && comboMult() > 1) {
    ctx.save();
    ctx.fillStyle = '#f0abfc'; ctx.shadowColor = '#f0abfc'; ctx.shadowBlur = 12;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('COMBO ×' + comboMult(), W / 2, boss ? 64 : 48);
    ctx.restore();
  }

  // room transitions: fade out before the switch, back in after
  let fade = roomFade / 40;
  if (pendingRoom >= 0 && waveDelay < 40) fade = Math.max(fade, 1 - waveDelay / 40);
  if (fade > 0) { ctx.fillStyle = `rgba(5,3,10,${fade})`; ctx.fillRect(0, 0, W, H); }

  const banner = (title, sub, alpha) => {
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = 'rgba(10,6,18,0.5)'; ctx.fillRect(0, H / 2 - 58, W, 96);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9d5ff'; ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 24;
    ctx.font = 'bold 46px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 6);
    ctx.shadowBlur = 0;
    if (sub) { ctx.fillStyle = '#f0abfc'; ctx.font = '600 17px "Segoe UI", system-ui, sans-serif'; ctx.fillText(sub, W / 2, H / 2 + 24); }
    ctx.restore();
  };
  if (ending) banner('GAME OVER', endLine, (ENDING_FRAMES - ending) / 30);
  else if (bannerTime > 0) banner(bannerText, bannerSub, bannerTime / 18);

  TouchPad.draw(ctx);
  if (paused) {
    ctx.fillStyle = 'rgba(10,6,18,.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 36px sans-serif';
    ctx.fillText('KITCHEN BREAK', W / 2, H / 2 - 12);
    ctx.font = '18px sans-serif'; ctx.fillText('Press P / Esc or tap to resume', W / 2, H / 2 + 25);
  }
}
