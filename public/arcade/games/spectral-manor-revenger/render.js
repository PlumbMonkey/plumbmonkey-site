// ============================================================
// REVENGER — backdrops, terrain, pickups, HUD, banners and the frame.
// ============================================================

// Parallax spans divide WORLD_W exactly (far ½ × 3840 = 1920, mid ⅔ × 3840 = 2560 = 2 × 1280),
// so no layer snaps when the camera wraps.
const FAR_SPAN = 1920, MID_SPAN = 1280;
const backdrops = {};

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function mkCanvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function ridge(c, span, base, amps, color, seed) {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= span; x += 8) {
    let y = base;
    amps.forEach(([cyc, a], i) => { y -= Math.sin((x / span) * Math.PI * 2 * cyc + seed + i) * a; });
    c.lineTo(x, y);
  }
  c.lineTo(span, H); c.closePath(); c.fill();
}

const THEMES = {
  grounds: {
    sky: ['#07030f', '#140a26', '#2a1440'], far: '#130a22', mid: '#0b0616', ground: ['#1a0f2c', '#0c0616'], rim: 'rgba(192,132,252,0.35)',
    paintSky(c) {
      c.fillStyle = '#e9d5ff'; c.shadowColor = '#c084fc'; c.shadowBlur = 30;
      c.beginPath(); c.arc(W - 150, 96, 34, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      c.fillStyle = 'rgba(160,120,210,0.3)'; c.beginPath(); c.arc(W - 160, 88, 7, 0, Math.PI * 2); c.arc(W - 140, 106, 5, 0, Math.PI * 2); c.fill();
    },
    paintMid(c) {
      const x = 380, base = H - 70;
      c.fillStyle = '#0b0616';
      c.beginPath(); c.moveTo(x - 80, base + 30); c.quadraticCurveTo(x + 90, base - 30, x + 280, base + 30); c.fill();
      c.fillRect(x + 40, base - 95, 130, 95); c.fillRect(x + 5, base - 70, 48, 70); c.fillRect(x + 160, base - 128, 42, 128);
      c.beginPath(); c.moveTo(x + 32, base - 95); c.lineTo(x + 105, base - 148); c.lineTo(x + 178, base - 95); c.fill();
      c.beginPath(); c.moveTo(x + 155, base - 128); c.lineTo(x + 181, base - 172); c.lineTo(x + 207, base - 128); c.fill();
      [[55, -72], [95, -72], [135, -72], [18, -50], [172, -100], [172, -60]].forEach(([dx, dy], i) => {
        c.fillStyle = i % 2 ? '#f59e0b' : '#c084fc'; c.shadowColor = c.fillStyle; c.shadowBlur = 10;
        c.fillRect(x + dx, base + dy, 11, 13);
      });
      c.shadowBlur = 0;
    },
    decor(c, sx, gy, k) {
      c.fillStyle = '#241536';
      if (k < 0.3) { c.beginPath(); c.moveTo(sx - 5, gy); c.lineTo(sx - 5, gy - 8); c.arc(sx, gy - 8, 5, Math.PI, 0); c.lineTo(sx + 5, gy); c.fill(); }
      else if (k < 0.45) { c.fillRect(sx - 1.5, gy - 12, 3, 12); c.fillRect(sx - 9, gy - 9, 18, 2.5); }
    }
  },
  graveyard: {
    sky: ['#03100f', '#0a2522', '#18403a'], far: '#0a1f1d', mid: '#051210', ground: ['#10241f', '#050d0b'], rim: 'rgba(94,234,212,0.3)',
    paintSky(c) {
      c.fillStyle = '#ecfeff'; c.shadowColor = '#5eead4'; c.shadowBlur = 24;
      c.beginPath(); c.arc(170, 90, 26, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      for (let i = 0; i < 5; i++) {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
        g.addColorStop(0, 'rgba(94,234,212,0.08)'); g.addColorStop(1, 'rgba(94,234,212,0)');
        c.save(); c.translate(120 + i * 190, 260 + (i % 2) * 40); c.scale(3, 1); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 60, 0, Math.PI * 2); c.fill(); c.restore();
      }
    },
    paintMid(c) {
      c.fillStyle = '#051210';
      const tree = (x, h) => {
        c.beginPath(); c.moveTo(x - 5, H - 60); c.lineTo(x - 2, H - 60 - h); c.lineTo(x + 2, H - 60 - h); c.lineTo(x + 5, H - 60); c.fill();
        [[-1, 0.7, -26], [1, 0.55, 22], [-1, 0.4, -18]].forEach(([d, k, len]) => {
          c.beginPath(); c.moveTo(x, H - 60 - h * k); c.quadraticCurveTo(x + len * 0.6, H - 70 - h * k, x + len, H - 76 - h * k); c.lineTo(x + len, H - 72 - h * k); c.quadraticCurveTo(x, H - 62 - h * k, x, H - 56 - h * k); c.fill();
        });
      };
      tree(120, 120); tree(520, 90); tree(980, 140);
      c.fillRect(720, H - 170, 60, 110);
      c.beginPath(); c.moveTo(712, H - 170); c.lineTo(750, H - 240); c.lineTo(788, H - 170); c.fill();
      c.fillStyle = '#5eead4'; c.shadowColor = '#5eead4'; c.shadowBlur = 10; c.fillRect(744, H - 150, 12, 20); c.shadowBlur = 0;
    },
    decor(c, sx, gy, k) {
      c.fillStyle = '#1f3a34';
      if (k < 0.35) { c.fillRect(sx - 1.5, gy - 16, 3, 16); c.fillRect(sx - 6, gy - 12, 12, 3); }
      else if (k < 0.55) { c.beginPath(); c.moveTo(sx - 6, gy); c.lineTo(sx - 6, gy - 10); c.arc(sx, gy - 10, 6, Math.PI, 0); c.lineTo(sx + 6, gy); c.fill(); }
    }
  },
  storm: {
    sky: ['#020617', '#0c1a33', '#1e3a5f'], far: '#0b1628', mid: '#050b16', ground: ['#1e293b', '#0b1220'], rim: 'rgba(125,211,252,0.35)',
    paintSky(c) {
      for (let i = 0; i < 9; i++) {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 90);
        g.addColorStop(0, 'rgba(71,85,105,0.55)'); g.addColorStop(1, 'rgba(71,85,105,0)');
        c.save(); c.translate(60 + i * 110, 90 + (i % 3) * 30); c.scale(2.2, 0.8); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 90, 0, Math.PI * 2); c.fill(); c.restore();
      }
    },
    paintMid(c) {
      c.fillStyle = '#0a1a2e'; c.fillRect(0, H - 90, MID_SPAN, 90);
      c.fillStyle = '#050b16';
      c.beginPath(); c.moveTo(860, H - 60); c.lineTo(900, H - 150); c.lineTo(1040, H - 160); c.lineTo(1100, H - 60); c.fill();
      c.fillRect(950, H - 250, 26, 95);
      c.beginPath(); c.moveTo(944, H - 250); c.lineTo(963, H - 272); c.lineTo(982, H - 250); c.fill();
      const g = c.createRadialGradient(963, H - 240, 0, 963, H - 240, 60);
      g.addColorStop(0, 'rgba(254,240,138,0.9)'); g.addColorStop(1, 'rgba(254,240,138,0)');
      c.fillStyle = g; c.beginPath(); c.arc(963, H - 240, 60, 0, Math.PI * 2); c.fill();
    },
    decor(c, sx, gy, k) {
      c.fillStyle = '#334155';
      if (k < 0.3) { c.beginPath(); c.moveTo(sx - 9, gy); c.lineTo(sx - 4, gy - 8); c.lineTo(sx + 5, gy - 6); c.lineTo(sx + 9, gy); c.fill(); }
    },
    weather(c) {
      c.strokeStyle = 'rgba(148,163,184,0.25)'; c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 40; i++) { const x = (hash(i) * W + tick * 7) % W, y = (hash(i + 50) * H + tick * 13) % H; c.moveTo(x, y); c.lineTo(x - 4, y + 12); }
      c.stroke();
      if (tick % 300 < 5) { c.fillStyle = `rgba(224,242,254,${0.18 - (tick % 300) * 0.03})`; c.fillRect(0, 0, W, H); }
    }
  },
  neon: {
    sky: ['#0a0014', '#2a0a3a', '#4a1150'], far: '#1c0a2e', mid: '#0e0618', ground: ['#1a0b24', '#07030d'], rim: 'rgba(244,114,182,0.4)',
    paintSky(c) {
      const g = c.createRadialGradient(W / 2, H - 80, 0, W / 2, H - 80, 420);
      g.addColorStop(0, 'rgba(244,114,182,0.25)'); g.addColorStop(1, 'rgba(244,114,182,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
    paintMid(c) {
      for (let i = 0; i < 16; i++) {
        const x = i * 80 + 6, h = 90 + hash(i) * 170, w = 60;
        c.fillStyle = '#0e0618'; c.fillRect(x, H - 60 - h, w, h + 60);
        for (let r = 0; r < h / 16 - 1; r++) for (let q = 0; q < 3; q++) {
          if (hash(i * 31 + r * 7 + q) < 0.55) continue;
          c.fillStyle = hash(i + r + q) < 0.5 ? 'rgba(103,232,249,0.7)' : 'rgba(244,114,182,0.7)';
          c.fillRect(x + 8 + q * 17, H - 50 - h + r * 16, 8, 6);
        }
      }
      c.fillStyle = '#f472b6'; c.shadowColor = '#f472b6'; c.shadowBlur = 14;
      c.font = 'bold 20px "Segoe UI", sans-serif'; c.fillText('GHOST CIRCUIT', 420, H - 240);
      c.shadowBlur = 0;
    },
    decor(c, sx, gy, k) {
      if (k < 0.25) { c.fillStyle = '#3b0764'; c.fillRect(sx - 1, gy - 22, 2, 22); drawGlow(c, '#f0abfc', sx, gy - 23, 8, 0.8); }
    },
    weather(c) {
      c.strokeStyle = 'rgba(244,114,182,0.2)'; c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 50; i++) { const x = (hash(i) * W + tick * 2) % W, y = (hash(i + 90) * H + tick * 15) % H; c.moveTo(x, y); c.lineTo(x - 1, y + 10); }
      c.stroke();
    }
  }
};

function backdropFor(id) {
  if (backdrops[id]) return backdrops[id];
  const T = THEMES[id];
  const sky = mkCanvas(W, H), sc = sky.getContext('2d');
  const g = sc.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, T.sky[0]); g.addColorStop(0.6, T.sky[1]); g.addColorStop(1, T.sky[2]);
  sc.fillStyle = g; sc.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    sc.globalAlpha = 0.2 + hash(i + 7) * 0.6;
    sc.fillStyle = '#e0d4ff';
    sc.fillRect(hash(i) * W, hash(i + 300) * (H - 180), hash(i + 99) < 0.15 ? 2 : 1.2, hash(i + 99) < 0.15 ? 2 : 1.2);
  }
  sc.globalAlpha = 1;
  T.paintSky(sc);
  const far = mkCanvas(FAR_SPAN, H), fc = far.getContext('2d');
  ridge(fc, FAR_SPAN, H - 110, [[3, 28], [7, 12]], T.far, id.length);
  const mid = mkCanvas(MID_SPAN, H), mc = mid.getContext('2d');
  T.paintMid(mc);
  return (backdrops[id] = { sky, far, mid, T });
}

function drawLayer(c, img, off, span) {
  const x = -(((off % span) + span) % span);
  for (let k = x; k < W; k += span) c.drawImage(img, k, 0);
}

function drawWorldBack(c) {
  const B = backdropFor(info.sector.id);
  c.drawImage(B.sky, 0, 0);
  drawLayer(c, B.far, camX * 0.5, FAR_SPAN);
  c.globalAlpha = 0.85;
  drawLayer(c, B.mid, camX * (2 / 3), MID_SPAN);
  c.globalAlpha = 1;
  // terrain
  const T = B.T;
  const g = c.createLinearGradient(0, H - 80, 0, H);
  g.addColorStop(0, T.ground[0]); g.addColorStop(1, T.ground[1]);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, H);
  for (let sx = 0; sx <= W; sx += 8) c.lineTo(sx, groundY(camX + sx));
  c.lineTo(W, H); c.closePath(); c.fill();
  const rim = c.createLinearGradient(0, H - 70, 0, H - 30);
  rim.addColorStop(0, T.rim); rim.addColorStop(1, 'rgba(0,0,0,0)');
  c.strokeStyle = rim; c.lineWidth = 2;
  c.beginPath();
  for (let sx = 0; sx <= W; sx += 8) sx ? c.lineTo(sx, groundY(camX + sx)) : c.moveTo(sx, groundY(camX));
  c.stroke();
  const cells = WORLD_W / 64;
  const first = Math.floor((camX - 40) / 64);
  for (let i = first; i < first + Math.ceil(W / 64) + 2; i++) {
    const idx = ((i % cells) + cells) % cells;
    const wx = idx * 64 + 20;
    const sx = toScreen(wx);
    if (sx < -30 || sx > W + 30) continue;
    T.decor(c, sx, groundY(wx) + 2, hash(idx + info.sectorIdx * 100));
  }
  if (info.sector.id === 'grounds') drawStage(c);
  if (T.weather) T.weather(c);
  if (rift) drawRift(c);
}

function drawStage(c) {
  const sx = toScreen(180);
  if (sx < -320 || sx > W + 100) return;
  const y = groundY(290) - 18;
  c.fillStyle = '#1e1b4b'; c.fillRect(sx, y, 220, 18);
  c.fillStyle = '#7c3aed'; c.fillRect(sx, y + 15, 220, 3);
  c.fillStyle = '#0f0a1f'; c.fillRect(sx + 20, y - 55, 180, 55);
  c.fillStyle = '#c084fc'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
  c.fillText('GHOST CIRCUIT', sx + 110, y - 25);
  c.fillStyle = '#1e1b4b'; c.fillRect(sx - 25, y - 40, 22, 58); c.fillRect(sx + 223, y - 40, 22, 58);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const lx = sx + 40 + i * 45, a = Math.sin(tick * 0.03 + i * 1.3) * 0.35, len = 170;
    c.save(); c.translate(lx, y - 55); c.rotate(a);
    const bg = c.createLinearGradient(0, 0, 0, -len);
    bg.addColorStop(0, ['rgba(192,132,252,0.22)', 'rgba(34,211,238,0.18)', 'rgba(244,114,182,0.18)', 'rgba(167,139,250,0.22)'][i]);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = bg; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.lineTo(26, -len); c.lineTo(-26, -len); c.fill();
    c.restore();
  }
  c.restore();
}

// The Rift: the planet's colours invert and fractures glow in the sky.
function drawRift(c) {
  c.save();
  c.globalCompositeOperation = 'difference';
  c.fillStyle = '#e8d8ff';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = '#ff7ad9';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const wx = hash(i + 500) * WORLD_W, sx = toScreen(wx);
    if (sx < -80 || sx > W + 80) continue;
    const y0 = 70 + hash(i + 600) * 220, pulse = 0.5 + Math.sin(tick * 0.08 + i) * 0.3;
    drawGlow(c, '#22d3ee', sx, y0, 40, pulse * 0.6);
    c.strokeStyle = `rgba(165,243,252,${pulse})`; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(sx, y0);
    for (let k = 1; k < 5; k++) c.lineTo(sx + (hash(i * 9 + k) - 0.5) * 50, y0 + k * 14 * (hash(i + k) < 0.5 ? 1 : -1));
    c.stroke();
  }
  c.restore();
}

function drawPickups(c) {
  pickups.forEach(p => {
    const sx = toScreen(p.x); if (sx < -30 || sx > W + 30) return;
    const I = PICKUP_INFO[p.type];
    const a = p.life < 90 ? (Math.floor(p.life / 6) % 2 ? 0.35 : 1) : 1;
    const bob = Math.sin(tick * 0.1 + p.id) * 3;
    c.save(); c.globalAlpha = a;
    drawGlow(c, I.color, sx, p.y + bob, 26, 0.55);
    c.beginPath(); c.arc(sx, p.y + bob, 12, 0, Math.PI * 2);
    c.fillStyle = '#120b1e'; c.fill();
    c.strokeStyle = I.color; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = I.color; c.font = 'bold 13px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(I.glyph, sx, p.y + bob + 1);
    c.restore();
  });
}

// ---------- HUD ----------
function drawHUD(c) {
  const g = c.createLinearGradient(0, 0, 0, HUD_H);
  g.addColorStop(0, 'rgba(7,3,15,0.95)'); g.addColorStop(1, 'rgba(7,3,15,0.7)');
  c.fillStyle = g; c.fillRect(0, 0, W, HUD_H);
  c.fillStyle = info.sector.accent; c.globalAlpha = 0.5; c.fillRect(0, HUD_H - 1, W, 1); c.globalAlpha = 1;
  c.textBaseline = 'alphabetic';
  c.font = 'bold 18px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'left'; c.fillStyle = '#f5f3ff';
  c.fillText(String(score).padStart(7, '0'), 12, 22);
  const mini = shipSprite(0);
  for (let i = 0; i < Math.min(lives, 6); i++) c.drawImage(mini, 12 + i * 22, 27, 26, 14);
  c.font = 'bold 12px "Segoe UI", sans-serif';
  for (let i = 0; i < ship.bombs; i++) { c.fillStyle = '#f472b6'; c.fillText('♪', 150 + i * 12, 38); }
  for (let i = 0; i < ship.warps; i++) { c.fillStyle = '#a78bfa'; c.fillText('W', 150 + i * 13, 20); }

  // radar: the whole wrapping world, ship centred
  const rw = 320, rh = 36, rx = W / 2 - rw / 2, ry = 5;
  c.fillStyle = 'rgba(15,8,28,0.9)'; c.fillRect(rx, ry, rw, rh);
  c.strokeStyle = 'rgba(192,132,252,0.55)'; c.lineWidth = 1; c.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  const toR = wx => rx + rw / 2 + (wrapDX(wx, ship.x) / WORLD_W) * rw;
  const yR = y => ry + 3 + ((y - HUD_H) / (H - HUD_H)) * (rh - 6);
  c.strokeStyle = rift ? 'rgba(34,211,238,0.6)' : 'rgba(134,239,172,0.5)';
  c.beginPath();
  for (let i = 0; i <= rw; i += 4) { const wx = ship.x + ((i - rw / 2) / rw) * WORLD_W; i ? c.lineTo(rx + i, yR(groundY(wx))) : c.moveTo(rx, yR(groundY(wx))); }
  c.stroke();
  const vp = (W / WORLD_W) * rw, vx = toR(camX + W / 2);
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.strokeRect(vx - vp / 2, ry + 1, vp, rh - 2);
  fans.forEach(f => { c.fillStyle = f.state === 'grabbed' ? '#f87171' : '#67e8f9'; c.fillRect(toR(f.x) - 1, yR(f.y) - 2, 2, 2); });
  enemies.forEach(e => { c.fillStyle = e.type === 'lander' ? (e.carry ? '#fbbf24' : '#e879f9') : e.type === 'baiter' ? '#f97316' : '#fda4af'; c.fillRect(toR(e.x) - 1.5, yR(e.y) - 1.5, 3, 3); });
  pickups.forEach(p => { c.fillStyle = PICKUP_INFO[p.type].color; c.fillRect(toR(p.x) - 1, yR(p.y) - 1, 2, 2); });
  if (boss) { c.fillStyle = '#ffffff'; c.fillRect(toR(boss.x) - 4, yR(boss.y) - 3, 8, 6); }
  c.fillStyle = '#ffffff'; c.fillRect(rx + rw / 2 - 2, yR(ship.y) - 2, 4, 4);

  // right: sector, laser, shield, options, tractor
  c.textAlign = 'right';
  c.font = 'bold 13px "Segoe UI", sans-serif'; c.fillStyle = info.sector.accent;
  c.fillText(`${info.sector.name} ${info.label}${rift ? ' · RIFT' : ''}`, W - 12, 18);
  c.font = 'bold 11px "Segoe UI", sans-serif';
  let x = W - 12;
  const chip = (text, color, on) => { c.fillStyle = on ? color : 'rgba(148,163,184,0.35)'; c.fillText(text, x, 36); x -= c.measureText(text).width + 10; };
  chip('TRACTOR', '#5eead4', ship.tractor);
  chip(`OPT ${ship.options}`, '#e0f2fe', ship.options > 0);
  chip(`SHIELD ${'◆'.repeat(ship.shield)}${'◇'.repeat(MAX_SHIELD - ship.shield)}`, '#fb7185', ship.shield > 0);
  chip(`LASER ${'▮'.repeat(ship.laser + 1)}${'▯'.repeat(MAX_LASER - ship.laser)}`, '#67e8f9', true);

  if (boss && !boss.dying) {
    const bw = 360, bx = W / 2 - bw / 2, by = HUD_H + 8;
    c.fillStyle = 'rgba(15,8,28,0.8)'; c.fillRect(bx, by, bw, 8);
    c.fillStyle = info.sector.accent; c.fillRect(bx, by, bw * (boss.hp / boss.maxHp), 8);
    c.textAlign = 'center'; c.fillStyle = '#f5f3ff'; c.font = 'bold 11px "Segoe UI", sans-serif';
    c.fillText(boss.name, W / 2, by + 22);
  }
  if (comboMult() > 1 && phase === 'play') {
    c.textAlign = 'left'; c.fillStyle = '#f0abfc'; c.font = 'bold 16px "Segoe UI", sans-serif';
    c.fillText(`COMBO ×${comboMult()}`, 12, HUD_H + 22);
  }
}

function drawBanner(c) {
  let a = 0;
  if (phase === 'intro') a = Math.min(1, phaseT / 20);
  else if (phase === 'clear' || phase === 'rift') a = Math.min(1, phaseT / 20);
  else if (phase === 'ending') a = Math.min(1, (ENDING_FRAMES - phaseT) / 20);
  else if (phase === 'bossDeath' && boss && boss.dying < 90) { a = 1; banner = { text: 'MOTHERSHIP DESTROYED', sub: '' }; }
  if (a <= 0 || !banner.text) return;
  c.save();
  c.globalAlpha = a;
  c.textAlign = 'center';
  c.fillStyle = phase === 'ending' ? '#fca5a5' : info.sector.accent;
  c.shadowColor = c.fillStyle; c.shadowBlur = 24;
  c.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
  c.fillText(banner.text, W / 2, H / 2 - 20);
  c.shadowBlur = 8;
  c.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
  c.fillStyle = '#f5f3ff';
  if (banner.sub) c.fillText(banner.sub, W / 2, H / 2 + 14);
  c.restore();
}

let scanlines = null;
function draw() {
  const c = ctx;
  c.save();
  c.translate(FX.sx, FX.sy);
  drawWorldBack(c);
  drawFans(c);
  drawPickups(c);
  drawEnemies(c);
  drawBoss(c, boss);
  drawEnemyFire(c);
  beams.forEach(b => drawBeam(c, b, toScreen(b.x0)));
  const sx = toScreen(ship.x);
  if (gameRunning && phase !== 'dying' && phase !== 'ending') {
    for (let i = 0; i < ship.options; i++) { const o = optionPos(ship, i); drawOption(c, toScreen(o.x), o.y, i); }
    drawTractor(c, ship, sx);
    drawShip(c, ship, sx);
  }
  FX.draw(c, toScreen);
  c.restore();
  if (!scanlines) {
    scanlines = mkCanvas(W, H);
    const sc = scanlines.getContext('2d');
    sc.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < H; y += 3) sc.fillRect(0, y, W, 1);
  }
  c.drawImage(scanlines, 0, 0);
  FX.drawFlash(c);
  if (gameRunning || phase === 'ending') drawHUD(c);
  drawBanner(c);
  if (paused) {
    c.save();
    c.fillStyle = 'rgba(7,3,15,0.6)'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c084fc'; c.textAlign = 'center'; c.font = 'bold 48px "Segoe UI", sans-serif';
    c.fillText('PAUSED', W / 2, H / 2 - 10);
    c.font = 'bold 16px "Segoe UI", sans-serif'; c.fillText('P or Esc to resume', W / 2, H / 2 + 22);
    c.restore();
  }
}
