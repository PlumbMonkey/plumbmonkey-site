// Headless rules test for Revenger: loads the kit and the six game scripts into
// a VM with a stub canvas, then drives update() and the rule helpers directly.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const noop = () => {};
const ctx = new Proxy({ measureText: () => ({ width: 60 }) }, {
  get: (o, k) => (k in o ? o[k] : String(k).startsWith('create') ? () => ({ addColorStop: noop }) : noop),
  set: (o, k, v) => ((o[k] = v), true)
});
const elements = new Map();
const makeEl = () => ({ width: 960, height: 540, getContext: () => ctx, addEventListener: noop,
  classList: { add: noop, remove: noop, contains: () => false }, style: {}, textContent: '', innerHTML: '' });
const el = id => { if (!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); };
const listeners = {};
let submitted = null;
const sandbox = {
  console, Math, Date, JSON, setTimeout: noop, setInterval: () => 1,
  performance: { now: () => 0 },
  document: { getElementById: el, createElement: makeEl },
  window: { addEventListener: (t, f) => { listeners[t] = f; } },
  ArcadeVR: { schedule: noop },
  ArcadeAudio: { context: () => null, resume: noop, output: noop },
  Arcade: { attract: false, slug: 'spectral-manor-revenger', boardHTML: () => '', submitFlow: (s, done) => { submitted = s; done(); } }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('public/arcade/games/kit/hero-kit.js', 'utf8'), sandbox, { filename: 'hero-kit.js' });
const dir = 'public/arcade/games/spectral-manor-revenger/';
['sectors.js', 'fx.js', 'ship.js', 'enemies.js', 'bosses.js', 'render.js', 'game.js']
  .forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const key = (type, code, repeat = false) => listeners[type]({ code, repeat, preventDefault: noop });

// --- flow: nothing spawns under the title ---
run('startGame(11);');
assert.equal(run('phase'), 'intro');
assert.equal(run('enemies.length'), 0, 'nothing moves under the sector title');
steps(150);
assert.equal(run('phase'), 'play');
assert.ok(run('enemies.length') >= 5);
assert.equal(run('fans.length'), 10);

// --- fixed timestep: 3 frames of wall time = 3 rule steps (and draw() runs) ---
run('lastFrame = null; acc = 0; loop(1000); var t0 = tick; loop(1051);');
assert.equal(run('tick - t0'), 3);

// unit checks below use a quiet field; the clear and rift rules are restored for their own tests
run('var realCheckClear = checkClear, realCheckRift = checkRift; checkClear = function () {}; checkRift = function () {};');
const calm = `phase = 'play'; enemies = []; enemyShots = []; mines = []; hazards = []; pickups = []; beams = []; boss = null;
  score = 0; nextLife = EXTRA_LIFE_FIRST; hitPause = 0; dawdleT = 0; ship.inv = 0; ship.shield = 0; ship.fireCd = 0; ship.fireQueued = false; ship.x = 1000; ship.y = 200; ship.vx = 0; ship.facing = 1; snapCamera();
  Object.keys(keys).forEach(k => keys[k] = false); fireWasDown = false; shotsFired = 0;`;

// --- one press, one shot ---
run(calm);
key('keydown', 'Space'); run('keys.Space = true;');
steps(60);
assert.equal(run('shotsFired'), 1, 'holding fire shoots once');
for (let i = 0; i < 10; i++) { key('keydown', 'Space', true); steps(3); }
assert.equal(run('shotsFired'), 1, 'auto-repeat keydowns never fire');
key('keyup', 'Space'); steps(1);
key('keydown', 'Space'); steps(1);
assert.equal(run('shotsFired'), 2, 'a fresh press fires again');
key('keyup', 'Space'); steps(10);
key('keydown', 'Space'); key('keyup', 'Space'); steps(1);
assert.equal(run('shotsFired'), 3, 'a tap shorter than a frame still fires');
steps(10);
key('keydown', 'Space'); key('keyup', 'Space'); steps(1);
key('keydown', 'Space'); key('keyup', 'Space'); steps(6);
assert.equal(run('shotsFired'), 5, 'a tap inside the minimum gap is buffered, not swallowed');
run('keys.Space = true;'); steps(30);
run('keys.Space = false;'); steps(1); run('keys.Space = true;'); steps(30);
assert.equal(run('shotsFired'), 7, 'virtual buttons (keys[] only, no events) fire on the press edge');
run('keys.Space = false;'); steps(2);

// --- no auto-fire chip for Revenger ---
assert.match(fs.readFileSync(dir + 'index.html', 'utf8'), /autoFire:\s*false/);
assert.match(fs.readFileSync('public/arcade/games/arcade-controls.js', 'utf8'), /opts\.autoFire !== false/);

// --- laser levels ---
const volley = lv => run(`${calm} ship.laser = ${lv}; ship.options = 0; fireShip(ship); beams.length`);
assert.equal(volley(0), 1);
assert.equal(volley(1), 2);
assert.equal(volley(2), 2);
assert.equal(volley(3), 3);
assert.equal(run('beams.filter(b => b.kind === "wave").length'), 1);
assert.equal(run(`${calm} ship.laser = 1; ship.options = 2; ship.trail = []; for (let i = 0; i < 40; i++) ship.trail.push({ x: 1000, y: 200 }); fireShip(ship); beams.length`), 4, 'each Ghost Option copies the volley');

// --- one beam, one hit; pierce hits each target once ---
const park = (type, x, y = 202) => `(() => { const e = spawnEnemy('${type}', ${x}, ${y}); e.state = 'park'; return e; })()`;
const flyBeams = () => run('for (let i = 0; i < 40; i++) { stepBeams(); resolveHits(); }');
run(`${calm} ship.laser = 0; ${park('bomber', 1100)}; ${park('bomber', 1140)}; fireShip(ship);`);
flyBeams();
assert.equal(run('enemies.length'), 1, 'a level-1 beam kills exactly one of two stacked enemies');
assert.equal(run('Math.round(enemies[0].x)'), 1140, 'and it is the nearer one that dies');
run(`${calm} ship.laser = 2; ${park('bomber', 1100, 196)}; ${park('bomber', 1150, 196)}; ${park('bomber', 1200, 196)}; ${park('carrier', 1250, 196)};
  beams.push(makeBeam(1026, 196, 1, 'laser', 3, 0));`);
flyBeams();
assert.equal(run('enemies.length'), 1, 'pierce spends itself on three targets');
assert.equal(run('enemies[0].type + enemies[0].hp'), 'carrier3', 'the fourth is untouched');
run(`${calm} ${park('carrier', 1100)}; beams.push(makeBeam(1026, 202, 1, 'laser', 3, 0));`);
flyBeams();
assert.equal(run('enemies[0].hp'), 2, 'a piercing beam still hits one target only once');

// --- effects never change the rules ---
const sim = fxOn => run(`FX.enabled = ${fxOn}; FX.reset(); startGame(4242); botMode = true;
  for (let i = 0; i < 2500; i++) { lives = 3; update(); }
  botMode = false;
  JSON.stringify({ score, stageN, phase, tick, x: ship.x.toFixed(4), y: ship.y.toFixed(4), laser: ship.laser, fans: fans.map(f => f.x.toFixed(3) + f.state),
    enemies: enemies.map(e => e.type + e.x.toFixed(3) + ',' + e.y.toFixed(3)), shots: enemyShots.length, fired: shotsFired })`);
run('checkClear = realCheckClear; checkRift = realCheckRift;');
const withFx = sim(true), withoutFx = sim(false);
run('FX.enabled = true;');
assert.equal(withFx, withoutFx, 'explosions and sparks do not affect the rules');
assert.ok(JSON.parse(withFx).fired > 20, 'the bot actually played');
run('checkClear = function () {}; checkRift = function () {};');

// --- power-ups level up and wind down ---
run(`${calm} ship.laser = 0; ship.bombs = 0; ship.warps = 0; ship.options = 0; ship.tractor = false; lives = 3;`);
for (let i = 0; i < 5; i++) run('applyPickup("laser"); applyPickup("bomb"); applyPickup("option"); applyPickup("warp");');
assert.equal(run('ship.laser'), 3);
assert.equal(run('ship.bombs'), run('MAX_BOMBS'));
assert.equal(run('ship.options'), 2);
assert.equal(run('ship.warps'), 3);
run('applyPickup("shield"); applyPickup("tractor");');
run('damageShip();'); assert.equal(run('lives + "/" + ship.shield'), '3/1', 'the shield takes the first hit');
run('ship.inv = 0; damageShip();'); assert.equal(run('lives + "/" + ship.shield'), '3/0', 'and the second');
run('ship.inv = 0; damageShip();');
assert.equal(run('lives'), 2);
assert.equal(run('phase'), 'dying');
steps(120);
assert.equal(run('phase'), 'play');
assert.equal(run('ship.laser + "/" + ship.options + "/" + ship.tractor'), '2/0/false', 'death costs one laser level, options and tractor');
assert.ok(run('dropPickup(500, 200); pickups.length') >= 1);

// --- the Power Chord clears the screen, not the world ---
run(`${calm} ship.bombs = 1; ${park('mutant', 1200)}; ${park('mutant', 1300, 150)}; ${park('mutant', 2800)}; mines.push({ id: 999, x: 1100, y: 250, life: 100, arm: 0, r: 7 }); useBomb();`);
assert.equal(run('enemies.filter(e => !e.dead).length'), 1, 'only the off-screen enemy survives');
assert.equal(run('ship.bombs'), 0);

// --- warp jumps across the planet ---
run(`${calm} seedRng(3); ship.warps = 1; var wx0 = ship.x; useWarp();`);
assert.equal(run('ship.warps'), 0);
assert.ok(run('Math.abs(wrapDX(ship.x, wx0))') > 900);

// --- abduction: a lander lifts a fan away and becomes a mutant ---
run(`${calm} fans = [{ id: 500, x: 2000, y: groundY(2000), vx: 0, vy: 0, state: 'ground', by: 0, fallFrom: 0, look: 0, beat: 0 }]; fansLost = 0;
  var ab = spawnEnemy('lander', 2000, groundY(2000) - 32); ab.fireT = 1e9;`);
run('for (let i = 0; i < 900 && ab.type === "lander"; i++) { stepEnemies(); stepFans(); }');
assert.equal(run('ab.type'), 'mutant');
assert.equal(run('fans.length'), 0);
assert.equal(run('fansLost'), 1);

// --- freed fans: a long fall is fatal, a short one is not, a catch is a rescue ---
const fan = (y, state = 'grabbed') => `fans = [{ id: 501, x: 2000, y: ${y}, vx: 0, vy: 0, state: '${state}', by: 0, fallFrom: 0, look: 1, beat: 0 }];`;
run(`${calm} fansLost = 0; ${fan(200)} releaseFan(fans[0]); for (let i = 0; i < 300; i++) stepFans();`);
assert.equal(run('fans.length + "/" + fansLost'), '0/1', 'dropped from high, a fan is lost');
run(`${calm} ${fan('groundY(2000) - 60')} releaseFan(fans[0]); for (let i = 0; i < 300; i++) stepFans();`);
assert.equal(run('fans[0].state'), 'ground', 'a short drop lands safely');
run(`${calm} rescuedCount = 0; ${fan(200)} releaseFan(fans[0]); ship.x = 2000; ship.y = 200; ship.tractor = false; stepCatch(ship);`);
assert.equal(run('fans[0].state'), 'carried');
run('ship.y = shipFloor(ship.x); stepCatch(ship);');
assert.equal(run('fans[0].state + rescuedCount'), 'ground1');
run(`${calm} ${fan(200)} releaseFan(fans[0]); ship.x = 2080; ship.y = 220; ship.tractor = true; for (let i = 0; i < 40 && fans[0].state === 'falling'; i++) { stepFans(); stepCatch(ship); }`);
assert.equal(run('fans[0].state'), 'carried', 'the tractor pulls a falling fan in');

// --- all fans lost → the Rift; the next sector restores the planet ---
run(`${calm} stageN = 2; info = stageInfo(2); rift = false; fans = []; ship.carried = []; ${park('lander', 3000)};`);
run('realCheckRift();');
assert.equal(run('rift + phase'), 'truerift');
assert.equal(run('enemies[0].type'), 'mutant', 'surviving landers mutate');
steps(110);
assert.equal(run('phase'), 'play');
run('spawnEnemy("lander", 100, 100).type === "mutant"') ;
assert.equal(run('enemies[enemies.length - 1].type'), 'mutant', 'new landers arrive mutated inside the Rift');
run('stageN = 3; nextStage();');
assert.equal(run('rift + "/" + fans.length + "/" + info.sectorIdx'), 'false/10/1');

// --- the four motherships: the body soaks shots, the open weak point takes them ---
run('checkClear = realCheckClear; checkRift = realCheckRift;');
const fireAtPart = kind => run(`(() => {
  const p = bossParts(boss).find(q => q.kind === '${kind}');
  ship.x = wrapX(p.x - 300); ship.y = p.y; ship.facing = 1;
  beams = [makeBeam(ship.x + 26, p.y, 1, 'laser', 1, 0)];
  for (let i = 0; i < 30; i++) { stepBeams(); if (beams[0]) beamHitBoss(beams[0], boss); }
  return boss.hp;
})()`);
const bosses = [
  ['harvester', 'b => { b.state = "beam"; }'],
  ['ossuary', 'b => { b.turrets.forEach(t => t.hp = 0); b.state = "vent"; }'],
  ['leviathan', 'b => { b.state = "dazed"; b.dir = -1; }'],
  ['dreadnought', 'b => { b.spin = -Math.PI / 10; }']
];
bosses.forEach(([type, open], i) => {
  run(`startGame(21); stageN = ${i * 4 + 3}; enterStage(); steps0 = 0;`.replace('steps0 = 0;', ''));
  steps(150);
  assert.equal(run('boss && boss.type'), type);
  run('boss.state = "hover"; boss.t = 0; enemies = []; enemyShots = []; mines = [];');
  if (type === 'leviathan') run('boss.dir = -1;');
  const hp0 = run('boss.hp');
  if (type !== 'dreadnought') assert.equal(fireAtPart('armor'), hp0, `${type}: a closed weak point is armour`);
  assert.equal(fireAtPart(type === 'dreadnought' ? 'shield' : 'body'), hp0, `${type}: the body soaks the shot`);
  run(`(${open})(boss)`);
  if (type === 'ossuary') {
    run('boss.turrets.forEach(t => t.hp = 5); boss.state = "hover";');
    const tp = run('(() => { const p = bossParts(boss).find(q => q.kind === "turret"); ship.x = wrapX(p.x - 300); ship.y = p.y; beams = [makeBeam(ship.x + 26, p.y, 1, "laser", 1, 0)]; for (let i = 0; i < 30; i++) { stepBeams(); if (beams[0]) beamHitBoss(beams[0], boss); } return boss.turrets.map(t => t.hp).join(); })()');
    assert.notEqual(tp, '5,5,5', 'ossuary: turrets take damage first');
    run(`(${open})(boss)`);
  }
  assert.equal(fireAtPart('weak'), hp0 - 1, `${type}: the open weak point wins over the body behind it`);
  run('boss.hp = 1;');
  fireAtPart('weak');
  assert.ok(run('boss.dying > 0'), `${type}: goes down`);
  run('phase = "bossDeath";');
  steps(310);
  assert.equal(run('boss'), null);
  assert.equal(run('phase'), 'clear');
  steps(120);
  assert.equal(run('info.wave + "/" + info.sectorIdx + "/" + info.cycle'), `0/${(i + 1) % 4}/${i === 3 ? 1 : 0}`);
});

// --- hazards: the leviathan's lightning lane and the dreadnought's spokes ---
run('startGame(5); stageN = 11; enterStage();');
steps(150);
run(`boss.state = 'hover'; ship.inv = 0;
  hazards = [{ kind: 'lane', x0: wrapX(boss.x - 60), y: 200, dir: -1, len: 700, h: 22, life: 30, max: 30 }]; ship.y = 200; ship.x = wrapX(boss.x - 300);`);
assert.ok(run('hazardHitsShip(hazards[0])'));
run('ship.y = 260;');
assert.ok(!run('hazardHitsShip(hazards[0])'), 'a lane only hurts its own row');

// --- last ship: a GAME OVER beat before the initials prompt ---
run(`startGame(9); steps0 = 0;`.replace('steps0 = 0;', ''));
steps(150);
run(`${calm} lives = 1; submitted = null;`);
submitted = null;
run('damageShip();');
assert.equal(run('phase'), 'ending');
steps(149);
assert.equal(submitted, null, 'no initials prompt on the death frame');
steps(1);
assert.equal(run('gameRunning'), false);
assert.notEqual(submitted, null);

// --- pause freezes the rules ---
run('startGame(1); paused = true; var pt = tick;');
steps(30);
assert.equal(run('tick'), run('pt'));
run('paused = false;');

// --- draw() survives every phase ---
run(`startGame(2); draw(); for (let i = 0; i < 150; i++) update(); draw(); rift = true; draw(); rift = false;
  stageN = 3; enterStage(); for (let i = 0; i < 150; i++) update(); draw(); boss.state = 'beam'; draw();
  phase = 'clear'; draw(); paused = true; draw(); paused = false;`);

// --- soak: the bot plays every sector with ships topped up; nothing goes NaN ---
run('startGame(77); botMode = true; var stuck = 0, lastStage = 0, nudges = 0;');
const reached = new Set();
for (let chunk = 0; chunk < 400; chunk++) {
  run(`for (let i = 0; i < 500; i++) {
    lives = 3; update();
    if (stageN !== lastStage) { lastStage = stageN; stuck = 0; } else if (phase === 'play') stuck++;
    if (stuck > 12000) { nudges++; stuck = 0; enemies.forEach(e => killEnemy(e)); if (boss && !boss.dying) damageBoss(boss, boss.hp, boss.x, boss.y); }
  }`);
  reached.add(run('info.label'));
  assert.ok(run(`[ship.x, ship.y, camX].every(Number.isFinite) && enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y))
    && fans.every(f => Number.isFinite(f.x) && Number.isFinite(f.y)) && (!boss || Number.isFinite(boss.x) && Number.isFinite(boss.y))`), 'positions stay finite');
  if (run('stageN') >= 16) break;
}
const soak = run('({ stageN, nudges, tick, score, rift })');
run('botMode = false;');
['1-M', '2-M', '3-M', '4-M'].forEach(l => assert.ok(reached.has(l), `soak reached mothership ${l}`));
assert.ok(soak.stageN >= 16, `the bot cleared all four sectors (reached stage ${soak.stageN})`);

console.log(`revenger rules ok (soak: ${soak.stageN} stages in ${soak.tick} frames, ${soak.nudges} nudges, score ${soak.score})`);
