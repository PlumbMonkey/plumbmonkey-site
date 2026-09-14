// ============================================================
// SWARM — laser fire and effects
// Lasers are drawn in three passes with ADDITIVE blending ('lighter'): a wide
// soft outer glow, a saturated mid beam, and a thin white-hot core, plus a
// glow sprite at the head. Additive light is what makes them read as energy
// rather than paint — overlapping shots brighten each other and the floor.
// Glow sprites are pre-rendered once per colour (radial gradients are the
// expensive part of canvas glow), then stamped with drawImage.
// ============================================================

const WEAPON_STYLE = {
  dual:   { core: '#ecfeff', mid: '#22d3ee', glow: '#0891b2', len: 2.6, width: 1 },
  rapid:  { core: '#f0fdf4', mid: '#4ade80', glow: '#15803d', len: 2.0, width: 0.8 },
  spread: { core: '#fdf4ff', mid: '#e879f9', glow: '#a21caf', len: 2.2, width: 0.9 },
  lance:  { core: '#fffbeb', mid: '#fbbf24', glow: '#d97706', len: 0, width: 1.6 }
};

const glowCache = {};
function glowSprite(color) {
  if (glowCache[color] !== undefined) return glowCache[color];
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return (glowCache[color] = null);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.25, rgba(color, 0.55));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return (glowCache[color] = c);
}
// Additive light blob. Call inside withLight().
function glow(x, y, r, color, alpha = 1) {
  const s = glowSprite(color);
  ctx.globalAlpha = alpha;
  if (s) ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  else { ctx.fillStyle = rgba(color, 0.4); ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function withLight(fn) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  fn();
  ctx.restore();
}

function beamStroke(x0, y0, x1, y1, st, scale, flicker) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(st.glow, 0.45); ctx.lineWidth = 11 * st.width * scale;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = rgba(st.mid, 0.9); ctx.lineWidth = 4.5 * st.width * scale * flicker;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = st.core; ctx.lineWidth = 1.8 * st.width * scale;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// ------------------------------------------------------------ player lasers
function drawLasers(bullets, t) {
  withLight(() => {
    bullets.forEach(b => {
      const st = WEAPON_STYLE[b.kind] || WEAPON_STYLE.dual;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      // the streak grows out of the muzzle over the first frames of flight
      const len = Math.min(sp * st.len * 2.4, b.age * sp * 1.1 + 6);
      const tx = b.x - b.vx / sp * len, ty = b.y - b.vy / sp * len;
      const flicker = 0.85 + Math.sin(t * 1.7 + b.seed) * 0.15;
      beamStroke(tx, ty, b.x, b.y, st, 1, flicker);
      glow(b.x, b.y, 14, st.mid, 0.9);
      glow(b.x, b.y, 5, '#ffffff', 0.9);
    });
  });
}

// The piercing LANCE: a solid beam from the gun to where it stops, with a
// travelling sine ripple and sparks where it bites.
function drawLance(beam, t) {
  if (!beam) return;
  const st = WEAPON_STYLE.lance;
  const dx = beam.x1 - beam.x0, dy = beam.y1 - beam.y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  withLight(() => {
    beamStroke(beam.x0, beam.y0, beam.x1, beam.y1, st, 1.3, 0.9 + Math.sin(t * 2.3) * 0.1);
    ctx.strokeStyle = 'rgba(254,243,199,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let s = 0; s <= 30; s++) {
      const k = s / 30, w = Math.sin(k * 26 - t * 0.9) * 4;
      const x = beam.x0 + dx * k + nx * w, y = beam.y0 + dy * k + ny * w;
      s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    glow(beam.x0, beam.y0, 26, st.mid, 0.9);
    glow(beam.x1, beam.y1, 30, st.mid, 0.9);
    glow(beam.x1, beam.y1, 10, '#ffffff', 1);
  });
}

// ------------------------------------------------------------ muzzle flashes
// {x, y, a, life, maxLife, kind}
function drawMuzzleFlashes(list) {
  withLight(() => {
    list.forEach(m => {
      const st = WEAPON_STYLE[m.kind] || WEAPON_STYLE.dual;
      const k = m.life / m.maxLife;
      glow(m.x, m.y, 34 * k + 8, st.mid, 0.9 * k);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.a);
      ctx.fillStyle = rgba(st.mid, 0.9 * k);
      // a four-point star, long along the barrel
      ctx.beginPath();
      ctx.moveTo(22 * k + 6, 0); ctx.lineTo(3, 3); ctx.lineTo(0, 10 * k + 2); ctx.lineTo(-3, 3);
      ctx.lineTo(-8 * k, 0); ctx.lineTo(-3, -3); ctx.lineTo(0, -10 * k - 2); ctx.lineTo(3, -3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${k})`;
      ctx.beginPath(); ctx.arc(2, 0, 3.5 * k + 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  });
}

// ------------------------------------------------------------ impacts
// {x, y, a, life, maxLife, color, big}
function drawImpacts(list) {
  withLight(() => {
    list.forEach(p => {
      const k = p.life / p.maxLife, grow = 1 - k;
      glow(p.x, p.y, (p.big ? 60 : 30) * (0.5 + grow * 0.5), p.color, k);
      ctx.strokeStyle = rgba(p.color, k);
      ctx.lineWidth = 2.5 * k + 0.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, (p.big ? 40 : 18) * grow + 4, 0, Math.PI * 2); ctx.stroke();
      // sparks spray back against the direction of the shot
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = p.a + Math.PI + (i - 2) * 0.45, r0 = 6 + grow * 12, r1 = r0 + 10 * k + 4;
        ctx.strokeStyle = i % 2 ? `rgba(255,255,255,${k})` : rgba(p.color, k);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); ctx.stroke();
      }
    });
  });
}

// Floor scorch marks: dark burns with an ember glow that cools off.
function drawScorches(list) {
  list.forEach(s => {
    const k = s.life / s.maxLife;
    ctx.fillStyle = `rgba(10,5,15,${0.45 * Math.min(1, k * 3)})`;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.55, s.a, 0, Math.PI * 2); ctx.fill();
  });
  withLight(() => list.forEach(s => {
    const heat = Math.max(0, (s.life / s.maxLife) * 3 - 2);  // glows for the first third
    if (heat > 0) glow(s.x, s.y, s.r * 1.3, s.color, heat * 0.5);
  }));
}

// ------------------------------------------------------------ enemy plasma
// {x, y, vx, vy, r, color, trail: [{x,y}]}
function drawPlasma(bolts, t) {
  withLight(() => {
    bolts.forEach(b => {
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i], k = (i + 1) / (b.trail.length + 1);
        glow(p.x, p.y, (b.r + 6) * k, b.color, 0.5 * k);
      }
      glow(b.x, b.y, b.r * 4, b.color, 0.85);
      const pulse = 1 + Math.sin(t * 0.8 + b.seed) * 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55 * pulse, 0, Math.PI * 2); ctx.fill();
      if (b.crackle) {                                     // archon bolts spit tiny arcs
        ctx.strokeStyle = rgba(b.color, 0.9); ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
          const a = t * 0.5 + i * 3 + b.seed;
          ctx.beginPath(); ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + Math.cos(a) * b.r * 1.6, b.y + Math.sin(a * 1.3) * b.r * 1.6);
          ctx.lineTo(b.x + Math.cos(a + 0.6) * b.r * 2.4, b.y + Math.sin(a + 0.9) * b.r * 2.4);
          ctx.stroke();
        }
      }
    });
  });
}

// ------------------------------------------------------------ particles
// {x, y, vx, vy, life, maxLife, color, size, light}
function drawParticles(list) {
  list.forEach(p => {
    if (p.light) return;
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  withLight(() => list.forEach(p => {
    if (!p.light) return;
    const k = Math.min(1, p.life / (p.maxLife || 30));
    glow(p.x, p.y, p.size * 3, p.color, k);
  }));
}

// A monster breaking apart: a flash ring, embers, and a few chunks.
function burst(x, y, color, n, light = true) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18 + Math.random() * 22, maxLife: 40, color, size: 1.5 + Math.random() * 2.5, light: light && i % 2 === 0 });
  }
}
