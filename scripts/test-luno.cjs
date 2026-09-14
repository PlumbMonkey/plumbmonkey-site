// Headless rules test for Luno's Flight: loads the sprite kit and the five
// game scripts into a VM with a stub canvas, then drives the rules directly.
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
let submitted = null, clock = 0;
const sandbox = {
  console, Math, setTimeout: noop, location: { search: '' },
  performance: { now: () => clock },
  localStorage: { getItem: () => null, setItem: noop },
  document: { body: { classList: { add: noop } }, getElementById: el },
  addEventListener: noop,
  ArcadeVR: { schedule: noop },
  Arcade: { attract: false, submitFlow: (s, done) => { submitted = s; done(); }, boardHTML: () => '', slug: 'spectral-skyline' },
  ArcadeAudio: { context: () => null, resume: noop }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('public/arcade/games/wave3/sprite-kit.js', 'utf8'), sandbox, { filename: 'sprite-kit.js' });
const dir = 'public/arcade/games/spectral-skyline/';
['stages.js', 'luno.js', 'bosses.js', 'render.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const calm = 'introTime = 0; boss = null; storms = []; rings = []; witchBolts = []; hitPause = 0; waveDelay = 0; player.invuln = 0; player.dive = false; player.bumpCooldown = 0;';
const keeper = "witches.push(makeWitch(20, 60, 'broom'));";   // keeps the wave from clearing
const ghostAt = (x, y) => `ghosts = [{x: ${x}, y: ${y}, w: 28, h: 32, vx: 0, vy: 0, phase: 0, vis: 1, state: 'visible', t: 999, hurt: 0}]`;

// --- start ---
run('startGame();');
assert.equal(run('stageIdx'), 0);
assert.equal(run('witches.length'), 5);
assert.ok(run('ghosts.length') >= 2);
run('draw();');

// --- fixed timestep ---
run('previousFrame = 1000; accumulator = 0;'); clock = 1051; run('var t0 = tick; loop();');
assert.equal(run('tick - t0'), 3);

// --- ghosts: destroyed from above, harmless while faded, hurt from below ---
run(`${calm} witches = []; ${keeper} player.x = 400; player.y = 200; ${ghostAt(410, 220)}; var lv = lives, sc = score; collideGhosts();`);
assert.equal(run('ghosts[0].dead'), true, 'ghost destroyed from above');
assert.ok(run('crystalPickups.some(c => c.soul)'), 'drops a soul wisp');
assert.ok(run('score') > run('sc'));
run(`${calm} ${ghostAt(410, 180)}; ghosts[0].vis = 0.3; lv = lives; collideGhosts();`);
assert.equal(run('lives'), run('lv'), 'faded ghost is harmless');
assert.equal(run('!!ghosts[0].dead'), false, 'and untouchable');
run(`${calm} ${ghostAt(410, 180)}; lv = lives; collideGhosts();`);
assert.equal(run('lives'), run('lv - 1'), 'ghost above Luno hurts');

// --- spirit dive ---
run(`${calm} ghosts = []; player.x = 400; player.y = 100; player.vy = 0; player.grounded = false; player.diveCd = 0; keys.ArrowDown = true; update(); keys.ArrowDown = false;`);
assert.equal(run('player.dive'), true);
assert.ok(run('player.vy') >= 9);
run(`${calm} player.dive = true; player.x = 400; player.y = 204; ${ghostAt(410, 210)}; collideGhosts();`);
assert.equal(run('ghosts[0].dead'), true, 'a dive destroys a near-level ghost');

// --- dive landing stomps a walking witch ---
run(`${calm} ghosts = []; const pl = platforms.find(p => p.kind === 'roof' && p.y === 280);
  witches = [makeWitch(pl.x + 60, pl.y - 30, 'broom', {state: 'walking', nest: {taken: false, plat: pl, x: pl.x + 150, y: pl.y - 18}})]; ${keeper}
  player.x = pl.x + 50; player.y = pl.y - 60; player.vy = 12; player.dive = true; player.grounded = false;`);
steps(4);
assert.equal(run('witches.filter(w => w.state === "walking").length'), 0, 'stomp knocks out the walking witch');

// --- witch jousts ---
run(`${calm} witches = [makeWitch(410, 222, 'broom')]; player.x = 400; player.y = 200; collideWitches();`);
assert.equal(run('witches[0].dead'), true);
run(`${calm} witches = [makeWitch(410, 203, 'broom')]; ${keeper} lv = lives; collideWitches();`);
assert.equal(run('lives'), run('lv'), 'level joust is a bounce');

// --- storm clouds: a vanished cloud can't be stood on; lightning hits its column ---
run(`wave = 9; spawnWave(); ${calm} ${keeper} ghosts = []; const cl = platforms.find(p => p.kind === 'cloud' && !p.vx);
  cl.fade.phase = 'gone'; cl.fade.t = 999; player.x = cl.x + 20; player.y = cl.y - 40; player.vy = 2;`);
steps(30);   // ~40px of fall to get past the cloud top
assert.ok(run('player.y') > run('cl.y'), 'fell through the dissolved cloud');
run(`${calm} player.x = 300; player.y = 300; lv = lives; storms = [{x: player.x + 24, state: 'warn', t: 1, seed: 1}];`);
steps(2);
assert.equal(run('lives'), run('lv - 1'), 'lightning strikes its column');

// --- bell tower: the toll shoves but never costs a life ---
run(`wave = 5; spawnWave(); ${calm} ${keeper} ghosts = []; player.x = 480 - 24 + 90; player.y = 240; player.vx = 0; lv = lives; bell.state = 'warn'; bell.t = 1;`);
// hold Luno at one height so gravity can't carry him out of the ring's path
run('var maxVx = 0; for (let i = 0; i < 30; i++) { player.y = 240; player.vy = 0; update(); maxVx = Math.max(maxVx, Math.abs(player.vx)); }');
assert.equal(run('lives'), run('lv'));
assert.ok(run('maxVx') > 1, 'shoved by the toll');

// --- bosses ---
run('wave = 4; spawnWave(); player.invuln = 0;');
assert.equal(run('boss.type'), 'shrieker');
run(`var b = boss; b.state = 'screech'; b.t = 1; b.x = 400; b.y = 100; player.x = 420; player.y = 440; player.invuln = 999;`);
steps(80);
assert.equal(run('b.state'), 'stunned', 'a missed dive stuns the Shrieker');
run(`player.invuln = 0; player.dive = false; b.invulnT = 0; var bh = b.hp; player.x = b.x; player.y = b.y + b.h * 0.4 - player.h * 0.4; bossCollide(b);`);
assert.equal(run('b.hp'), run('bh - 1'), 'a stunned Shrieker can be hit from level height');

run('wave = 8; spawnWave();');
assert.equal(run('boss.type'), 'gargoyle');
run(`var g = boss; g.state = 'stone'; g.t = 999; player.invuln = 0; lv = lives; var gh = g.hp; player.x = g.x; player.y = g.y - 20; bossCollide(g);`);
assert.equal(run('g.hp === gh && lives === lv'), true, 'stone gargoyle: clang, no damage either way');

// a gargoyle heading home flies there — it must not teleport onto the perch
run(`g.state = 'flying'; g.t = 1; g.x = 100; g.y = 400; g.vx = g.vy = 0; var gx0 = g.x, gy0 = g.y; updateBoss(g);`);
assert.equal(run('g.state'), 'return');
assert.ok(run('Math.hypot(g.x - gx0, g.y - gy0)') < 10, 'returning gargoyle flies back');
run('wave = 12; spawnWave();');
assert.equal(run('boss.type'), 'storm');
run(`var h = boss; h.state = 'drift'; h.t = 999; player.invuln = 0; player.x = h.x + 10; player.y = h.y - 20; var hh = h.hp; bossCollide(h);`);
assert.equal(run('h.hp === hh - 1 && h.state === "fade"'), true, 'hit from above, the Storm Hag fades away');

run('wave = 16; spawnWave();');
assert.equal(run('boss.type'), 'wyrm');
run(`var wy = boss; for (let i = 0; i < 300; i++) updateBoss(wy); player.invuln = 0; lv = lives; var wh = wy.hp;
  const s = wy.segs[6]; player.x = s.x - 24; player.y = s.y - 10 - 26; bossCollide(wy);`);
assert.equal(run('lives === lv && wy.hp === wh'), true, 'bouncing on the wyrm body from above is safe');
run(`player.invuln = 0; wy.invulnT = 0; player.x = wy.x; player.y = wy.y - 20; bossCollide(wy);`);
assert.equal(run('wy.hp'), run('wh - 1'), 'the head takes the hit');

['shrieker', 'gargoyle', 'storm', 'wyrm'].forEach((type, i) => {
  run(`startGame(); wave = ${(i + 1) * 4}; spawnWave();`);
  for (let f = 0; f < 1500; f++) { run('player.invuln = 1e9; lives = 3; update();'); if (f % 60 === 0) run('draw();'); }
  assert.ok(run('boss !== null'), `${type} survives idling`);
  run('witches = []; boss.hp = 0; update();');
  assert.equal(run('boss'), null, `${type} can be defeated`);
});

// --- the full run loops back to the rooftops ---
run('startGame(); player.invuln = 1e9;');
for (let f = 0; f < 40000 && run('wave') < 17; f++) {
  run('update();');
  if (f % 400 === 0) run('draw();');
  run('player.invuln = 1e9; lives = 3; if (!waveDelay) { witches = []; if (boss) boss.hp = 0; }');
}
steps(200);
assert.equal(run('wave'), 17);
assert.equal(run('stageIdx === 0 && cycleOfWave(wave) === 1'), true, 'loops back to the rooftops');

// --- attract pilot ---
run('startGame(); Arcade.attract = true;');
for (let f = 0; f < 900; f++) run('update(); if (lives < 3) lives = 3; if (ending) ending = 0;');
run('Arcade.attract = false;');

// --- the last life plays a GAME OVER beat before the initials prompt ---
run(`startGame(); ${calm} ${keeper} lives = 1; hurtLuno();`);
assert.equal(run('gameOver'), false);
steps(151);
assert.equal(run('gameOver'), true);
assert.equal(submitted, run('score'));

console.log("Luno's Flight: fixed step, destroyable ghosts, spirit dive + stomp, jousts, fading clouds, lightning, bell, 4 bosses, loop, attract, ending passed.");
