// ============================================================
// SPECTRAL MANOR CRUISE — draw pass
// Road: near → far with a moving clip line (hills hide what is behind them),
// fog blended per segment, tunnels as nested openings. Sprites: far → near,
// each clipped to the road line that was current at its segment.
// ============================================================

const TUNNEL_H = 3200;          // world units from road to tunnel ceiling
const TUNNEL_EDGE = 1.18;       // tunnel walls stand this far out (road units)
let weatherBits = [];

function themeRgb(theme) {
  if (theme._rgb) return theme._rgb;
  const pair = a => a.map(hexRgb);
  theme._rgb = { grass: pair(theme.grass), road: pair(theme.road), rumble: pair(theme.rumble), lane: hexRgb(theme.lane), edge: hexRgb(theme.edge), fog: hexRgb(theme.fog) };
  return theme._rgb;
}

function quad(x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2);
  ctx.closePath(); ctx.fill();
}
function strip(x1, y1, w1, x2, y2, w2, from, to, color) {   // a band between two fractions of the half-width
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 + w1 * from, y1); ctx.lineTo(x1 + w1 * to, y1); ctx.lineTo(x2 + w2 * to, y2); ctx.lineTo(x2 + w2 * from, y2);
  ctx.closePath(); ctx.fill();
}

function draw() {
  const t = tick, T = track, theme = T.theme, C = themeRgb(theme);
  const segs = T.segments, N = segs.length;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  const camZ = cameraZ();
  const base = segs[Math.floor(camZ / SEG_LEN) % N];
  const basePct = (camZ % SEG_LEN) / SEG_LEN;
  const carZ = (camZ + PLAYER_Z) % T.length;
  const carSeg = segs[Math.floor(carZ / SEG_LEN) % N];
  const carY = carSeg.y1 + (carSeg.y2 - carSeg.y1) * ((carZ % SEG_LEN) / SEG_LEN);
  const camY = carY + CAM_H;
  const camX = player.x * ROAD_W;

  // ---- sky and parallax ----
  const sky = buildSky(theme);
  const lift = Math.max(-40, Math.min(40, carY * 0.006));
  if (sky.sky) ctx.drawImage(sky.sky, 0, lift - 60);
  else { ctx.fillStyle = theme.sky[1]; ctx.fillRect(0, 0, W, H / 2 + 20); }
  [[sky.far, 0.25], [sky.near, 0.6]].forEach(([layer, k]) => {
    if (!layer) return;
    const ox = -(((bgOffset * k) % LAYER_W) + LAYER_W) % LAYER_W;
    const y = H / 2 - LAYER_H + 18 + lift * (k > 0.5 ? 1.4 : 1);
    ctx.drawImage(layer, ox, y); ctx.drawImage(layer, ox + LAYER_W, y);
  });
  ctx.fillStyle = mix(C.grass[1], C.fog, 0.85);
  ctx.fillRect(0, H / 2 + 18 + lift * 1.4, W, H);

  // ---- road ----
  let maxY = H, x = 0, dx = -(base.curve * basePct);
  const vis = [];
  let open = null;              // current tunnel opening clip (screen rect)
  let clipDepth = 0;
  for (let n = 0; n < DRAW_DIST; n++) {
    const seg = segs[(base.i + n) % N];
    const z1 = (base.i + n) * SEG_LEN - camZ, z2 = z1 + SEG_LEN;
    const x1 = x, x2 = x + dx;
    x += dx; dx += seg.curve;
    if (z1 <= 20) continue;
    const s1 = CAM_DEPTH / z1, s2 = CAM_DEPTH / z2;
    const X1 = W / 2 + s1 * (x1 - camX) * W / 2, X2 = W / 2 + s2 * (x2 - camX) * W / 2;
    const Y1 = H / 2 - s1 * (seg.y1 - camY) * H / 2, Y2 = H / 2 - s2 * (seg.y2 - camY) * H / 2;
    const W1 = s1 * ROAD_W * W / 2, W2 = s2 * ROAD_W * W / 2;
    const f = Math.min(0.96, 1 - Math.exp(-Math.pow(n / DRAW_DIST, 2) * theme.fogDensity * (1 + 2.5 * seg.fogBank)));
    const entry = { seg, X1, Y1, W1, s1, X2, Y2, W2, s2, clip: maxY, fog: f, open, z1 };
    vis.push(entry);
    if (Y2 >= Y1 || Y2 >= maxY) continue;

    const light = Math.floor(seg.i / 3) % 2;
    const prevTunnel = segs[(seg.i - 1 + N) % N].tunnel;
    if (seg.tunnel) {
      const c1 = Y1 - s1 * TUNNEL_H * H / 2, c2 = Y2 - s2 * TUNNEL_H * H / 2;
      const e1 = W1 * TUNNEL_EDGE, e2 = W2 * TUNNEL_EDGE;
      if (!prevTunnel) {
        // the tunnel mouth: a wall across everything but the opening
        ctx.fillStyle = mix([40, 32, 52], C.fog, f);
        ctx.fillRect(0, 0, W, c1); ctx.fillRect(0, c1, X1 - e1, Y1 - c1); ctx.fillRect(X1 + e1, c1, W - X1 - e1, Y1 - c1);
        ctx.fillStyle = mix([236, 72, 153], C.fog, f);
        ctx.fillRect(X1 - e1, c1 - 6, e1 * 2, 6);
      }
      ctx.fillStyle = mix(light ? [36, 30, 46] : [30, 25, 40], C.fog, f);
      ctx.beginPath(); ctx.moveTo(X1 - e1, Y1); ctx.lineTo(X1 - e1, c1); ctx.lineTo(X2 - e2, c2); ctx.lineTo(X2 - e2, Y2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X1 + e1, Y1); ctx.lineTo(X1 + e1, c1); ctx.lineTo(X2 + e2, c2); ctx.lineTo(X2 + e2, Y2); ctx.fill();
      ctx.fillStyle = mix(light ? [22, 18, 30] : [18, 14, 26], C.fog, f);
      ctx.beginPath(); ctx.moveTo(X1 - e1, c1); ctx.lineTo(X1 + e1, c1); ctx.lineTo(X2 + e2, c2); ctx.lineTo(X2 - e2, c2); ctx.fill();
      if (seg.i % 10 === 0) { ctx.fillStyle = mix([253, 230, 138], C.fog, f); ctx.fillRect(X1 - W1 * 0.3, c1 + 2, W1 * 0.6, Math.max(1, (Y1 - c1) * 0.02)); }
      // everything farther away is seen through this opening
      ctx.save(); clipDepth++;
      ctx.beginPath(); ctx.rect(X2 - e2, c2, e2 * 2, Math.max(0, Y2 - c2) + 2); ctx.clip();
      open = { l: X2 - e2, t: c2, r: X2 + e2, b: Y2 + 2 };
    } else {
      ctx.fillStyle = mix(C.grass[light], C.fog, f);
      ctx.fillRect(0, Y2, W, Y1 - Y2 + 1);
    }
    quad(X1, Y1, W1 * 1.12, X2, Y2, W2 * 1.12, mix(C.rumble[light], C.fog, f));
    quad(X1, Y1, W1, X2, Y2, W2, mix(C.road[light], C.fog, f));
    const edge = mix(C.edge, C.fog, f);
    strip(X1, Y1, W1, X2, Y2, W2, -0.95, -0.91, edge);
    strip(X1, Y1, W1, X2, Y2, W2, 0.91, 0.95, edge);
    if (light) {
      const lane = mix(C.lane, C.fog, f);
      strip(X1, Y1, W1, X2, Y2, W2, -0.35, -0.31, lane);
      strip(X1, Y1, W1, X2, Y2, W2, 0.31, 0.35, lane);
    }
    if (theme.weather === 'rain' && !seg.tunnel && seg.i % 4 === 0) {      // wet shine from the street lamps
      ctx.fillStyle = `rgba(251,207,232,${0.07 * (1 - f)})`;
      strip(X1, Y1, W1, X2, Y2, W2, 0.55, 0.9, ctx.fillStyle);
      strip(X1, Y1, W1, X2, Y2, W2, -0.9, -0.55, ctx.fillStyle);
    }
    if (seg.i === 4 || seg.i === 5) {       // chequered start / finish line
      const cells = 12;
      for (let k = 0; k < cells; k++) strip(X1, Y1, W1, X2, Y2, W2, -1 + k * 2 / cells, -1 + (k + 1) * 2 / cells, (k + seg.i) % 2 ? '#f5f5f5' : '#111');
    }
    maxY = Y2;
    entry.drawn = true;
  }
  while (clipDepth-- > 0) ctx.restore();

  // ---- sprites, far → near ----
  const rivalsBySeg = new Map();
  opponents.forEach(o => {
    const z = ((o.totalZ % T.length) + T.length) % T.length;
    const i = Math.floor(z / SEG_LEN) % N;
    if (!rivalsBySeg.has(i)) rivalsBySeg.set(i, []);
    rivalsBySeg.get(i).push({ o, pct: (z % SEG_LEN) / SEG_LEN });
  });
  const firesBySeg = new Map();
  fireballs.forEach(fb => {
    const z = ((fb.totalZ % T.length) + T.length) % T.length, i = Math.floor(z / SEG_LEN) % N;
    if (!firesBySeg.has(i)) firesBySeg.set(i, []);
    firesBySeg.get(i).push(fb);
  });

  for (let v = vis.length - 1; v >= 0; v--) {
    const e = vis[v], seg = e.seg;
    const withClip = (fn, top) => {
      if (top >= e.clip) return;
      const needs = e.open || true;
      ctx.save();
      ctx.beginPath();
      if (e.open) ctx.rect(e.open.l, e.open.t, e.open.r - e.open.l, Math.min(e.clip, e.open.b) - e.open.t);
      else ctx.rect(0, 0, W, e.clip);
      if (needs) ctx.clip();
      fn();
      ctx.restore();
    };
    const pxu = e.s1 * W / 2;   // screen px per world unit at this segment
    const fogA = 1 - e.fog * 0.85;

    seg.sprites.forEach((sp, k) => {
      if (sp.name === 'ramp') return withClip(() => drawRamp(e), e.Y1 - e.W1 * 0.2);
      if (sp.name === 'gantry' || sp.name === 'boneArch') return withClip(() => drawGantry(e, sp.name, t), e.Y1 - pxu * 3600);
      const def = SPRITE_DEFS[sp.name];
      const cv = spriteCanvas(sp.name, seg.i + k);
      const h = def.world * pxu, w = h * def.w / def.h;
      if (h < 2) return;
      const sx = e.X1 + sp.offset * e.W1 - w / 2 - (sp.offset < 0 ? w * 0.1 : -w * 0.1);
      if (sx > W || sx + w < 0) return;
      withClip(() => {
        ctx.globalAlpha = fogA;
        if (cv) ctx.drawImage(cv, sx, e.Y1 - h, w, h);
        ctx.globalAlpha = 1;
      }, e.Y1 - h);
    });

    seg.hazards.forEach(hz => withClip(() => drawHazard(hz, e, t), e.Y1 - e.W1 * 0.2));
    seg.orbs.forEach(ob => { if (ob.lap !== player.lap) withClip(() => drawOrb(ob, e, t, fogA), e.Y1 - pxu * 900); });
    (firesBySeg.get(seg.i) || []).forEach(fb => withClip(() => drawFireball(fb, e, t), e.Y1 - e.W1 * 0.2));
    (rivalsBySeg.get(seg.i) || []).forEach(({ o, pct }) => {
      const cx = e.X1 + (e.X2 - e.X1) * pct, cy = e.Y1 + (e.Y2 - e.Y1) * pct, cw = e.W1 + (e.W2 - e.W1) * pct;
      const s = e.s1 + (e.s2 - e.s1) * pct;
      const sx = cx + o.x * cw;
      const yaw = Math.max(-1, Math.min(1, (sx - W / 2) / (W * 0.35) - seg.curve * 0.12));
      const unit = s * W / 2;
      withClip(() => {
        const alpha = o.ghost ? 0.5 + Math.sin(t * 0.1) * 0.15 : 1;
        const width = drawCarSprite(ctx, o.key, sx, cy, unit, yaw, o.braking, alpha * fogA);
        if (width > 60) {
          ctx.font = `bold ${Math.min(16, 8 + width * 0.03)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(8,4,16,0.6)'; ctx.fillText(o.name, sx + 1, cy - width * 0.72 + 1);
          ctx.fillStyle = o.tag; ctx.fillText(o.name, sx, cy - width * 0.72);
        }
      }, cy - unit * 900);
    });
  }

  drawPlayer(t, theme);
  drawFx();
  drawWeather(theme, t);
  if (carSeg.tunnel) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H); }
  if (batSwarm > 0) drawBats(t);
  ctx.restore();
  drawHud(theme, t);
}

function drawRamp(e) {
  const rw = e.W1, rh = rw * 0.16;
  ctx.fillStyle = '#3b2412';
  ctx.beginPath(); ctx.moveTo(e.X1 - rw, e.Y1); ctx.lineTo(e.X1 + rw, e.Y1); ctx.lineTo(e.X1 + rw * 0.8, e.Y1 - rh); ctx.lineTo(e.X1 - rw * 0.8, e.Y1 - rh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = Math.max(1, rw * 0.008);
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(e.X1 + rw * i / 4.4, e.Y1); ctx.lineTo(e.X1 + rw * 0.8 * i / 4.4, e.Y1 - rh); ctx.stroke(); }
  ctx.fillStyle = '#f0abfc';
  ctx.fillRect(e.X1 - rw * 0.8, e.Y1 - rh - Math.max(2, rw * 0.02), rw * 1.6, Math.max(2, rw * 0.02));
  // chevrons
  ctx.fillStyle = '#fde047';
  for (let i = -1; i <= 1; i++) {
    const cx = e.X1 + i * rw * 0.45, cy = e.Y1 - rh * 0.5, s = rw * 0.06;
    ctx.beginPath(); ctx.moveTo(cx - s, cy + s * 0.4); ctx.lineTo(cx, cy - s * 0.5); ctx.lineTo(cx + s, cy + s * 0.4); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
  }
}

function drawGantry(e, kind, t) {
  const pxu = e.s1 * W / 2, h = pxu * 3400, post = Math.max(2, pxu * 160), span = e.W1 * 1.2;
  const L = e.X1 - span, R = e.X1 + span, top = e.Y1 - h;
  if (kind === 'boneArch') {
    ctx.strokeStyle = '#e7e0cf'; ctx.lineWidth = Math.max(2, pxu * 260);
    ctx.beginPath(); ctx.moveTo(L, e.Y1); ctx.quadraticCurveTo(e.X1, top - h * 0.5, R, e.Y1); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, pxu * 40);
    for (let k = 1; k < 9; k++) { const p = k / 9, bx = L + (R - L) * p, by = e.Y1 - 4 * p * (1 - p) * (h * 1.5); ctx.beginPath(); ctx.moveTo(bx, by - pxu * 130); ctx.lineTo(bx, by + pxu * 130); ctx.stroke(); }
    return;
  }
  ctx.fillStyle = '#1f1a2e'; ctx.fillRect(L - post / 2, top, post, h); ctx.fillRect(R - post / 2, top, post, h);
  const bh = pxu * 700;
  ctx.fillStyle = '#120a20'; ctx.fillRect(L, top, R - L, bh);
  for (let k = 0; k < 16; k++) { ctx.fillStyle = k % 2 ? '#f5f5f5' : '#111'; ctx.fillRect(L + (R - L) * k / 16, top + bh, (R - L) / 16, bh * 0.25); }
  if (bh > 12) {
    ctx.fillStyle = '#f0abfc'; ctx.font = `bold ${bh * 0.55}px "Segoe UI", sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(finishing || player.lap >= LAPS ? 'FINAL LAP' : 'SPECTRAL MANOR CRUISE', e.X1, top + bh * 0.72);
  }
}

function drawHazard(hz, e, t) {
  const cx = e.X1 + hz.x * e.W1, w = hz.w * e.W1, y = e.Y1;
  if (hz.type === 'log') {
    const h = w * 0.22;
    ctx.fillStyle = '#4a2f1d'; ctx.fillRect(cx - w, y - h, w * 2, h);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, w * 0.02); ctx.strokeRect(cx - w, y - h, w * 2, h);
    ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.ellipse(cx + w, y - h / 2, h * 0.3, h / 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(cx - w * 0.8, y - h * 0.7, w * 1.5, Math.max(1, h * 0.12));
  } else if (hz.type === 'lava') {
    const g = ctx.createRadialGradient(cx, y, 0, cx, y, w);
    g.addColorStop(0, '#fde047'); g.addColorStop(0.4, '#f97316'); g.addColorStop(1, 'rgba(127,29,29,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, y, w, w * 0.22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(254,240,138,0.8)';
    for (let k = 0; k < 3; k++) { const bx = cx + Math.sin(t * 0.05 + k * 2) * w * 0.5; ctx.beginPath(); ctx.arc(bx, y - w * 0.04, Math.max(1, w * 0.035), 0, 7); ctx.fill(); }
  } else {
    ctx.fillStyle = 'rgba(103,232,249,0.28)'; ctx.beginPath(); ctx.ellipse(cx, y, w, w * 0.18, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(236,254,255,0.5)'; ctx.lineWidth = Math.max(1, w * 0.012);
    const r = (t * 0.02) % 1;
    ctx.beginPath(); ctx.ellipse(cx, y, w * r, w * 0.18 * r, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(244,114,182,0.25)'; ctx.fillRect(cx - w * 0.2, y - w * 0.05, w * 0.4, w * 0.04);
  }
}

function drawOrb(ob, e, t, alpha) {
  const pxu = e.s1 * W / 2, r = Math.max(2, pxu * 170), cx = e.X1 + ob.x * e.W1, cy = e.Y1 - pxu * 420 + Math.sin(t * 0.1 + e.seg.i) * pxu * 60;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  g.addColorStop(0, `rgba(236,254,255,${alpha})`); g.addColorStop(0.35, `rgba(34,211,238,${0.7 * alpha})`); g.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
}

function drawFireball(fb, e, t) {
  const cx = e.X1 + fb.x * e.W1, w = Math.max(4, e.W1 * 0.16), h = Math.max(2, w * 0.3);
  const flick = 0.75 + Math.sin(t * 0.3 + cx) * 0.25;
  ctx.globalAlpha = flick;
  ctx.fillStyle = fb.hex ? '#a855f7' : '#f97316';
  ctx.beginPath(); ctx.ellipse(cx, e.Y1, w, h, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fb.hex ? '#f0abfc' : '#fde68a';
  ctx.beginPath(); ctx.ellipse(cx, e.Y1 - h * 0.6, w * 0.45, h * 1.2, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPlayer(t, theme) {
  const unit = (CAM_DEPTH / PLAYER_Z) * W / 2;
  const ratio = player.speed / player.maxSpeed;
  const bob = player.air > 0 ? 0 : Math.sin(t * 0.9) * ratio * 1.2 + (player.offroad ? (Math.random() - 0.5) * 3 : 0);
  const y = CAR_BOTTOM - player.airHeight + bob;
  const x = W / 2;

  // headlights sweep the road ahead
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(0, y - 60, 0, H / 2 + 20);
  beam.addColorStop(0, 'rgba(254,249,195,0.16)'); beam.addColorStop(1, 'rgba(254,249,195,0)');
  ctx.fillStyle = beam;
  const lean = player.steerVis * 60;
  ctx.beginPath(); ctx.moveTo(x - 90, y - 60); ctx.lineTo(x + 90, y - 60); ctx.lineTo(x + 260 + lean, H / 2 + 30); ctx.lineTo(x - 260 + lean, H / 2 + 30); ctx.fill();
  // underglow
  // squashed to an ellipse so it fades out inside its fill instead of ending in a hard box
  ctx.translate(x, y); ctx.scale(1, 40 / 150);
  const ug = ctx.createRadialGradient(0, 0, 0, 0, 0, 150);
  ug.addColorStop(0, player.nitroOn ? 'rgba(56,189,248,0.55)' : 'rgba(168,85,247,0.45)'); ug.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = ug; ctx.fillRect(-150, -150, 300, 300);
  ctx.restore();

  if (player.airHeight > 0) {        // shadow left on the road while airborne
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, CAR_BOTTOM, 110 - player.airHeight * 0.3, 14, 0, 0, 7); ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  if (player.spin > 0) ctx.rotate(Math.sin(player.spin * 0.45) * 0.35);
  else ctx.rotate(player.steerVis * 0.03);
  const width = drawCarSprite(ctx, 'player', 0, 0, unit, player.steerVis, player.braking);

  // exhaust: flames while on the gas, a blue lance on nitro
  const pipes = [-width * 0.32, width * 0.32];
  if ((player.gas || player.nitroOn) && player.speed > 300 && !finishing) {
    pipes.forEach(px => {
      const len = player.nitroOn ? 44 + Math.random() * 20 : 12 + Math.random() * 10;
      const g = ctx.createLinearGradient(0, -width * 0.11, 0, -width * 0.11 + len);
      g.addColorStop(0, player.nitroOn ? '#e0f2fe' : '#fde68a'); g.addColorStop(0.4, player.nitroOn ? '#38bdf8' : '#f97316'); g.addColorStop(1, 'rgba(249,115,22,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(px - 7, -width * 0.11); ctx.lineTo(px + 7, -width * 0.11); ctx.lineTo(px + (Math.random() - 0.5) * 6, -width * 0.11 + len); ctx.closePath(); ctx.fill();
    });
  }
  ctx.restore();

  if (player.nitroOn) {               // speed lines
    ctx.strokeStyle = 'rgba(224,242,254,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const a = (i * 2.4 + t * 0.7) % (Math.PI * 2), r1 = 260 + ((t * 37 + i * 50) % 220);
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1 * 0.6); ctx.lineTo(W / 2 + Math.cos(a) * (r1 + 90), H / 2 + Math.sin(a) * (r1 + 90) * 0.6); ctx.stroke();
    }
  }
}

function drawFx() {
  fx.forEach(p => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 20));
    ctx.fillStyle = p.color;
    if (p.spark) ctx.fillRect(p.x, p.y, 3, 3);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.globalAlpha = 1;
}

/* Weather drifts with speed. Visual only — never touches the rules. */
function drawWeather(theme, t) {
  const kind = theme.weather, ratio = player.speed / player.maxSpeed;
  const count = kind === 'rain' ? 140 : kind === 'mist' ? 10 : 50;
  if (weatherBits.kind !== kind) { weatherBits = Array.from({ length: count }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() })); weatherBits.kind = kind; }
  if (kind === 'rain' && track.segments[Math.floor(((cameraZ() + PLAYER_Z) % track.length) / SEG_LEN)].tunnel) return;
  weatherBits.forEach(b => {
    if (kind === 'rain') {
      b.y += 14 * b.s; b.x -= (2 + ratio * 8) * b.s * ((b.x - W / 2) / W) * -1;
      ctx.strokeStyle = 'rgba(191,219,254,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 2, b.y - 14 * b.s); ctx.stroke();
    } else if (kind === 'leaves') {
      b.y += 1.2 * b.s; b.x += Math.sin(t * 0.03 + b.s * 9) * 1.2 + (b.x - W / 2) * ratio * 0.01;
      ctx.fillStyle = b.s > 1 ? 'rgba(180,83,9,0.8)' : 'rgba(101,163,13,0.7)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 4, 2, t * 0.05 + b.s, 0, 7); ctx.fill();
    } else if (kind === 'embers') {
      b.y -= 1.4 * b.s; b.x += Math.sin(t * 0.05 + b.s * 7) * 0.8 + (b.x - W / 2) * ratio * 0.012;
      ctx.fillStyle = `rgba(251,146,60,${0.5 + 0.4 * Math.sin(t * 0.2 + b.s * 5)})`; ctx.fillRect(b.x, b.y, 2.5, 2.5);
    } else {
      b.x += (0.3 + ratio * 2) * b.s;
      ctx.fillStyle = 'rgba(216,180,254,0.05)'; ctx.beginPath(); ctx.ellipse(b.x, H / 2 + 40 + b.s * 60, 220, 30, 0, 0, 7); ctx.fill();
    }
    if (b.y > H + 10) { b.y = -10; b.x = Math.random() * W; }
    if (b.y < -10) { b.y = H + 5; b.x = Math.random() * W; }
    if (b.x > W + 240) b.x = -240;
    if (b.x < -240) b.x = W + 240;
  });
}

function drawBats(t) {
  const a = Math.min(1, batSwarm / 30) * 0.75;
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(8,2,14,${a})`);
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(20,8,30,${a})`;
  for (let i = 0; i < 16; i++) {
    const k = t * 0.06 + i * 1.7, bx = W / 2 + Math.cos(k) * W * 0.42, by = H / 2 + Math.sin(k * 1.3) * H * 0.38, f = Math.sin(t * 0.5 + i) * 5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 12, by - 4 - f); ctx.lineTo(bx - 5, by + 2); ctx.lineTo(bx, by + 3); ctx.lineTo(bx + 5, by + 2); ctx.lineTo(bx + 12, by - 4 - f); ctx.fill();
  }
}

/* ---------------------------- HUD ---------------------------- */
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,4,16,0.62)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(192,132,252,0.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawHud(theme, t) {
  ctx.textBaseline = 'alphabetic';
  if (!gameRunning && !finishing) return;
  const place = racePosition(), total = opponents.length + 1;

  // position + lap
  panel(12, 12, 150, 70);
  ctx.textAlign = 'left';
  ctx.fillStyle = place === 1 ? '#fde68a' : '#f5f3ff';
  ctx.font = 'bold 38px "Segoe UI", system-ui, sans-serif'; ctx.fillText(ordinal(place), 22, 54);
  ctx.font = '600 14px "Segoe UI", sans-serif'; ctx.fillStyle = '#a78bfa'; ctx.fillText('/ ' + total, 98, 54);
  ctx.fillStyle = '#e9d5ff'; ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillText(`LAP ${Math.min(player.lap, LAPS)} / ${LAPS}`, 22, 74);

  // race + track title
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,4,16,0.7)'; ctx.fillRect(W / 2 - 200, 8, 400, 20);
  ctx.font = '600 12px "Segoe UI", sans-serif'; ctx.fillStyle = rgba(theme.glow, 0.95);
  ctx.fillText(`RACE ${race} · ${theme.name}${race >= 2 ? ' · HAZARDS' : ''}${race >= 4 ? ' · POWERS' : ''}`, W / 2, 22);

  // minimap
  const mx = W - 142, my = 14, mw = 128, mh = 100;
  panel(mx - 6, my - 2, mw + 12, mh + 8);
  const map = track.map, sc = Math.min(mw, mh) * 0.9;
  ctx.strokeStyle = rgba(theme.glow, 0.85); ctx.lineWidth = 3; ctx.beginPath();
  map.forEach(([px, py], i) => (i ? ctx.lineTo(mx + mw / 2 + px * sc, my + mh / 2 + py * sc) : ctx.moveTo(mx + mw / 2 + px * sc, my + mh / 2 + py * sc)));
  ctx.closePath(); ctx.stroke();
  const dot = (z, color, r) => {
    const f = (((z % track.length) + track.length) % track.length) / track.length, p = map[Math.floor(f * map.length) % map.length];
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + mw / 2 + p[0] * sc, my + mh / 2 + p[1] * sc, r, 0, 7); ctx.fill();
  };
  opponents.forEach(o => dot(o.totalZ, o.tag, 3));
  dot(player.totalZ, '#ffffff', 4.5);

  // speedometer
  const gx = 92, gy = H - 58, gr = 58, ratio = player.speed / player.maxSpeed;
  ctx.fillStyle = 'rgba(8,4,16,0.62)'; ctx.beginPath(); ctx.arc(gx, gy, gr + 10, Math.PI, 0); ctx.lineTo(gx + gr + 10, gy + 30); ctx.lineTo(gx - gr - 10, gy + 30); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#2e1065'; ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = ratio > 0.9 ? '#f472b6' : '#a855f7'; ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI, Math.PI + Math.PI * Math.min(1, ratio)); ctx.stroke();
  const na = Math.PI + Math.PI * Math.min(1.08, ratio);
  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(na) * (gr - 6), gy + Math.sin(na) * (gr - 6)); ctx.stroke();
  ctx.fillStyle = '#f5f3ff'; ctx.textAlign = 'center'; ctx.font = 'bold 22px "Segoe UI", sans-serif';
  ctx.fillText(String(Math.round(ratio * 120 * (player.nitroOn ? 1.2 : 1))), gx, gy + 4);
  ctx.font = '600 10px "Segoe UI", sans-serif'; ctx.fillStyle = '#a78bfa'; ctx.fillText('MPH', gx, gy + 17);
  // nitro bar
  ctx.fillStyle = '#0c1a2e'; ctx.fillRect(gx - 60, gy + 22, 120, 8);
  ctx.fillStyle = player.nitro >= NITRO_MIN ? (player.nitroOn ? '#e0f2fe' : '#38bdf8') : '#1e3a5f';
  ctx.fillRect(gx - 60, gy + 22, 120 * player.nitro / 100, 8);
  ctx.font = '600 9px "Segoe UI", sans-serif'; ctx.fillStyle = '#7dd3fc'; ctx.fillText('NITRO · SPACE', gx, gy + 40);

  // time / score
  panel(W - 150, H - 62, 138, 50);
  ctx.textAlign = 'right'; ctx.fillStyle = '#f5f3ff'; ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillText(fmtTime(raceTime), W - 22, H - 38);
  ctx.font = '600 11px "Segoe UI", sans-serif'; ctx.fillStyle = '#c4b5fd';
  ctx.fillText(`SCORE ${cruiseScore + raceBonus}`, W - 22, H - 20);

  // status messages
  ctx.textAlign = 'center';
  const pulse = 0.6 + Math.sin(t * 0.3) * 0.4;
  if (scramble > 0) { ctx.fillStyle = `rgba(165,243,252,${pulse})`; ctx.font = 'bold 26px "Segoe UI", sans-serif'; ctx.fillText('HAUNTED CONTROLS', W / 2, 96); }
  else if (player.spin > 0) { ctx.fillStyle = `rgba(252,165,165,${pulse})`; ctx.font = 'bold 26px "Segoe UI", sans-serif'; ctx.fillText('SPIN OUT!', W / 2, 96); }
  else if (player.air > 0) { ctx.fillStyle = `rgba(240,171,252,${pulse})`; ctx.font = 'bold 24px "Segoe UI", sans-serif'; ctx.fillText('AIRBORNE', W / 2, 96); }
  else if (player.drafting > 20) { ctx.fillStyle = `rgba(125,211,252,${pulse})`; ctx.font = 'bold 18px "Segoe UI", sans-serif'; ctx.fillText('SLIPSTREAM', W / 2, 96); }
  if (player.lap === LAPS && !finishing && lapFlash > 0) { ctx.fillStyle = `rgba(253,230,138,${Math.min(1, lapFlash / 20)})`; ctx.font = 'bold 34px "Segoe UI", sans-serif'; ctx.fillText('FINAL LAP', W / 2, 150); }
  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = p.color; ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillText(p.text, W / 2 + p.dx, H - 150 - (60 - p.life));
  });
  ctx.globalAlpha = 1;

  // start lights + title during the countdown (the race is frozen underneath)
  if (countdown > 0) {
    ctx.fillStyle = 'rgba(5,3,12,0.55)'; ctx.fillRect(0, 118, W, 150);
    ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 38px "Segoe UI", system-ui, sans-serif'; ctx.fillText(theme.name, W / 2, 162);
    ctx.fillStyle = '#fde68a'; ctx.font = '600 15px "Segoe UI", sans-serif'; ctx.fillText(theme.sub + (cycle ? ` · Series ${cycle + 1}` : ''), W / 2, 186);
    const lit = 3 - Math.ceil(countdown / 60) + 1;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.arc(W / 2 - 60 + k * 60, 228, 22, 0, 7); ctx.fill();
      ctx.fillStyle = k < lit ? '#ef4444' : '#3f1d1d'; ctx.beginPath(); ctx.arc(W / 2 - 60 + k * 60, 228, 16, 0, 7); ctx.fill();
    }
  } else if (raceTime < 60) {
    ctx.fillStyle = '#4ade80'; ctx.font = 'bold 84px "Segoe UI", system-ui, sans-serif';
    ctx.globalAlpha = Math.max(0, 1 - raceTime / 60); ctx.fillText('GO!', W / 2, H / 2 - 40); ctx.globalAlpha = 1;
  }

  if (finishing) {
    ctx.fillStyle = 'rgba(5,3,12,0.5)'; ctx.fillRect(0, H / 2 - 90, W, 120);
    ctx.fillStyle = finishPlace === 1 ? '#fde68a' : '#e9d5ff'; ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(finishPlace === 1 ? 'VICTORY!' : `${ordinal(finishPlace).toUpperCase()} PLACE`, W / 2, H / 2 - 30);
    ctx.fillStyle = '#c4b5fd'; ctx.font = '600 16px "Segoe UI", sans-serif'; ctx.fillText(`${fmtTime(raceTime)} · ${theme.name.toLowerCase()}`, W / 2, H / 2 + 2);
    if (typeof HeroKit !== 'undefined') {   // the Spaceman, out of the hearse: a victory pose, or catching his breath
      const k = FINISH_FRAMES - finishing;
      HeroKit.spaceman(ctx, W / 2 - 250, H / 2 + 26, { pose: finishPlace === 1 ? 'victory' : 'idle', phase: k * 0.1, face: 1, scale: 1.1 });
    }
  }
  if (paused) {
    ctx.fillStyle = 'rgba(5,3,12,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 44px "Segoe UI", sans-serif'; ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '600 15px "Segoe UI", sans-serif'; ctx.fillStyle = '#c4b5fd'; ctx.fillText('P / Esc to resume', W / 2, H / 2 + 28);
  }
}
