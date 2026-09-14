// Headless rules test for Swarm: loads the sprite kit and the six game
// scripts into a VM with a stub canvas, then drives update() directly.
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
  if (!elements.has(id)) elements.set(id, { width: 960, height: 540, getContext: () => ctx, addEventListener: noop, classList: { add: noop, remove: noop }, style: {}, textContent: '', innerHTML: '', getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }) });
  return elements.get(id);
};
let submitted = null, clock = 0;
const sandbox = {
  console, Math, setTimeout: noop, location: { search: '' },
  performance: { now: () => clock },
  localStorage: { getItem: () => null, setItem: noop },
  document: { body: { classList: { add: noop } }, getElementById: el },
  addEventListener: noop,
  TouchPad: { init: noop, sync: noop, draw: noop }, ArcadeControls: { applyAim: noop }, ArcadeVR: { schedule: noop },
  Arcade: { submitFlow: (s, done) => { submitted = s; done(); }, boardHTML: () => '', slug: 'spectral-manor-swarm' },
  ArcadeAudio: { context: () => null, resume: noop }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('public/arcade/games/wave3/sprite-kit.js', 'utf8'), sandbox, { filename: 'sprite-kit.js' });
vm.runInContext(fs.readFileSync('public/arcade/games/kit/hero-kit.js', 'utf8'), sandbox, { filename: 'hero-kit.js' });
const dir = 'public/arcade/games/spectral-manor-swarm/';
['arena.js', 'fx.js', 'hero.js', 'bosses.js', 'render.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const quiet = 'introTime = 0; monsters = []; enemyBolts = []; bosses = []; strikes = []; shockRings = []; graves = []; hitPause = 0; waveDelay = 0; player.invuln = 0; player.shieldT = 0; player.dashT = 0;';
const keeper = "spawnMonster('brute', 40, 480)";   // keeps the wave from clearing mid-test

// --- start ---
run('startGame();');
assert.equal(run('arenaIdx'), 0);
assert.ok(run('monsters.length') >= 8 && run('fans.length') >= 8);
assert.equal(run('graves.length'), 4, 'the graveyard has graves');
run('draw();');

// --- fixed timestep ---
run('previousFrame = 1000; accumulator = 0;'); clock = 1051; run('var t0 = tick; loop();');
assert.equal(run('tick - t0'), 3);

// --- weapons: twin beams, spread, rapid, muzzle flash ---
run(`${quiet} ${keeper}; player.powerType = null; player.fireCooldown = 0; mouse.down = true; bullets = []; muzzles = []; update(); mouse.down = false;`);
assert.equal(run('bullets.length'), 2, 'twin parallel beams');
assert.ok(run('muzzles.length') >= 1);
run('bullets = []; player.powerType = "spread"; player.powerTime = 100; player.fireCooldown = 0; mouse.down = true; update(); mouse.down = false;');
assert.equal(run('bullets.length'), 5);
run('bullets = []; player.powerType = "rapid"; player.fireCooldown = 0; mouse.down = true; update(); mouse.down = false;');
assert.equal(run('bullets.length'), 1);

// --- one beam damages one monster ---
run(`${quiet} player.powerType = null; bullets = []; var a = spawnMonster('brute', 600, 300), b2 = spawnMonster('brute', 600, 300); a.speed = b2.speed = 0;
  bullets.push({x: a.x + 10, y: a.y + 10, vx: 0, vy: 0, life: 10, age: 5, kind: 'dual', seed: 0}); collide();`);
assert.equal(run('a.hp + b2.hp'), run('a.maxHp + b2.maxHp - 1'));

// --- the lance pierces a line of monsters and stops at a crypt ---
run(`${quiet} obstacles = []; player.x = 100; player.y = 300; mouse.x = 900; mouse.y = player.y - 12;
  var l1 = spawnMonster('brute', 300, 285), l2 = spawnMonster('brute', 420, 285); l1.speed = l2.speed = 0; l1.hp = l2.hp = 20;
  player.powerType = 'lance'; player.powerTime = 999; mouse.down = true;`);
steps(20);
assert.ok(run('l1.hp < 20 && l2.hp < 20'), 'lance hits both');
assert.ok(run('!!lance'));
run(`obstacles = [{kind: 'crypt', x: 200, y: 230, w: 40, h: 90}]; l1.hp = l2.hp = 20;`);
steps(20);
assert.equal(run('l1.hp + l2.hp'), 40, 'a crypt blocks the lance');
run('mouse.down = false; player.powerType = null; obstacles = [];');

// --- dash: moves fast and is untouchable ---
run(`${quiet} ${keeper}; player.x = 300; player.y = 300; player.dashCd = 0; keys.KeyD = true; keys.ShiftLeft = true; var x0 = player.x; var lv = lives;`);
steps(1);
run('keys.ShiftLeft = false; enemyBolts.push({x: player.x + 13, y: player.y + 10, vx: 0, vy: 0, r: 5, color: "#22d3ee", life: 60, trail: [], seed: 0});');
steps(4);
assert.equal(run('lives'), run('lv'), 'no damage mid-dash');
assert.ok(run('player.x - x0') > 50, 'dash covers ground');
run('keys.KeyD = false; enemyBolts = [];');

// --- shield soaks hits ---
run(`${quiet} ${keeper}; player.shieldT = 100; var lv2 = lives; assert = hurtPlayer();`);
assert.equal(run('lives'), run('lv2'));

// --- graveyard: a cracking grave raises a monster ---
run(`${quiet} ${keeper}; graveBudget = 3; graves = [{x: 700, y: 400, state: 'crack', t: 1}]; var mc = monsters.length;`);
steps(2);
assert.equal(run('monsters.length'), run('mc + 1'));

// --- concert grounds: a speaker blast shoves but never costs a life ---
run(`wave = 6; spawnWave(); ${quiet} ${keeper}; obstacles = [{kind: 'speaker', x: 400, y: 260, w: 60, h: 50, pulse: {phase: 'warn', t: 1}}];
  player.x = 470; player.y = 320; var lv3 = lives, px0 = player.x;`);
steps(20);
assert.equal(run('lives'), run('lv3'));
assert.ok(run('player.x') > run('px0'), 'shoved away from the speaker');

// --- courtyard: lightning lands on its ring ---
run(`wave = 11; spawnWave(); ${quiet} ${keeper}; obstacles = []; player.x = 480; player.y = 300; var lv4 = lives;
  strikes = [{x: player.x + 13, y: player.y + 26, state: 'warn', t: 1, seed: 1}];`);
steps(2);
assert.equal(run('lives'), run('lv4 - 1'));
run('draw();');

// --- bosses ---
run(`wave = 5; spawnWave(); player.invuln = 1e9;`);
assert.equal(run('bosses.map(b => b.type).join()'), 'golem');
run(`var g = bosses[0]; g.state = 'charge'; g.t = 40; g.chargeA = 0; g.x = 300; g.y = 300;
  obstacles = [{kind: 'crypt', x: 360, y: 230, w: 60, h: 60}];`);
steps(12);
assert.equal(run('g.state'), 'stagger', 'charging into a crypt staggers the golem');
assert.equal(run('obstacles.length'), 0, 'and smashes it');
const ghp = run('g.hp'); run('damageBoss(g, 1);'); assert.equal(run('g.hp'), ghp - 2, 'double damage while staggered');
run('wave = 10; spawnWave();');
assert.equal(run('bosses[0].type'), 'banshee');
run('wave = 15; spawnWave();');
assert.equal(run('bosses.map(b => b.type).join()'), 'golem,banshee', 'the courtyard finale is both');
for (let f = 0; f < 1500; f++) { run('player.invuln = 1e9; lives = 3; update();'); if (f % 50 === 0) run('draw();'); }
assert.ok(run('bosses.length') > 0, 'bosses survive idling');
run('monsters = []; bosses.forEach(b => b.hp = 0); update();');
assert.equal(run('bosses.length'), 0);
steps(170);  // boss death hit-pause (12) + arena change delay (120)
assert.equal(run('wave'), 16);
assert.equal(run('arenaIdx === 0 && cycleOfWave(wave) === 1'), true, 'loops back to the graveyard');

// --- the attract pilot plays without errors ---
run('startGame(); ATTRACT_PILOT_TEST = true;');
for (let f = 0; f < 900; f++) run('attractPilot(); update(); if (lives < 3) lives = 3; if (ending) ending = 0;');

// --- the last life plays a GAME OVER beat before the initials prompt ---
run(`startGame(); ${quiet} ${keeper}; lives = 1; hurtPlayer();`);
assert.equal(run('gameOver'), false);
steps(151);
assert.equal(run('gameOver'), true);
assert.equal(submitted, run('score'));

console.log('Swarm: fixed step, twin/spread/rapid beams, single-hit, lance pierce + cover, dash, shield, graves, speakers, lightning, golem stagger, banshee, duo, loop, attract, ending passed.');
