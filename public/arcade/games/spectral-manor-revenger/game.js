// ============================================================
// SPECTRAL MANOR REVENGER — rules, flow, input, autopilot, loop.
// Ghost Circuit / Plumbmonkey Media
// Load order: sectors.js → fx.js → ship.js → enemies.js → bosses.js → render.js → game.js
// ============================================================

const STEP = 1000 / 60;
const ENDING_FRAMES = 150;
const EXTRA_LIFE_FIRST = 20000, EXTRA_LIFE_EVERY = 60000;
const FANS_PER_SECTOR = 10;
const DAWDLE_FRAMES = 2400, BAITER_EVERY = 600;
const BEST_KEY = 'spectralArcade.revenger.best';
const PICKUP_INFO = {
  laser:   { label: 'LASER',   color: '#67e8f9', glyph: 'L' },
  bomb:    { label: 'CHORD',   color: '#f472b6', glyph: '♪' },
  shield:  { label: 'SHIELD',  color: '#fb7185', glyph: 'S' },
  option:  { label: 'OPTION',  color: '#e0f2fe', glyph: 'O' },
  tractor: { label: 'TRACTOR', color: '#5eead4', glyph: 'T' },
  warp:    { label: 'WARP',    color: '#a78bfa', glyph: 'W' }
};

let keys = {};
let score = 0, lives = 3, tick = 0, best = loadBest();
let gameRunning = false, gameOver = false, paused = false, botMode = false;
let phase = 'title', phaseT = 0, stageN = 0, info = stageInfo(0), rift = false;
let ship = newShip(), beams = [], enemies = [], enemyShots = [], mines = [], hazards = [], pickups = [], fans = [], boss = null;
let camX = 0, nextId = 0, hitPause = 0, combo = 0, comboT = 0, nextLife = EXTRA_LIFE_FIRST;
let shotsFired = 0, rescuedCount = 0, fansLost = 0, dawdleT = 0, baiterT = 0, clearBonus = 0;
let fireWasDown = false, fireLatch = false, bombWasDown = false, bombLatch = false, warpWasDown = false, warpLatch = false;
let banner = { text: '', sub: '' };
let run = null, mothership = null, dockKind = 'rescue', dockLen = 150, dockCool = 0, dockFrom = { x: 0, y: 0 };

function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
function isAttract() { return typeof Arcade !== 'undefined' && Arcade.attract; }
function groundY(x) { return terrainAt(info.sector, x); }
function toScreen(wx) {
  let r = (wx - camX) % WORLD_W;
  if (r < -WORLD_W / 2) r += WORLD_W;
  if (r > WORLD_W / 2) r -= WORLD_W;
  return r;
}
function onScreen(x, margin = 0) { const s = toScreen(x); return s > -margin && s < W + margin; }
function comboMult() { return Math.min(5, 1 + Math.floor(combo / 5)); }

function addScore(pts, x, y, label) {
  score += pts;
  if (x !== undefined) FX.popup(x, y, label ? `${label} +${pts}` : String(pts), label ? '#fde68a' : '#f0abfc');
  while (score >= nextLife) {
    nextLife += EXTRA_LIFE_EVERY;
    lives++;
    ship.bombs = Math.min(MAX_BOMBS, ship.bombs + 1);
    FX.popup(ship.x, ship.y - 40, 'EXTRA SHIP', '#86efac');
    sfx.extraLife();
  }
  updateHUD();
}

// ---------- power-ups ----------
function dropPickup(x, y, type) {
  if (!type) {
    const w = {
      laser: ship.laser < MAX_LASER ? 4 : 0, bomb: ship.bombs < MAX_BOMBS ? 2 : 0, shield: ship.shield < MAX_SHIELD ? 2 : 0,
      option: ship.options < MAX_OPTIONS ? 2 : 0, tractor: ship.tractor ? 0 : 1.5, warp: ship.warps < MAX_WARPS ? 1 : 0
    };
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    if (total <= 0) { addScore(1000, x, y, 'MAXED'); return; }
    let roll = rng() * total;
    type = Object.keys(w).find(k => (roll -= w[k]) < 0) || 'bomb';
  }
  pickups.push({ id: ++nextId, type, x: wrapX(x), y: Math.min(y, groundY(x) - 30), vy: -1.2, life: 660 });
}

function applyPickup(type) {
  if (type === 'laser') ship.laser = Math.min(MAX_LASER, ship.laser + 1);
  if (type === 'bomb') ship.bombs = Math.min(MAX_BOMBS, ship.bombs + 1);
  if (type === 'shield') ship.shield = MAX_SHIELD;
  if (type === 'option') ship.options = Math.min(MAX_OPTIONS, ship.options + 1);
  if (type === 'tractor') ship.tractor = true;
  if (type === 'warp') ship.warps = Math.min(MAX_WARPS, ship.warps + 1);
  const label = type === 'laser' ? `LASER ${ship.laser + 1}` : PICKUP_INFO[type].label;
  addScore(100, ship.x, ship.y - 30, label);
  sfx.pickup();
}

function stepPickups() {
  pickups.forEach(p => {
    p.vy = Math.min(0.5, p.vy + 0.03);
    p.y = Math.min(groundY(p.x) - 24, p.y + p.vy);
    p.life--;
    if (Math.abs(wrapDX(p.x, ship.x)) < 28 && Math.abs(p.y - ship.y) < 24) { p.life = 0; applyPickup(p.type); }
  });
  pickups = pickups.filter(p => p.life > 0);
}

// ---------- flow ----------
function startGame(seed) {
  initAudio();
  seedRng(typeof seed === 'number' ? seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  nextId = 0; beamId = 0; botFireGap = 0;
  fireWasDown = bombWasDown = warpWasDown = false;
  score = 0; lives = 3; tick = 0; stageN = 0; nextLife = EXTRA_LIFE_FIRST;
  combo = 0; comboT = 0; hitPause = 0; shotsFired = 0; rescuedCount = 0; fansLost = 0;
  ship = newShip(); rift = false; paused = false;
  run = null; mothership = null; dockCool = 0;
  fireLatch = bombLatch = warpLatch = false;
  FX.reset();
  enterStage();
  gameRunning = true; gameOver = false;
  const ov = document.getElementById('startOverlay');
  if (ov) ov.classList.add('hidden');
  updateHUD();
}

// Set the stage up behind its title. Nothing spawns until the title is gone.
function enterStage() {
  info = stageInfo(stageN);
  if (info.wave === 0) { rift = false; spawnFans(FANS_PER_SECTOR); }
  beams = []; enemies = []; enemyShots = []; mines = []; hazards = []; pickups = []; boss = null;
  dawdleT = 0; baiterT = 0; mothership = null; dockCool = 240;
  ship.y = Math.min(ship.y, shipFloor(ship.x));
  snapCamera();
  phase = 'intro';
  phaseT = info.wave === 0 || info.isBoss ? 150 : 110;
  banner = info.isBoss
    ? { text: BOSS_NAME[info.sector.boss.type], sub: `MOTHERSHIP · SECTOR ${info.sectorIdx + 1}` }
    : { text: info.sector.name, sub: `WAVE ${info.wave + 1}${info.cycle ? ` · CYCLE ${info.cycle + 1}` : ''}` };
  if (info.isBoss) sfx.warning();
  updateHUD();
}

function beginStage() {
  spawnWaveEnemies(info.def);
  if (info.isBoss) boss = createBoss(info.sector.boss.type);
  phase = 'play';
}

function nextStage() {
  stageN++;
  if (stageN % WAVES_PER_SECTOR === 0) ship.bombs = Math.min(MAX_BOMBS, ship.bombs + 1);
  enterStage();
}

function checkClear() {
  if (coreEnemiesLeft() || boss) return;
  ship.carried.forEach(f => { f.state = 'ground'; f.y = groundY(f.x); rescuedCount++; });
  ship.carried = [];
  enemies.forEach(e => { if (!e.dead) { FX.explode(e.x, e.y, 1); killEnemy(e, true); } });
  enemies = []; mines = []; enemyShots = []; hazards = [];
  clearBonus = fans.length * 100 * (info.sectorIdx + 1) * (info.cycle + 1);
  if (clearBonus) addScore(clearBonus);
  phase = 'clear'; phaseT = 120;
  banner = info.isBoss ? { text: 'SECTOR CLEAR', sub: `${fans.length} FANS SAVED · BONUS ${clearBonus}` }
    : { text: 'WAVE CLEAR', sub: `${fans.length} FANS SAVED · BONUS ${clearBonus}` };
}

// All fans gone: the planet phases into the Rift and every lander mutates.
function checkRift() {
  if (rift || fans.length) return;
  rift = true;
  enemies.forEach(e => { if (!e.dead && e.type === 'lander') { e.type = 'mutant'; e.carry = null; e.state = 'hunt'; e.r = ENEMY.mutant.r; } });
  phase = 'rift'; phaseT = 110;
  banner = { text: 'THE RIFT OPENS', sub: 'every fan is gone · the invaders mutate' };
  sfx.rift();
  FX.flash(1, '#f0abfc');
  FX.shake(10, 60);
}

function useBomb() {
  if (ship.bombs <= 0 || ship.bombCd > 0) return;
  ship.bombs--; ship.bombCd = 40;
  sfx.chord();
  FX.flash(0.8, '#f472b6'); FX.shake(12, 30);
  FX.explode(ship.x, ship.y, 2, ['#f472b6', '#fde68a', '#ffffff']);
  enemies.forEach(e => { if (!e.dead && onScreen(e.x, 30)) killEnemy(e); });
  mines.forEach(m => { if (onScreen(m.x, 20)) m.dead = true; });
  enemyShots = enemyShots.filter(s => !onScreen(s.x, 20));
  hazards = [];
  if (boss && !boss.dying && onScreen(boss.x, 150)) damageBoss(boss, 3, boss.x, boss.y);
  updateHUD();
}

function useWarp() {
  if (ship.warps <= 0 || ship.warpCd > 0) return;
  ship.warps--; ship.warpCd = 60;
  FX.explode(ship.x, ship.y, 2, ['#a78bfa', '#e0e7ff', '#ffffff']);
  ship.x = wrapX(ship.x + WORLD_W * 0.3 + rng() * WORLD_W * 0.4);
  ship.y = rrange(HUD_H + 60, 300);
  ship.vx = 0; ship.trail = [];
  snapCamera();
  sfx.warp();
  if (rng() < 0.12) { FX.popup(ship.x, ship.y - 34, 'WARP FAULT', '#fca5a5'); ship.inv = 0; damageShip('warp'); }
  else ship.inv = 30;
  updateHUD();
}

function damageShip() {
  if (ship.inv > 0 || phase !== 'play') return;
  if (ship.shield > 0) {
    ship.shield--; ship.inv = 50;
    sfx.shield(); FX.spark(ship.x, ship.y, '#fb7185'); FX.shake(5, 10);
    updateHUD();
    return;
  }
  lives--; combo = 0; comboT = 0; hitPause = 0;
  FX.explode(ship.x, ship.y, 3, ['#ffffff', '#eef0f2', '#1e3558', '#d98a3a', '#67e8f9']);
  FX.flash(0.5); sfx.hit(); sfx.explode(3, 0);
  ship.carried.forEach(f => { f.state = 'falling'; f.vy = 0; f.fallFrom = f.y; });
  ship.carried = [];
  enemyShots = []; hazards = [];
  if (lives <= 0) {
    lives = 0;
    phase = 'ending'; phaseT = ENDING_FRAMES;
    banner = { text: 'GAME OVER', sub: `SECTOR ${info.label}` };
    Object.keys(keys).forEach(k => { keys[k] = false; });
    sfx.gameOver();
  } else {
    phase = 'dying'; phaseT = 120;
  }
  updateHUD();
}

function respawn() {
  ship.inv = 120; ship.vx = 0; ship.y = 200;
  ship.laser = Math.max(0, ship.laser - 1);
  ship.options = 0; ship.tractor = false; ship.fireQueued = false;
  enemies.forEach(e => {
    const dx = wrapDX(e.x, ship.x);
    if (Math.abs(dx) < 320) e.x = wrapX(ship.x + (dx < 0 ? -1 : 1) * 520);
  });
  mines = mines.filter(m => Math.abs(wrapDX(m.x, ship.x)) > 200);
  phase = 'play';
}

function finishGame() {
  gameRunning = false; gameOver = true;
  Object.keys(keys).forEach(k => { keys[k] = false; });
  const finalScore = score;
  const newBest = finalScore > best;
  if (newBest) { best = finalScore; saveBest(); }
  updateHUD();
  const show = () => {
    const ov = document.getElementById('startOverlay');
    if (!ov) return;
    ov.innerHTML = `
      <h2>INVASION WINS</h2>
      <p>Reached ${info.sector.name.toLowerCase().replace(/\b\w/g, m => m.toUpperCase())} · ${info.label}${info.cycle ? ` · cycle ${info.cycle + 1}` : ''}</p>
      <p>Fans rescued: ${rescuedCount} &nbsp;|&nbsp; Fans lost: ${fansLost}</p>
      <p style="margin-top:0.4rem">Final score: ${finalScore}${newBest ? ' &nbsp;<span style="color:#f0abfc;font-weight:bold">NEW BEST!</span>' : ''}</p>
      <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP REVENGERS</p>
      ${typeof Arcade !== 'undefined' ? Arcade.boardHTML(Arcade.slug) : ''}
      <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to defend again</p>`;
    ov.classList.remove('hidden');
  };
  if (typeof Arcade !== 'undefined') Arcade.submitFlow(finalScore, show); else show();
}

// ---------- the mothership, docking and the runner ----------
// In the Rift a mothership hangs over the planet. Fly into its bay to dock and
// run the rescue on foot; after the last sector's mothership, Plumbmonkey's
// command ship takes you to the core.
function bayY() { return mothership.y + 44; }
function stepMothership() {
  if (!rift || info.isBoss) { mothership = null; return; }
  if (dockCool > 0) { dockCool--; return; }
  if (!mothership) {
    mothership = { x: wrapX(ship.x + ship.facing * 1300), y: 150, finale: false };
    FX.popup(ship.x, ship.y - 40, 'MOTHERSHIP DETECTED', '#a5f3fc');
    sfx.warning();
    return;
  }
  mothership.x = wrapX(mothership.x + Math.sin(tick * 0.004) * 0.6);
  if (Math.abs(wrapDX(mothership.x, ship.x)) < 40 && Math.abs(bayY() - ship.y) < 24) beginDock('rescue', 150);
}

function beginDock(kind, len) {
  dockKind = kind; dockLen = len;
  phase = 'dock'; phaseT = len;
  dockFrom = { x: ship.x, y: ship.y };
  enemyShots = []; hazards = []; beams = [];
  ship.carried = [];
  sfx.dock();
}

function beginFinale() {
  mothership = { x: wrapX(ship.x + ship.facing * 300), y: 150, finale: true };
  beginDock('core', 180);
}

// Put the ship back outside the mothership's bay, with room to breathe.
function placeShipOut() {
  if (mothership) { ship.x = mothership.x; ship.y = bayY() + 50; }
  ship.vx = 0; ship.inv = 120; ship.fireQueued = false; ship.trail = [];
  enemies.forEach(e => {
    const dx = wrapDX(e.x, ship.x);
    if (Math.abs(dx) < 360) e.x = wrapX(ship.x + (dx < 0 ? -1 : 1) * 560);
  });
  snapCamera();
}

function loseRunLife(then) {
  lives--;
  if (lives <= 0) {
    lives = 0;
    placeShipOut();
    phase = 'ending'; phaseT = ENDING_FRAMES;
    banner = { text: 'GAME OVER', sub: `SECTOR ${info.label}` };
    Object.keys(keys).forEach(k => { keys[k] = false; });
    sfx.gameOver();
  } else then();
  updateHUD();
}

function finishRun() {
  const r = run;
  run = null;
  FX.reset();
  if (r.kind === 'core') {
    if (r.result === 'success') { mothership = null; nextStage(); return; }
    loseRunLife(() => { run = createRun('core'); phase = 'runner'; });
    return;
  }
  placeShipOut();
  mothership = null;
  if (r.result === 'success' && r.freed > 0) {
    spawnFans(Math.min(FANS_PER_SECTOR, r.freed));
    rift = false;
    phase = 'rift'; phaseT = 110;                 // the title-freeze beat, reused for the Rift closing
    banner = { text: 'THE RIFT CLOSES', sub: `${fans.length} fans restored to the planet` };
    FX.flash(0.8, '#a5f3fc');
    sfx.rescue();
    updateHUD();
    return;
  }
  dockCool = r.result === 'success' ? 900 : 1200;
  if (r.result === 'success') { phase = 'undock'; phaseT = 90; return; }
  loseRunLife(() => { phase = 'undock'; phaseT = 90; });
}

// ---------- camera ----------
function camTarget() { return wrapX(ship.x - W * (ship.facing > 0 ? 0.32 : 0.68)); }
function snapCamera() { camX = camTarget(); }
function updateCamera() { camX = wrapX(camX + wrapDX(camTarget(), camX) * 0.08); }

// ---------- collisions ----------
function resolveHits() {
  beams.forEach(b => {
    if (b.dead) return;
    if (boss && beamHitBoss(b, boss) && b.dead) return;
    const touched = [];
    enemies.forEach(e => { if (!e.dead && beamTouches(b, e.x, e.y, e.r)) touched.push({ along: wrapDX(e.x, b.x0) * b.dir, e }); });
    mines.forEach(m => { if (!m.dead && beamTouches(b, m.x, m.y, m.r)) touched.push({ along: wrapDX(m.x, b.x0) * b.dir, m }); });
    touched.sort((a, c) => a.along - c.along);
    for (const t of touched) {
      if (b.dead) break;
      const o = t.e || t.m;
      if (!beamStrike(b, o.id, o.x, o.y)) continue;
      if (t.e) hitEnemy(t.e, 1, o.x, o.y);
      else { o.dead = true; FX.explode(o.x, o.y, 1, ['#e879f9', '#ffffff']); addScore(25); }
    }
  });
  enemies = enemies.filter(e => !e.dead);
  mines = mines.filter(m => !m.dead);
}

function checkShipDamage() {
  if (ship.inv > 0) return;
  const near = (x, y, rx, ry) => Math.abs(wrapDX(x, ship.x)) < rx && Math.abs(y - ship.y) < ry;
  for (const s of enemyShots) if (near(s.x, s.y, 22, 9 + s.r)) { s.life = 0; return damageShip(); }
  for (const m of mines) if (!m.dead && m.arm <= 0 && near(m.x, m.y, 24, 14)) { m.dead = true; FX.explode(m.x, m.y, 1); return damageShip(); }
  for (const e of enemies) if (!e.dead && near(e.x, e.y, 22 + e.r, 8 + e.r)) { killEnemy(e); return damageShip(); }
  if (boss && bossTouchesShip(boss)) return damageShip();
  for (const h of hazards) if (hazardHitsShip(h)) return damageShip();
}

// ---------- the step ----------
function stepPlay(inp) {
  dawdleT++;
  stepShip(ship, inp);
  if (inp.bomb) useBomb();
  if (inp.warp && phase === 'play') useWarp();
  if (phase !== 'play') return;
  updateCamera();
  stepBeams();
  stepEnemies();
  if (boss) stepBoss(boss);
  stepHazards();
  stepFans();
  stepCatch(ship);
  stepPickups();
  resolveHits();
  checkShipDamage();
  if (phase !== 'play') return;
  if (dawdleT > DAWDLE_FRAMES && !info.isBoss && --baiterT <= 0) {
    baiterT = BAITER_EVERY;
    if (enemies.filter(e => e.type === 'baiter').length < 3) {
      spawnEnemy('baiter', ship.x + (rng() < 0.5 ? -1 : 1) * W * 0.7, HUD_H + 60);
      FX.popup(ship.x, ship.y - 40, 'HURRY UP!', '#fbbf24');
    }
  }
  if (combo && comboT > 0 && --comboT === 0) combo = 0;
  checkRift();
  if (phase !== 'play') return;
  stepMothership();
  if (phase !== 'play') return;
  if (boss && boss.dying) { phase = 'bossDeath'; return; }
  checkClear();
}

function readInput() {
  const fireDown = !!(keys.Space || keys.KeyZ);
  const bombDown = !!(keys.KeyX || keys.ShiftLeft || keys.ShiftRight);
  const warpDown = !!keys.KeyC;
  const inp = {
    left: !!(keys.ArrowLeft || keys.KeyA), right: !!(keys.ArrowRight || keys.KeyD),
    up: !!(keys.ArrowUp || keys.KeyW), down: !!(keys.ArrowDown || keys.KeyS),
    fire: fireLatch || (fireDown && !fireWasDown),
    bomb: bombLatch || (bombDown && !bombWasDown),
    warp: warpLatch || (warpDown && !warpWasDown)
  };
  fireWasDown = fireDown; bombWasDown = bombDown; warpWasDown = warpDown;
  fireLatch = bombLatch = warpLatch = false;
  return inp;
}

function update() {
  if (paused) return;
  tick++;
  const slow = phase === 'bossDeath' && tick % 2 === 1;   // the mothership dies in slow motion
  if (!slow) FX.update();
  const inp = isAttract() || botMode ? autopilot() : readInput();
  if (!gameRunning || slow) return;
  if (hitPause > 0) { hitPause--; return; }
  if (phase !== 'play' && beams.length) stepBeams();     // shots already fired finish their flight
  switch (phase) {
    case 'intro':
      updateCamera();
      if (--phaseT <= 0) beginStage();
      break;
    case 'play':
      stepPlay(inp);
      break;
    case 'rift':
      if (--phaseT <= 0) phase = 'play';
      break;
    case 'dying':
      stepFans();
      if (--phaseT <= 0) respawn();
      break;
    case 'bossDeath':
      stepBoss(boss);
      stepFans();
      if (boss.dying <= 0) { boss = null; phase = 'play'; checkClear(); }
      break;
    case 'clear':
      if (--phaseT <= 0) {
        if (info.isBoss && info.sectorIdx === SECTORS.length - 1) beginFinale();
        else nextStage();
      }
      break;
    case 'dock': {
      const k = Math.min(1, (1 - phaseT / dockLen) * 1.6);
      ship.x = wrapX(dockFrom.x + wrapDX(mothership.x, dockFrom.x) * k);
      ship.y = dockFrom.y + (mothership.y + 44 - dockFrom.y) * k;
      ship.vx = 0; ship.facing = wrapDX(mothership.x, dockFrom.x) >= 0 ? 1 : -1;
      updateCamera();
      if (--phaseT <= 0) { run = createRun(dockKind); FX.reset(); phase = 'runner'; }
      break;
    }
    case 'runner':
      stepRun(run, isAttract() || botMode ? runnerPilot(run) : inp);
      if (run.phase === 'result' && run.phaseT <= 0) finishRun();
      break;
    case 'undock':
      ship.y = Math.min(shipFloor(ship.x), ship.y + 1.2);
      updateCamera();
      if (--phaseT <= 0) phase = 'play';
      break;
    case 'ending':
      if (--phaseT <= 0) finishGame();
      break;
  }
}

// ---------- autopilot (attract mode and the balance bot) ----------
let botFireGap = 0;
function autopilot() {
  const inp = { left: false, right: false, up: false, down: false, fire: false, bomb: false, warp: false };
  if (!gameRunning || phase !== 'play') return inp;
  const s = ship;
  const dist = o => Math.abs(wrapDX(o.x, s.x)) + Math.abs(o.y - s.y) * 0.5;
  const steerTo = (tx, ty, stop) => {
    const dx = wrapDX(tx, s.x);
    if (Math.abs(dx) > stop) { if (dx > 0) inp.right = true; else inp.left = true; }
    if (ty < s.y - 4) inp.up = true; else if (ty > s.y + 4) inp.down = true;
  };

  let aim = null;
  const falling = fans.filter(f => f.state === 'falling' && groundY(f.x) - f.fallFrom > FALL_SAFE - 20).sort((a, b) => dist(a) - dist(b))[0];
  if (s.carried.length) { inp.down = true; }
  else if (falling && dist(falling) < 900) steerTo(falling.x, falling.y - 8, 10);
  else if (mothership && !boss) steerTo(mothership.x, mothership.y + 44, 12);
  else {
    const lifting = enemies.filter(e => e.type === 'lander' && e.carry).sort((a, b) => dist(a) - dist(b))[0];
    const bt = boss && bossTarget(boss);
    const pick = pickups.filter(p => dist(p) < 420).sort((a, b) => dist(a) - dist(b))[0];
    if (lifting) aim = lifting;
    else if (pick && !enemies.some(e => dist(e) < 160)) steerTo(pick.x, pick.y, 8);
    else if (bt && !enemies.some(e => dist(e) < 260)) aim = bt;
    else aim = enemies.slice().sort((a, b) => dist(a) - dist(b))[0] || (boss && !boss.dying ? { x: boss.x, y: boss.y } : null);
  }
  if (aim) {
    const adx = wrapDX(aim.x, s.x), dir = adx >= 0 ? 1 : -1, far = Math.abs(adx);
    const standoff = boss && aim !== boss && bossTarget(boss) === aim ? 360 : 240;
    if (s.facing !== dir || far > standoff + 80) { if (dir > 0) inp.right = true; else inp.left = true; }
    let ty = aim.y;
    if (boss && boss.type === 'leviathan' && boss.state === 'charge') ty = boss.laneY + (s.y < boss.laneY ? -70 : 70);
    ty = Math.max(shipCeil(), Math.min(shipFloor(s.x), ty));
    if (ty < s.y - 3) inp.up = true; else if (ty > s.y + 3) inp.down = true;
    if (s.facing === dir && Math.abs(aim.y - s.y) < 10 + (aim.r || 8) && far < 820 && botFireGap <= 0) { inp.fire = true; botFireGap = 5; }
  }
  if (botFireGap > 0) botFireGap--;

  // dodge the nearest incoming threat
  const threats = enemyShots.map(t => ({ x: t.x + t.vx * 6, y: t.y + t.vy * 6, r: 30 }))
    .concat(mines.map(m => ({ x: m.x, y: m.y, r: 30 })))
    .concat(enemies.filter(e => e.type !== 'lander' || !e.carry).map(e => ({ x: e.x, y: e.y, r: 20 + e.r })));
  const danger = threats.find(t => Math.abs(wrapDX(t.x, s.x)) < 70 && Math.abs(t.y - s.y) < t.r);
  if (danger) {
    const up = danger.y > s.y ? s.y - 40 > shipCeil() : s.y + 40 > shipFloor(s.x);
    inp.up = up; inp.down = !up;
  }
  if (hazards.some(h => h.kind === 'spoke') || (boss && boss.state === 'spokeWarn')) {
    const gap = wrapDX(s.x, boss.x);
    if (Math.abs(gap) < 330) { inp.left = gap < 0; inp.right = gap >= 0; }
  }
  const crowd = enemies.filter(e => onScreen(e.x, 0) && dist(e) < 240).length;
  if (s.bombs > 0 && (crowd >= 4 || (danger && s.shield === 0 && lives <= 1))) inp.bomb = true;
  return inp;
}

// ---------- DOM HUD ----------
function updateHUD() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('score', score); set('lives', lives); set('stage', info.label); set('fans', fans.length); set('best', Math.max(best, score));
}

// ---------- input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'KeyZ') fireLatch = true;
  if (e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') bombLatch = true;
  if (e.code === 'KeyC') warpLatch = true;
  if (e.code === 'Enter' && !gameRunning) startGame();
  if ((e.code === 'KeyP' || e.code === 'Escape') && gameRunning) paused = !paused;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { if (gameRunning && !isAttract()) paused = true; });
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startGame();
});

// ---------- boot ----------
spawnFans(FANS_PER_SECTOR);
snapCamera();
updateHUD();

// Fixed-step loop: rules always advance at 60 Hz whatever the display rate.
let lastFrame = null, acc = 0;
function loop(now) {
  now = typeof now === 'number' ? now : performance.now();
  if (lastFrame === null) lastFrame = now;
  acc += Math.min(250, Math.max(0, now - lastFrame));
  lastFrame = now;
  let steps = 0;
  while (acc >= STEP && steps++ < 8) { update(); acc -= STEP; }
  if (steps >= 8) acc = 0;
  draw();
  ArcadeVR.schedule(loop);
}
loop();
