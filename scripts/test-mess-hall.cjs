// Headless rules test for Mess Hall: loads the five game scripts into a VM
// with a stub canvas, then drives update() directly.
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
let submitted = null;
const sandbox = {
  console, Math, performance: { now: () => 0 }, location: { search: '' }, setTimeout: noop,
  localStorage: { getItem: () => null, setItem: noop },
  document: { body: { classList: { add: noop } }, getElementById: el },
  window: { addEventListener: noop },
  TouchPad: { init: noop, sync: noop, draw: noop }, ArcadeControls: { applyAim: noop }, ArcadeVR: { schedule: noop },
  Arcade: { submitFlow: (s, done) => { submitted = s; done(); }, boardHTML: () => '', slug: 'spectral-manor-mess-hall' },
  ArcadeAudio: { context: () => null, resume: noop }
};
vm.createContext(sandbox);
const dir = 'public/arcade/games/spectral-manor-mess-hall/';
['rooms.js', 'cast.js', 'boss.js', 'render.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const calm = "player.invuln = 0; foods = []; lobs = []; boss = null; hitPause = 0; waveDelay = 0; bannerTime = 0;";
const dummy = (x, y, extra = '') => `Object.assign(spawnMonster('frank', ${x}, ${y}, {safe: 0}), {x: ${x}, y: ${y}, speed: 0, throwTimer: 999, stealTimer: 999, aggression: 0 ${extra}})`;

// --- spawns ---
run('startGame();');
assert.equal(run('pickups.every(p => !tables.some(t => p.x < t.x + t.w && p.x + p.w > t.x && p.y < t.y + t.h && p.y + p.h > t.y))'), true);
assert.equal(run('chefs.every(c => Math.hypot(c.x + 15 - player.x - 14, c.y + 17 - player.y - 16) >= 150)'), true);
assert.equal(run('roomIdx'), 0);

// --- simultaneous hostile food costs one life, each food strikes once ---
run(`${calm} chefs = []; ${dummy(800, 400)};
  foods = Array.from({length: 4}, () => ({x: player.x + 14, y: player.y + 16, vx: 0, vy: 0, life: 80, fromChef: true, color: '#fff'})); update();`);
assert.equal(run('lives'), 2);

// --- one hero food damages one monster ---
run(`hitPause = 0; player.invuln = 100; chefs = []; ${dummy(700, 400)}; ${dummy(700, 400)};
  foods = [{x: 712, y: 420, vx: 0, vy: 0, life: 80, color: '#fff'}]; update();`);
assert.equal(run('chefs.reduce((s, c) => s + c.hp, 0)'), 5);

// --- resupply when out of food ---
run('ammo = 0; pickups = []; foods = []; update();');
assert.ok(run('pickups.some(p => !p.power)'));

// --- pause freezes the hero ---
run('paused = true; keys.KeyD = true;');
const x = run('player.x'); run('update();'); assert.equal(run('player.x'), x);
run('paused = false; keys.KeyD = false;');

// --- food bounces off a table once ---
run('hitPause = 0; foods = [{x: 179, y: 160, vx: 3, vy: 1, life: 80, color: "#fff"}]; update();');
assert.ok(Math.abs(run('foods[0].vx') + 2.1) < 1e-9);

// --- the windmill: food leaves the hand at the bottom of the circle, not at the start ---
run(`${calm} chefs = [${'{'}x: 900, y: 480, w: 30, h: 34, hp: 9, maxHp: 9, speed: 0, type: 'frank', throwTimer: 999, stealTimer: 999, aggression: 0, walkPhase: 0, throwAnim: 0, throwDur: 30, angle: 0${'}'}];
  ammo = 10; player.power = null; player.throwAnim = 0; player.throwCooldown = 0; mouse.x = 900; mouse.y = player.y; keys.Space = true;`);
steps(12);
assert.equal(run('foods.filter(f => !f.fromChef).length'), 0, 'no food during the wind-up');
steps(1);
assert.equal(run('foods.filter(f => !f.fromChef).length'), 1, 'food released at the bottom of the windmill');
assert.equal(run('Math.round(foods[0].y) === Math.round(heroShoulder().y + 17)'), true, 'released beside the hip');
run('keys.Space = false;');
assert.ok(Math.abs(run('windmillAngle(WINDMILL_RELEASE)') - Math.PI * 2) < 1e-9, 'a full circle by release');

// --- every character and pose draws ---
run(`['vampire','werewolf','frank','ghost','witch'].forEach(type => {
  const c = ${dummy(400, 300)}; c.type = type;
  drawMonster(c, 1); c.throwAnim = 12; c.pendingThrow = {angle: 1, food: {name: 'pie'}}; drawMonster(c, 2); c.carryDish = true; drawMonster(c, 3);
});
player.throwAnim = 9; drawHero(player, 5); player.throwAnim = 0; draw();`);

// --- the full run: 12 levels through 4 rooms, bosses at 6 and 12, then the loop ---
run('startGame(); player.invuln = 1e9;');
const rooms = [], bosses = [];
for (let f = 0; f < 30000 && run('level') < 13; f++) {
  run('update();');
  if (f % 211 === 0) run('draw();');
  if (run('waveDelay') > 0) continue;
  const lv = run('level');
  if (!rooms.includes(run('roomIdx'))) rooms.push(run('roomIdx'));
  if (run('!!boss') && !bosses.includes(lv)) { bosses.push(lv); run('draw();'); }
  run('player.invuln = 1e9; buffet.dishes = 6; chefs = []; if (boss) boss.hp = 0;');
}
assert.deepEqual(rooms, [0, 1, 2, 3], 'visits all four rooms in order');
assert.deepEqual(bosses, [6, 12], 'Head Chef in the Kitchen and the Banquet Hall');
steps(200);
assert.equal(run('roomIdx'), 0, 'loops back to the Mess Hall');
assert.equal(run('cycleOf(level)'), 1);

// --- Kitchen: a flaring stove burns a hero standing beside it ---
run(`startGame(); enterRoom(1); level = 4; ${calm} chefs = []; ${dummy(880, 480)};
  const st = tables.find(t => t.kind === 'stove'); player.x = st.x + st.w + 4; player.y = st.y + 10;
  st.flare = {phase: 'warn', t: 1}; var lv0 = lives;`);
steps(3);
assert.equal(run('lives'), run('lv0 - 1'), 'stove flames hurt');

// --- Cold Pantry: ice keeps the hero sliding after the key is released ---
run(`enterRoom(2); ${calm} const ice = ROOMS[2].ice[0]; player.x = ice.x + 20; player.y = ice.y + 30; keys.KeyD = true;`);
steps(40);
run('keys.KeyD = false; var slideX = player.x;');
steps(5);
assert.ok(run('player.x - slideX') > 3, 'still sliding on ice');

// --- Banquet Hall: a falling chandelier flattens the hero under it ---
run(`enterRoom(3); level = 10; ${calm} player.x = 480; player.y = 300; player.vx = player.vy = 0; lives = 3;
  chandeliers.forEach(c => { c.state = 'hung'; c.t = 999; });
  Object.assign(chandeliers[0], {state: 'warn', t: 1, tx: player.x + 14, ty: player.y + 32});`);
steps(20);
assert.equal(run('lives'), 2, 'chandelier hurts');

// --- witch potion: lands on its ring and leaves a slowing puddle ---
run(`${calm} lives = 3; lobs.push({kind: 'potion', x0: 100, y0: 100, tx: player.x + 14, ty: player.y + 32, t: 0, dur: 5, arc: 40, radius: 34});`);
steps(6);
assert.equal(run('lives'), 2);
assert.equal(run('puddles.length'), 1);

// --- the Head Chef: six quick hits make him dizzy, and he can be beaten ---
run(`startGame(); enterRoom(1); level = 6; ${calm} chefs = []; ${dummy(40, 480)}; boss = createHeadChef(1); boss.state = 'idle'; boss.t = 999; boss.y = 300; player.invuln = 1e9;`);
for (let i = 0; i < 6; i++) run('headChefHit(boss, {x: boss.x, y: boss.y - 30});');
assert.equal(run('boss.state'), 'dizzy');
const hp = run('boss.hp'); run('headChefHit(boss, {x: boss.x, y: boss.y - 30});');
assert.equal(run('boss.hp'), hp - 2, 'double damage while dizzy');
['pie', 'cleaver', 'bell', 'slam'].forEach(s => { run(`boss.state = 'idle'; boss.t = 0; boss.lastAttack = null; boss.hp = boss.maxHp * 0.4;`); for (let i = 0; i < 160; i++) run('update(); draw();'); });
run('boss.hp = 0; update();');
assert.equal(run('boss'), null);

// --- the last life plays a GAME OVER beat before the initials prompt ---
run(`startGame(); ${calm} lives = 1; hurtPlayer('test');`);
assert.equal(run('gameOver'), false);
steps(151);
assert.equal(run('gameOver'), true);
assert.equal(submitted, run('score'));

// --- the final plate stays recoverable while another thief is on screen ---
run(`startGame(); ${calm} buffet.dishes = 0; chefs = [${dummy(-55, 200, ', carryDish: true, speed: 1')}, ${dummy(400, 350, ', carryDish: true, speed: 1')}]; chefs.length = 2; update();`);
assert.equal(run('ending'), 0);
run('chefs[0].x = -55; update();');
assert.ok(run('ending') > 0, 'buffet lost starts the ending');

console.log('Mess Hall: spawns, single-hit damage, windmill release, poses, 4 rooms + 2 bosses, stove/ice/chandelier/potion hazards, dizzy chef, ending and thief checks passed.');
