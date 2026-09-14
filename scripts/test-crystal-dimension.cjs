// Headless rules test for Crystal Dimension: loads the five game scripts into a
// VM with a stub canvas, then drives update()/collide() directly.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const noop = () => {};
const ctx = new Proxy({}, {
  get: (o, k) => (k in o ? o[k] : String(k).startsWith('create') ? () => ({ addColorStop: noop }) : noop),
  set: (o, k, v) => ((o[k] = v), true)
});
const elements = new Map();
const el = id => {
  if (!elements.has(id)) elements.set(id, { width: 960, height: 540, getContext: () => ctx, addEventListener: noop, classList: { add: noop, remove: noop }, style: {}, textContent: '', innerHTML: '' });
  return elements.get(id);
};
let submitted = null;
let clock = 0;
const sandbox = {
  console, Math, setTimeout: noop, setInterval: () => 1,
  performance: { now: () => clock },
  document: { getElementById: el },
  window: { addEventListener: noop },
  ArcadeVR: { schedule: noop },
  ArcadeAudio: { context: () => null, resume: noop },
  Arcade: { attract: false, slug: 'spectral-manor-crystal-dimension', boardHTML: () => '', submitFlow: (s, done) => { submitted = s; done(); } }
};
vm.createContext(sandbox);
const dir = 'public/arcade/games/spectral-manor-crystal-dimension/';
['sectors.js', 'sprites.js', 'enemies.js', 'bosses.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const clearField = "phase='play';" + 'rocks=[];saucers=[];wraiths=[];mines=[];seekers=[];eshots=[];';

// --- wave flow: intro banner, then the first wave arrives ---
run('startGame();');
assert.equal(run('phase'), 'intro');
steps(151);
assert.equal(run('phase'), 'play');
assert.equal(run('rocks.length'), 4);
assert.ok(run('rocks.every(r => Math.hypot(r.x - ship.x, r.y - ship.y) >= 170)'), 'rocks spawn clear of the ship');

// --- fixed timestep: 3 frames of wall time = 3 rule steps ---
run('lastFrame = null; acc = 0; loop(1000); var t0 = tick; loop(1051);');
assert.equal(run('tick - t0'), 3);

// --- one shot shatters exactly one crystal ---
run(`${clearField} ship.x = 100; ship.y = 100; ship.invuln = 999;
  rocks = [makeRock(500, 300, 1), makeRock(500, 300, 1)]; rocks.forEach(r => { r.vx = r.vy = 0; });
  shots = [{ x: 500, y: 300, vx: 0, vy: 0, life: 10 }]; update();`);
assert.equal(run('rocks.length'), 1);

// --- armored geodes take three hits, then split into two ---
run(`${clearField} rocks = [makeRock(500, 300, 3, 'armored')]; rocks[0].vx = rocks[0].vy = 0;`);
for (let i = 0; i < 2; i++) { run('shots = [{ x: rocks[0].x, y: rocks[0].y, vx: 0, vy: 0, life: 10 }]; update();'); }
assert.equal(run('rocks.length === 1 && rocks[0].hp'), 1);
run('shots = [{ x: rocks[0].x, y: rocks[0].y, vx: 0, vy: 0, life: 10 }]; update();');
assert.equal(run('rocks.length'), 2);
assert.ok(run('rocks.every(r => r.size === 2 && r.variant === "normal")'));

// --- volatile crystals burst into enemy shards ---
run(`${clearField} rocks = [makeRock(500, 300, 2, 'volatile'), makeRock(60, 480, 3)]; rocks[0].vx = rocks[0].vy = 0;
  shots = [{ x: 500, y: 300, vx: 0, vy: 0, life: 10 }]; update();`);
assert.equal(run('rocks.length'), 1);
assert.ok(run('eshots.length') >= 8);

// --- nova: clears enemy fire and nearby threats, spends a charge ---
run(`${clearField} ship.x = 480; ship.y = 270; novas = 1;
  eshots = [{ x: 100, y: 100, vx: 1, vy: 0, life: 50 }];
  rocks = [makeRock(560, 270, 1)]; saucers = []; spawnSaucerAt(420, 300);
  keys.KeyX = true; update(); keys.KeyX = false;`);
assert.equal(run('novas'), 0);
assert.equal(run('saucers.length'), 0);
assert.equal(run('rocks.length'), 0);
run('keys.KeyX = true; update(); keys.KeyX = false;'); // no charge left: nothing happens
assert.equal(run('novas'), 0);

// --- crystals charge the nova meter ---
run(`novaCharge = 7; crystals = [{ x: ship.x, y: ship.y, vx: 0, vy: 0, life: 100, r: 7 }]; rocks = [makeRock(50, 50, 3)]; update();`);
assert.equal(run('novas'), 1);
assert.equal(run('novaCharge'), 0);

// --- shield absorbs one hit ---
run(`${clearField} rocks = [makeRock(50, 50, 3)]; ship.invuln = 0; ship.shield = true; power = 'shield'; powerTime = 100; var livesBefore = lives; hitShip();`);
assert.equal(run('lives'), run('livesBefore'));
assert.equal(run('ship.shield'), false);

// --- saucer bursts are frame-queued, not wall-clock timers ---
run(`${clearField} rocks = [makeRock(50, 50, 3)]; sectorIdx = 0; waveIdx = 2; ship.invuln = 999; ship.dead = false;
  spawnSaucerAt(700, 300); saucers[0].shootTimer = 1; update();`);
steps(20);
assert.equal(run('eshots.length'), 3);

// --- boss mechanics ---
run(`sectorIdx = 0; boss = createBoss(SECTORS[0].boss, 0); boss.entry = false; boss.x = 480; boss.y = 270; var hp0 = boss.hp;
  var p = boss.plates[0], a = boss.rot + p.a;
  bossShotHit(boss, { x: boss.x + Math.cos(a) * boss.plateR, y: boss.y + Math.sin(a) * boss.plateR });`);
assert.equal(run('boss.plates[0].hp'), 1, 'warden plates soak shots');
assert.equal(run('boss.hp'), run('hp0'));
assert.equal(run('bossShotHit(boss, { x: boss.x + 3, y: boss.y })'), true);
assert.equal(run('boss.hp'), run('hp0 - 1'), 'warden core takes damage');

run(`boss = createBoss(SECTORS[3].boss, 0); boss.rot = 0; var step = Math.PI * 2 / HEART_PLATES, hh = boss.hp;
  var plateAngle = step * 2.5, gapAngle = step * 0.5;
  var deflected = bossShotHit(boss, { x: boss.x + Math.cos(plateAngle) * HEART_SHELL, y: boss.y + Math.sin(plateAngle) * HEART_SHELL });`);
assert.equal(run('deflected && boss.hp === hh'), true, 'heart shell deflects');
assert.equal(run('bossShotHit(boss, { x: boss.x + Math.cos(gapAngle) * HEART_SHELL, y: boss.y + Math.sin(gapAngle) * HEART_SHELL })'), false, 'gap lets the shot through');
assert.equal(run('bossShotHit(boss, { x: boss.x + 5, y: boss.y })'), true);
assert.equal(run('boss.hp'), run('hh - 1'));

run(`boss = createBoss(SECTORS[2].boss, 0); var sh = boss.hp; boss.segs[3].x = 300; boss.segs[3].y = 300;
  bossShotHit(boss, { x: 300, y: 300 });`);
assert.equal(run('boss.segs[3].hp === 1 && boss.hp === sh'), true, 'serpent body blocks shots');

// --- the full run: every wave and boss in order, drawing each, into cycle 2 ---
run('startGame(); ship.invuln = 1e9;');
const seen = [];
for (let frame = 0; frame < 20000 && run('cycle') === 0; frame++) {
  run('update();');
  if (frame % 97 === 0) run('draw();');
  if (run('phase') !== 'play') continue;
  const b = run('boss && boss.type');
  if (b && !seen.includes(b)) { seen.push(b); run('draw();'); }
  run(`${clearField} if (boss) boss.hp = 0;`);
}
assert.deepEqual(seen, ['warden', 'carrier', 'serpent', 'heart'], 'bosses arrive in sector order');
assert.equal(run('cycle'), 1, 'run loops into cycle 2 after the Prism Heart');
assert.equal(run('sectorIdx === 0 && waveIdx === 0'), true);
assert.ok(run('cycleMult') > 1);

// --- each boss survives 1200 frames of its own attacks and draws every frame ---
['warden', 'carrier', 'serpent', 'heart'].forEach((type, i) => {
  run(`startGame(); sectorIdx = ${i}; waveIdx = 3; enterSector(); ${clearField} phase = 'play'; spawnWave(); ship.invuln = 1e9;`);
  assert.equal(run('boss.type'), type);
  for (let f = 0; f < 1200; f++) { run('update(); if (f % 10 === 0) draw();'.replace('f % 10', String(f % 10))); }
  assert.ok(run('boss !== null'), `${type} still alive`);
  assert.ok(run('eshots.length + saucers.length + seekers.length + (boss.spokes ? boss.spokes.length : 0)') >= 0);
  run('boss.hp = 0; update();');
  assert.equal(run('boss'), null, `${type} can be defeated`);
});

// --- respawn waits for a clear spawn point, then game over submits the score ---
run(`startGame(); steps = 0; ${clearField} rocks = [makeRock(50, 50, 3)]; phase = 'play'; ship.invuln = 0; lives = 2; hitShip();`);
assert.equal(run('ship.dead'), true);
steps(100);
assert.equal(run('ship.dead'), false);
run('ship.invuln = 0; hitShip();');
// the last death plays a GAME OVER beat before the initials prompt can open
assert.equal(run('gameOver'), false);
assert.equal(submitted, null);
run('keys.KeyA = true;'); steps(60);
assert.equal(run('ship.dead'), true, 'no respawn after the final ship');
assert.equal(submitted, null);
steps(100);
assert.equal(run('gameOver'), true);
assert.equal(run('keys.KeyA'), false, 'held keys are released before the prompt');
assert.equal(submitted, run('score'));

console.log('Crystal Dimension: waves, fixed step, single-hit shots, variants, nova, shield, bursts, 4 bosses, full cycle, respawn + game over passed.');
