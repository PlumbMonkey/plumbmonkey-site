// ============================================================
// REVENGER — the runner: the Spaceman on foot inside a mothership.
// A rescue run frees fans from stasis pods against the clock; the core run
// ends in Plumbmonkey's arena. Pure rules (seeded rng); art is runner-art.js.
// ============================================================

const FLOOR_Y = 470, CEIL_Y = 150;
const RUN_GRAV = 0.7, RUN_JUMP = 12.6, RUN_SPEED = 4.4, RUN_ACC = 0.55;
const COYOTE_F = 6, JUMP_BUF_F = 6, SLIDE_F = 34, SLIDE_V = 6.4;
const P_W = 22, P_H = 58, P_LOW = 26, BOLT_V = 15, BLAST_GAP = 6;
const RESCUE_TIME = 80 * 60, CORE_TIME = 100 * 60, RUN_HP = 3;
const PM_HP = 30, PM_W = 26, PM_H = 116;
const FOE = {
  frank:    { hp: 3, w: 34, h: 70, pts: 300 },
  ghost:    { hp: 1, w: 30, h: 44, pts: 200 },
  witch:    { hp: 2, w: 30, h: 70, pts: 400 },
  werewolf: { hp: 2, w: 36, h: 62, pts: 400 },
  vampire:  { hp: 2, w: 34, h: 60, pts: 400 },
  mutant:   { hp: 1, w: 26, h: 40, pts: 150 }
};

function createRun(kind) {
  const r = {
    kind, t: 0, timer: kind === 'core' ? CORE_TIME : RESCUE_TIME, phase: 'intro', phaseT: 120,
    camX: 0, solids: [], gates: [], pods: [], foes: [], bolts: [], shots: [], hearts: [], waves: [], barrels: [],
    freed: 0, podsTotal: 0, boss: null, arenaX: 0, exitX: 0, length: 0, lockCam: false, result: null, why: '',
    p: { x: 120, y: FLOOR_Y, vx: 0, vy: 0, face: 1, ground: true, coyote: 0, buf: 0, slideT: 0, duck: false,
      hp: RUN_HP, inv: 0, shootCd: 0, queued: false, shootT: 0, dist: 0, upWas: false, safeX: 120, safeY: FLOOR_Y, land: 0 },
    pilot: { upHold: 0, fireGap: 0 }
  };
  buildRunLevel(r);
  return r;
}

function buildRunLevel(r) {
  const sIdx = r.kind === 'core' ? 3 : info.sectorIdx;
  const floor = (x0, w) => r.solids.push({ x: x0, y: FLOOR_Y, w, h: 200 });
  const foe = (kind, fx, minX, maxX, extra) => r.foes.push(Object.assign({
    id: ++nextId, kind, x: fx, y: FLOOR_Y, home: fx, minX, maxX, vx: 0, vy: 0, hp: FOE[kind].hp,
    t: Math.floor(rng() * 100), face: -1, dir: -1, state: 'idle', st: 0, flash: 0, dead: false, baseY: FLOOR_Y
  }, extra || {}));
  const pool = ['flat', 'gap', 'steps', 'lowgate', 'highgate', 'platforms'];
  if (sIdx >= 1) pool.push('pulse', 'witch');
  if (sIdx >= 2) pool.push('werewolf');
  if (sIdx >= 3) pool.push('vampire');
  const n = r.kind === 'core' ? 9 : 11 + sIdx;
  const seq = [];
  for (let i = 0; i < n; i++) seq.push(pool[Math.floor(rng() * pool.length)]);
  if (r.kind === 'rescue') [1, 3, 5, 7, 9].forEach(i => { seq[i] = 'pod'; });
  const walker = () => (sIdx === 0 ? 'frank' : rng() < 0.5 ? 'frank' : 'mutant');

  floor(0, 520);
  let x = 520;
  seq.forEach(k => {
    switch (k) {
      case 'flat': floor(x, 380); foe(walker(), x + 220, x + 40, x + 340); x += 380; break;
      case 'gap': { const g = 80 + Math.min(30, sIdx * 10); floor(x, 180); floor(x + 180 + g, 180); x += 360 + g; break; }
      case 'steps':
        floor(x, 480);
        r.solids.push({ x: x + 110, y: FLOOR_Y - 56, w: 120, h: 56 }, { x: x + 230, y: FLOOR_Y - 104, w: 110, h: 104 });
        if (rng() < 0.4) r.hearts.push({ x: x + 285, y: FLOOR_Y - 150, taken: false });
        x += 480; break;
      case 'lowgate': floor(x, 380); r.gates.push({ x: x + 200, kind: 'low', y0: CEIL_Y, y1: FLOOR_Y - 34 }); x += 380; break;
      case 'highgate': floor(x, 380); r.gates.push({ x: x + 200, kind: 'high', y0: FLOOR_Y - 36, y1: FLOOR_Y }); x += 380; break;
      case 'pulse':
        floor(x, 400);
        r.gates.push({ x: x + 220, kind: 'pulse', y0: CEIL_Y, y1: FLOOR_Y, period: 150, on: 80, off0: Math.floor(rng() * 150) });
        x += 400; break;
      case 'platforms':          // spaced so a full jump from each ledge lands mid-platform
        floor(x, 120);
        r.solids.push({ x: x + 190, y: FLOOR_Y - 40, w: 120, h: 16 }, { x: x + 410, y: FLOOR_Y - 60, w: 110, h: 16 });
        floor(x + 580, 200);
        if (rng() < 0.35) r.hearts.push({ x: x + 465, y: FLOOR_Y - 110, taken: false });
        x += 780; break;
      case 'pod':
        floor(x, 400);
        r.pods.push({ id: ++nextId, x: x + 250, y: FLOOR_Y, hp: 3, fans: 2, open: false, flash: 0, look: r.pods.length });
        r.podsTotal++;
        if (rng() < 0.6) foe('ghost', x + 340, x, x + 400, { y: FLOOR_Y - 100, baseY: FLOOR_Y - 100 });
        x += 400; break;
      case 'witch':
        floor(x, 440);
        r.solids.push({ x: x + 260, y: FLOOR_Y - 90, w: 110, h: 90 });
        foe('witch', x + 355, x + 340, x + 365, { y: FLOOR_Y - 90, baseY: FLOOR_Y - 90 });
        x += 440; break;
      case 'werewolf': floor(x, 460); foe('werewolf', x + 330, x + 40, x + 430); x += 460; break;
      case 'vampire': floor(x, 420); foe('vampire', x + 300, x, x + 420, { y: FLOOR_Y - 170, baseY: FLOOR_Y - 170 }); x += 420; break;
    }
  });
  if (r.kind === 'rescue') { floor(x, 620); r.exitX = x + 440; r.length = x + 620; }
  else { floor(x, 300 + W); r.arenaX = x + 300; r.length = x + 300 + W; }
}

// ---------- geometry helpers ----------
function runnerH(p) { return p.slideT > 0 || p.duck ? P_LOW : P_H; }
function boxHit(ax, ay, aw, ah, s) { return ax < s.x + s.w && ax + aw > s.x && ay < s.y + s.h && ay + ah > s.y; }
function playerBox(p) { const h = runnerH(p); return [p.x - P_W / 2, p.y - h, P_W, h]; }
function roomToStand(r, p) { return !r.solids.some(s => boxHit(p.x - P_W / 2, p.y - P_H, P_W, P_H - 1, s)); }
function groundUnder(r, x, y) { return r.solids.some(s => x >= s.x && x <= s.x + s.w && Math.abs(s.y - y) < 2); }

function endRun(r, result, why) {
  if (r.result) return;
  r.result = result; r.why = why;
  r.phase = 'result'; r.phaseT = 120;
  r.shots = []; r.waves = []; r.barrels = [];
  if (result === 'success') sfx.rescue(); else sfx.hit();
}

function hurtRunner(r, fell) {
  const p = r.p;
  if (r.result) return;
  if (fell) { p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0; p.slideT = 0; }   // always climb back out, even while flashing
  if (p.inv > 0) return;
  p.hp--; p.inv = 75;
  FX.explode(p.x, p.y - 30, 1, ['#ffffff', '#fb7185', '#eef0f2']);
  FX.shake(6, 12);
  sfx.hit();
  if (!fell) { p.vx = -p.face * 3; p.vy = Math.min(p.vy, -5); p.slideT = 0; }
  if (p.hp <= 0) { FX.shipDeath(p.x, p.y - 30); endRun(r, 'fail', 'SPACEMAN DOWN'); }
}

// ---------- the step ----------
function stepRun(r, inp) {
  r.t++;
  if (r.phase === 'intro') { runCamera(r); if (--r.phaseT <= 0) r.phase = 'go'; return; }
  if (r.phase === 'result') { r.phaseT--; runCamera(r); return; }
  if (!r.boss) { r.timer--; if (r.timer <= 0) { r.timer = 0; endRun(r, 'fail', 'TIME UP'); return; } }
  stepRunner(r, inp);
  stepRunBolts(r);
  stepFoes(r);
  stepRunShots(r);
  if (r.boss) stepPM(r, r.boss);
  if (r.result) return;
  runHazards(r);
  const p = r.p;
  r.hearts.forEach(h => {
    if (!h.taken && Math.abs(h.x - p.x) < 20 && h.y > p.y - P_H - 10 && h.y < p.y + 10) { h.taken = true; p.hp = Math.min(RUN_HP, p.hp + 1); sfx.pickup(); FX.popup(h.x, h.y - 20, '+1 HEALTH', '#fb7185'); }
  });
  if (r.kind === 'rescue' && p.x >= r.exitX) endRun(r, 'success', r.freed ? `${r.freed} FANS FREED` : 'ESCAPED EMPTY-HANDED');
  if (r.kind === 'core' && !r.boss && p.x >= r.arenaX + 90) {
    r.lockCam = true;
    r.foes.forEach(f => { f.dead = true; });
    r.boss = createPM(r);
    sfx.boss();
  }
  runCamera(r);
}

function runCamera(r) {
  const p = r.p;
  const target = r.lockCam ? r.arenaX : Math.max(0, Math.min(r.length - W, p.x - W * 0.35));
  r.camX += (target - r.camX) * (r.lockCam ? 0.1 : 0.25);
}

function stepRunner(r, inp) {
  const p = r.p;
  const jumpEdge = inp.up && !p.upWas;
  p.upWas = inp.up;
  if (p.inv > 0) p.inv--;
  if (p.shootCd > 0) p.shootCd--;
  if (p.shootT > 0) p.shootT--;
  if (p.land > 0) p.land--;
  const dirIn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

  if (p.slideT > 0) {
    p.slideT--;
    p.vx = p.face * SLIDE_V * (0.55 + 0.45 * p.slideT / SLIDE_F);
    if (p.slideT === 0 && !roomToStand(r, p)) p.slideT = 1;
    if (!p.ground) p.slideT = 0;
  } else {
    if (dirIn) p.face = dirIn;
    p.duck = !!inp.down && p.ground && !dirIn;
    const target = p.duck ? 0 : dirIn * RUN_SPEED;
    p.vx += Math.max(-RUN_ACC, Math.min(RUN_ACC, target - p.vx));
    if (inp.down && p.ground && dirIn && Math.abs(p.vx) > 2) { p.slideT = SLIDE_F; p.duck = false; sfx.slide(); }
  }

  p.buf = jumpEdge ? JUMP_BUF_F : Math.max(0, p.buf - 1);
  if (p.buf > 0 && (p.ground || p.coyote > 0) && roomToStand(r, p)) {
    p.vy = -RUN_JUMP; p.ground = false; p.coyote = 0; p.buf = 0; p.slideT = 0; p.duck = false;
    sfx.jump();
  }
  if (!inp.up && p.vy < -5) p.vy = -5;
  p.vy = Math.min(14, p.vy + RUN_GRAV);

  const h = runnerH(p);
  p.x += p.vx;
  for (const s of r.solids) {
    if (!boxHit(p.x - P_W / 2, p.y - h, P_W, h, s)) continue;
    if (p.vx > 0) p.x = s.x - P_W / 2; else if (p.vx < 0) p.x = s.x + s.w + P_W / 2;
    p.vx = 0;
  }
  const wasGround = p.ground;
  const prevY = p.y;
  p.y += p.vy;
  p.ground = false;
  for (const s of r.solids) {
    if (!boxHit(p.x - P_W / 2, p.y - h, P_W, h, s)) continue;
    if (p.vy >= 0 && prevY <= s.y + 0.01) { p.y = s.y; p.vy = 0; p.ground = true; }
    else if (p.vy < 0) { p.y = s.y + s.h + h; p.vy = 0; }
  }
  if (p.ground) {
    p.coyote = COYOTE_F;
    if (!wasGround) p.land = 8;
    if (groundUnder(r, p.x - 26, p.y) && groundUnder(r, p.x + 26, p.y)) { p.safeX = p.x; p.safeY = p.y; }
  } else if (p.coyote > 0) p.coyote--;

  const minX = r.lockCam ? r.arenaX + 20 : 20, maxX = r.lockCam ? r.arenaX + W - 20 : r.length - 20;
  p.x = Math.max(minX, Math.min(maxX, p.x));
  p.dist += Math.abs(p.vx);
  if (p.y > FLOOR_Y + 200) hurtRunner(r, true);

  if (inp.fire) p.queued = true;
  if (p.queued && p.shootCd <= 0) {
    p.queued = false; p.shootCd = BLAST_GAP; p.shootT = 14;
    shotsFired++;
    const low = p.slideT > 0 || p.duck;
    r.bolts.push({ id: ++nextId, x: p.x + p.face * 22, y: p.y - (low ? 16 : 36), vx: p.face * BOLT_V, life: 60, dead: false });
    sfx.blaster();
  }
  if (inp.bomb) runBomb(r);
}

function onRunScreen(r, x, m = 0) { return x > r.camX - m && x < r.camX + W + m; }

function runBomb(r) {
  if (ship.bombs <= 0 || ship.bombCd > 0) return;
  ship.bombs--; ship.bombCd = 40;
  sfx.chord(); FX.flash(0.8, '#f472b6'); FX.shake(12, 30);
  r.foes.forEach(f => { if (!f.dead && onRunScreen(r, f.x, 20)) killFoe(r, f); });
  r.shots = []; r.barrels = []; r.waves = [];
  const b = r.boss;
  if (b && !b.dying && b.state !== 'intro') damagePM(r, b, pmOpen(b) ? 3 : 1);
}

function stepRunBolts(r) {
  r.bolts.forEach(b => {
    b.x += b.vx; b.life--;
    if (b.life <= 0 || !onRunScreen(r, b.x, 40)) { b.dead = true; return; }
    if (r.solids.some(s => b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h)) { b.dead = true; FX.spark(b.x, b.y, '#a5f3fc'); return; }
    for (const br of r.barrels) if (!br.dead && Math.hypot(b.x - br.x, b.y - br.y) < 18) { b.dead = br.dead = true; FX.explode(br.x, br.y, 2); addScore(100, br.x, br.y - 20); return; }
    if (r.boss && boltHitsPM(r, r.boss, b)) return;
    for (const pd of r.pods) {
      if (pd.open || Math.abs(b.x - pd.x) > 24 || b.y < pd.y - 76 || b.y > pd.y) continue;
      b.dead = true; pd.hp--; pd.flash = 6; sfx.clang();
      if (pd.hp <= 0) {
        pd.open = true; pd.openT = r.t; r.freed += pd.fans;
        addScore(1000, pd.x, pd.y - 90, 'FANS FREED');
        FX.explode(pd.x, pd.y - 40, 2, ['#a5f3fc', '#f0abfc', '#ffffff']);
        sfx.pod();
      }
      return;
    }
    for (const f of r.foes) {
      const d = FOE[f.kind];
      if (f.dead || Math.abs(b.x - f.x) > d.w / 2 + 4 || b.y < f.y - d.h || b.y > f.y) continue;
      b.dead = true; f.hp--; f.flash = 6;
      if (f.hp <= 0) killFoe(r, f); else sfx.clang();
      return;
    }
  });
  r.bolts = r.bolts.filter(b => !b.dead);
}

function killFoe(r, f) {
  if (f.dead) return;
  f.dead = true;
  addScore(FOE[f.kind].pts, f.x, f.y - FOE[f.kind].h - 10);
  FX.explode(f.x, f.y - FOE[f.kind].h / 2, 2, ['#c084fc', '#86efac', '#ffffff', '#fde68a']);
  sfx.explode(2, 0);
}

function stepFoes(r) {
  const p = r.p;
  r.foes.forEach(f => {
    if (f.dead) return;
    f.t++; if (f.flash > 0) f.flash--;
    const dx = p.x - f.x, near = Math.abs(dx) < W * 0.7;
    f.face = dx < 0 ? -1 : 1;
    switch (f.kind) {
      case 'frank':
        f.x += f.dir * 0.8;
        if (f.x < f.minX || f.x > f.maxX) { f.dir = -f.dir; f.x = Math.max(f.minX, Math.min(f.maxX, f.x)); }
        f.face = f.dir;
        break;
      case 'mutant':
        if (near && f.y >= f.baseY && f.t % 50 === 0) { f.vy = -7; f.vx = Math.sign(dx) * 2.4; }
        f.vy += 0.5; f.y += f.vy; f.x += f.vx;
        if (f.y >= f.baseY) { f.y = f.baseY; f.vy = 0; f.vx *= 0.8; }
        f.x = Math.max(f.minX, Math.min(f.maxX, f.x));
        break;
      case 'ghost':
        if (near) f.x += Math.sign(dx) * 0.7;
        f.x = Math.max(f.minX - 200, Math.min(f.maxX + 200, f.x));
        f.y = f.baseY + Math.sin(f.t * 0.05) * 22;
        break;
      case 'witch':
        if (near && f.t % 110 === 0) {
          r.shots.push({ x: f.x, y: f.y - 60, vx: Math.max(-6, Math.min(6, dx / 45)), vy: -8, g: 0.36, r: 8, kind: 'potion', dead: false });
        }
        break;
      case 'werewolf':
        if (f.state === 'idle' && Math.abs(dx) < 300 && f.t > f.st) { f.state = 'crouch'; f.st = f.t + 30; }
        else if (f.state === 'crouch' && f.t >= f.st) { f.state = 'leap'; f.vx = Math.sign(dx) * 6.5; f.vy = -9; }
        else if (f.state === 'leap') {
          f.vy += 0.5; f.y += f.vy; f.x = Math.max(f.minX, Math.min(f.maxX, f.x + f.vx));
          if (f.y >= f.baseY) { f.y = f.baseY; f.vy = 0; f.state = 'idle'; f.st = f.t + 90; }
        }
        break;
      case 'vampire':
        if (f.state === 'idle') {
          f.y = f.baseY + Math.sin(f.t * 0.04) * 10;
          if (Math.abs(dx) < 260 && f.t > f.st) { f.state = 'swoop'; f.tx = p.x; f.ty = p.y - 30; f.st = f.t + 70; }
        } else if (f.state === 'swoop') {
          const ddx = f.tx - f.x, ddy = f.ty - f.y, d = Math.hypot(ddx, ddy) || 1;
          f.x += (ddx / d) * 5; f.y += (ddy / d) * 5;
          if (d < 8 || f.t > f.st) { f.state = 'rise'; f.st = f.t + 150; }
        } else {
          f.y += Math.max(-3, f.baseY - f.y);
          if (Math.abs(f.y - f.baseY) < 1) f.state = 'idle';
        }
        f.x = Math.max(f.minX, Math.min(f.maxX, f.x));
        break;
    }
    const d = FOE[f.kind];
    if (boxHit(...playerBox(p), { x: f.x - d.w / 2, y: f.y - d.h, w: d.w, h: d.h })) hurtRunner(r);
  });
  r.foes = r.foes.filter(f => !f.dead);
}

function stepRunShots(r) {
  const p = r.p;
  r.shots.forEach(s => {
    s.vy += s.g; s.x += s.vx; s.y += s.vy;
    const landed = s.y >= FLOOR_Y || r.solids.some(o => s.x > o.x && s.x < o.x + o.w && s.y > o.y && s.y < o.y + o.h);
    const [bx, by, bw, bh] = playerBox(p);
    const hit = s.x > bx - s.r && s.x < bx + bw + s.r && s.y > by - s.r && s.y < by + bh + s.r;
    if (landed || hit) {
      s.dead = true;
      FX.explode(s.x, s.y, 1, ['#86efac', '#4ade80', '#bbf7d0']);
      if (hit || (Math.abs(s.x - p.x) < 36 && Math.abs(s.y - p.y) < 40)) hurtRunner(r);
    }
  });
  r.shots = r.shots.filter(s => !s.dead && s.y < FLOOR_Y + 300);
  r.barrels.forEach(b => {
    b.vy += 0.42; b.x += b.vx; b.y += b.vy; b.rot += b.vx * 0.08;
    if (b.y >= FLOOR_Y - 16) { b.y = FLOOR_Y - 16; if (!b.bounced) { b.vy = -4.5; b.bounced = true; } else b.vy = 0; }
    if (b.x < r.arenaX + 20 || b.x > r.arenaX + W - 20) { b.dead = true; FX.explode(b.x, b.y, 2); }
    const [bx, by, bw, bh] = playerBox(p);
    if (!b.dead && b.x > bx - 14 && b.x < bx + bw + 14 && b.y > by - 14 && b.y < by + bh + 14) { b.dead = true; FX.explode(b.x, b.y, 2); hurtRunner(r); }
  });
  r.barrels = r.barrels.filter(b => !b.dead);
  r.waves.forEach(w => {
    w.x += w.dir * 6.5; w.life--;
    if (w.x < r.arenaX + 10 || w.x > r.arenaX + W - 10) w.life = 0;
    if (Math.abs(p.x - w.x) < 16 && p.y > FLOOR_Y - 28) hurtRunner(r);
  });
  r.waves = r.waves.filter(w => w.life > 0);
}

function gateLive(r, g) { return g.kind !== 'pulse' || ((r.t + g.off0) % g.period) < g.on; }
function runHazards(r) {
  const p = r.p;
  if (p.inv > 0) return;
  for (const g of r.gates) {
    if (!gateLive(r, g) || Math.abs(p.x - g.x) > P_W / 2 + 4) continue;
    const top = p.y - runnerH(p);
    if (p.y > g.y0 && top < g.y1) {
      const back = p.vx > 0.1 ? -1 : p.vx < -0.1 ? 1 : -p.face;
      hurtRunner(r);
      p.x = g.x + back * (P_W / 2 + 12);
      return;
    }
  }
}

// ---------- Plumbmonkey ----------
const PM_ATTACKS = ['throw', 'command', 'stomp'];
function createPM(r) {
  const hp = Math.round(PM_HP * info.mult);
  return { x: r.arenaX + W * 0.74, y: FLOOR_Y, vy: 0, hp, maxHp: hp, state: 'intro', t: 0, face: -1,
    flash: 0, dying: 0, next: 0, thirds: 2, jx: 0 };
}
function pmGo(b, s) { b.state = s; b.t = 0; }
function pmOpen(b) { return b.state === 'taunt' || b.state === 'dizzy'; }
function pmRage(b) { return b.hp < b.maxHp * 0.4; }

function stepPM(r, b) {
  const p = r.p;
  b.t++;
  if (b.flash > 0) b.flash--;
  if (b.dying) {
    b.dying--;
    if (b.dying % 12 === 0) FX.explode(b.x + (Math.random() - 0.5) * 60, b.y - 40 - Math.random() * 70, 2, ['#b996e0', '#ffffff', '#fde68a']);
    if (b.dying === 0) endRun(r, 'success', 'PLUMBMONKEY DEFEATED');
    return;
  }
  const rage = pmRage(b);
  if (b.state !== 'stomp') b.face = p.x < b.x ? -1 : 1;
  switch (b.state) {
    case 'intro': if (b.t > 140) pmGo(b, 'idle'); break;
    case 'idle': if (b.t > (rage ? 35 : 60)) pmGo(b, PM_ATTACKS[b.next++ % PM_ATTACKS.length]); break;
    case 'throw': {
      const toss = () => r.barrels.push({ x: b.x + b.face * 20, y: b.y - 110, vx: Math.max(-7, Math.min(7, (p.x - b.x) / 55)), vy: -8, rot: 0, bounced: false, dead: false });
      if (b.t === 36) toss();
      if (rage && b.t === 62) toss();
      if (b.t > (rage ? 84 : 70)) pmGo(b, 'taunt');
      break;
    }
    case 'command':
      if (b.t === 25 && r.foes.length < 4) {
        const kinds = ['ghost', 'frank', 'mutant', 'ghost'];
        [-1, 1].forEach((side, i) => {
          const fx = side < 0 ? r.arenaX + 60 : r.arenaX + W - 60;
          const kind = kinds[(b.next + i) % kinds.length];
          r.foes.push({ id: ++nextId, kind, x: fx, y: kind === 'ghost' ? FLOOR_Y - 100 : FLOOR_Y, baseY: kind === 'ghost' ? FLOOR_Y - 100 : FLOOR_Y,
            home: fx, minX: r.arenaX + 40, maxX: r.arenaX + W - 40, vx: 0, vy: 0, hp: FOE[kind].hp, t: 0, face: -side, dir: -side,
            state: 'idle', st: 0, flash: 0, dead: false });
        });
      }
      if (b.t > 55) pmGo(b, 'taunt');
      break;
    case 'stomp':
      if (b.t === 20) { b.vy = -11; b.jx = Math.max(r.arenaX + 140, Math.min(r.arenaX + W - 140, p.x)); }
      if (b.t > 20) {
        b.x += (b.jx - b.x) * 0.06;
        b.vy += 0.55;
        b.y = Math.min(FLOOR_Y, b.y + b.vy);
        if (b.y >= FLOOR_Y && b.vy > 0) {
          b.y = FLOOR_Y; b.vy = 0;
          r.waves.push({ x: b.x - 40, dir: -1, life: 200 }, { x: b.x + 40, dir: 1, life: 200 });
          FX.shake(10, 20); sfx.explode(3, 0);
          pmGo(b, 'taunt');
        }
      }
      break;
    case 'taunt': if (b.t > (rage ? 80 : 105)) pmGo(b, 'idle'); break;
    case 'dizzy': if (b.t > 120) pmGo(b, 'idle'); break;
  }
  b.x = Math.max(r.arenaX + 60, Math.min(r.arenaX + W - 60, b.x));
  if (b.state !== 'dizzy' && boxHit(...playerBox(p), { x: b.x - PM_W, y: b.y - PM_H + 10, w: PM_W * 2, h: PM_H - 10 })) hurtRunner(r);
}

function boltHitsPM(r, b, bolt) {
  if (b.dying || Math.abs(bolt.x - b.x) > PM_W + 4 || bolt.y < b.y - PM_H || bolt.y > b.y) return false;
  bolt.dead = true;
  if (!pmOpen(b)) { FX.spark(bolt.x, bolt.y, '#b8b8c0'); sfx.clang(); return true; }   // the leather jacket shrugs it off
  damagePM(r, b, b.state === 'dizzy' ? 2 : 1);
  return true;
}

function damagePM(r, b, n) {
  b.hp -= n; b.flash = 6;
  FX.spark(b.x, b.y - 60, '#f0abfc');
  sfx.explode(1, 0);
  if (b.hp <= 0) {
    b.hp = 0; b.dying = 180; b.state = 'defeat'; b.t = 0;
    r.foes.forEach(f => { if (!f.dead) killFoe(r, f); });
    r.shots = []; r.barrels = []; r.waves = [];
    addScore(20000 * (info.cycle + 1), b.x, b.y - 140, 'PLUMBMONKEY DEFEATED');
    FX.flash(1); FX.shake(16, 60); sfx.explode(4, 0);
  } else if (b.thirds > 0 && b.hp <= b.maxHp * b.thirds / 3) {
    b.thirds--;
    pmGo(b, 'dizzy');
  }
}

// ---------- autopilot ----------
function runnerPilot(r) {
  const inp = { left: false, right: false, up: false, down: false, fire: false, bomb: false, warp: false };
  if (r.phase !== 'go') return inp;
  const p = r.p, bot = r.pilot;
  if (bot.fireGap > 0) bot.fireGap--;
  const jump = () => { if (bot.upHold <= 0 && !p.upWas) bot.upHold = 16; };
  const fireIf = ok => { if (ok && bot.fireGap <= 0) { inp.fire = true; bot.fireGap = 7; } };
  const boltY = p.y - (p.slideT > 0 || p.duck ? 16 : 36);

  if (r.boss) pmPilot(r, inp, jump, fireIf, boltY);
  else {
    inp.right = true;
    const pod = r.pods.find(pd => !pd.open && pd.x - p.x > 0 && pd.x - p.x < 300);
    if (pod) { fireIf(true); if (pod.x - p.x < 240) inp.right = false; }
    const foe = r.foes.filter(f => Math.abs(f.x - p.x) < 440 && boltY > f.y - FOE[f.kind].h && boltY < f.y).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (foe) {
      if ((foe.x - p.x) * p.face < 0) { inp.right = foe.x > p.x; inp.left = !inp.right; }
      fireIf((foe.x - p.x) * p.face > 0);
      if (Math.abs(foe.x - p.x) < 150 && (foe.kind === 'frank' || foe.kind === 'mutant' || foe.kind === 'werewolf')) inp.right = false;
    }
    const pg = r.gates.find(g => g.kind === 'pulse' && g.x - p.x > 0 && g.x - p.x < 75);
    if (pg) {
      const ph = (r.t + pg.off0) % pg.period;
      if (!(ph >= pg.on && pg.period - ph > 26)) inp.right = false;
    }
    if (p.ground && inp.right) {
      const ax = p.x + 30 + p.vx;
      const pit = !r.solids.some(s => ax >= s.x && ax <= s.x + s.w && s.y >= p.y - 1);   // a drop to a lower deck is a step, not a pit
      if (pit) jump();
      const wall = r.solids.some(s => {
        const gap = s.x - (p.x + P_W / 2), tall = p.y - s.y;
        return tall > 1 && gap > -2 && gap < (tall > 60 ? 58 : 30) && s.y + s.h > p.y - P_H;
      });
      if (wall) jump();
      if (r.gates.some(g => g.kind === 'high' && g.x - p.x > 30 && g.x - p.x < 58)) jump();
      if (r.gates.some(g => g.kind === 'low' && g.x - p.x > 40 && g.x - p.x < 95)) inp.down = true;
    }
    if (r.shots.some(s => Math.abs(s.x - p.x) < 60 && s.vy > 0) && p.ground) inp.right = true;
  }
  if (bot.upHold > 0) { inp.up = true; bot.upHold--; }
  if (inp.down && bot.upHold > 0) inp.down = false;
  return inp;
}

function pmPilot(r, inp, jump, fireIf, boltY) {
  const p = r.p, b = r.boss;
  const side = p.x < b.x ? -1 : 1;
  const wantX = Math.max(r.arenaX + 40, Math.min(r.arenaX + W - 40, b.x + side * 230));
  if (Math.abs(wantX - p.x) > 30) { if (wantX > p.x) inp.right = true; else inp.left = true; }
  else if ((b.x - p.x) * p.face < 0) { if (b.x > p.x) inp.right = true; else inp.left = true; }
  const threat = r.waves.some(w => Math.abs(w.x - p.x) < 60 && (p.x - w.x) * w.dir > 0)
    || r.barrels.some(br => Math.abs(br.x - p.x) < 70 && (p.x - br.x) * br.vx > 0 && br.y > FLOOR_Y - 40);
  if (threat && p.ground) jump();
  const minion = r.foes.find(f => Math.abs(f.x - p.x) < 400 && boltY > f.y - FOE[f.kind].h && boltY < f.y);
  if (minion && (minion.x - p.x) * p.face > 0) fireIf(true);
  if (pmOpen(b) && (b.x - p.x) * p.face > 0) fireIf(true);
  if (b.state === 'command' || (r.foes.length >= 3 && ship.bombs > 0 && p.hp <= 1)) inp.bomb = r.foes.length >= 3 && ship.bombs > 0;
}
