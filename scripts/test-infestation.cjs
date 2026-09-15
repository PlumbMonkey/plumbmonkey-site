// Headless rules test for Infestation: loads the four game scripts into a VM
// with a stub canvas, then drives update() and the rule helpers directly.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const noop = () => {};
const ctx = new Proxy({ measureText: () => ({ width: 100 }) }, {
  get: (o, k) => (k in o ? o[k] : String(k).startsWith('create') ? () => ({ addColorStop: noop }) : noop),
  set: (o, k, v) => ((o[k] = v), true)
});
const elements = new Map();
const makeEl = () => ({ width: 960, height: 540, getContext: () => ctx, addEventListener: noop, classList: { add: noop, remove: noop }, style: {}, textContent: '', innerHTML: '' });
const el = id => { if (!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); };
let submitted = null;
let clock = 0;
const sandbox = {
  console, Math, Date, setTimeout: noop, setInterval: () => 1,
  performance: { now: () => clock },
  document: { getElementById: el, createElement: makeEl },
  window: { addEventListener: noop },
  ArcadeVR: { schedule: noop },
  ArcadeAudio: { context: () => null, resume: noop },
  Arcade: { attract: false, slug: 'spectral-manor-infestation', boardHTML: () => '', submitFlow: (s, done) => { submitted = s; done(); } }
};
vm.createContext(sandbox);
const dir = 'public/arcade/games/spectral-manor-infestation/';
['grounds.js', 'sprites.js', 'bosses.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
// an empty, quiet field in play: no spawns, no terrain, no boss
const calm = `phase = 'play'; readyT = 0; dying = 0; ending = 0; boss = null;
  critters = []; eggs = []; spores = []; webs = []; acids = []; pickups = []; blasts = []; bullets = [];
  mushrooms = {}; poisoned = {}; puffs = {}; blocks = {}; waterRows = []; lilies = []; segments = [];
  Object.keys(spawnT).forEach(k => spawnT[k] = 1e9); player.x = 900; player.y = 520;`;
const seg = (c, r, extra = '') => `({ x: cellX(${c}), y: cellY(${r}), dir: 1, vdir: 1, drop: 0, speed: 0, head: false, legPhase: 0, subPhase: 0, sub: false, diving: false ${extra} })`;
const enterBoss = g => run(`startGame(); groundIdx = ${g}; levelIdx = 3; enterLevel(); Object.keys(spawnT).forEach(k => spawnT[k] = 1e9);`);

// --- flow: title first, the hauntipede only arrives after it ---
run('startGame();');
assert.equal(run('phase'), 'intro');
assert.equal(run('segments.length'), 0, 'nothing moves under the level title');
steps(160);
assert.equal(run('phase'), 'play');
assert.equal(run('segments.length'), 10);
assert.ok(run('segments[0].head && !segments[1].head'));

// --- fixed timestep: 3 frames of wall time = 3 rule steps ---
run('lastFrame = null; acc = 0; loop(1000); var t0 = tick; loop(1051);');
assert.equal(run('tick - t0'), 3);

// Unit checks below use an empty field, which would otherwise count as a
// cleared level on the first step; the clear rule is restored for its own test.
run('var realCheckClear = checkClear; checkClear = function () {};');

// --- layouts are set designs: same level → same field; every level differs ---
const fields = [];
for (let g = 0; g < 4; g++) for (let l = 0; l < 4; l++) {
  const a = run(`JSON.stringify(buildField(${g}, ${l}))`);
  assert.equal(a, run(`JSON.stringify(buildField(${g}, ${l}))`), `field ${g}-${l} is deterministic`);
  fields.push(a);
  const clash = run(`(() => { const f = buildField(${g}, ${l});
    return Object.keys(f.mushrooms).filter(k => f.blocks[k] || f.water.includes(+k.split(',')[1])).length; })()`);
  assert.equal(clash, 0, `no toadstool on a block or in water (${g}-${l})`);
  assert.ok(run(`Object.values(buildField(${g}, ${l}).blocks).every(b => b && typeof b === 'object')`), 'blocks are objects, never a falsy variant');
}
assert.equal(new Set(fields).size, 16, 'all sixteen fields are distinct');
assert.ok(run('Object.values(buildField(1, 0).blocks).some(b => b.type === "lantern")'), 'the pumpkin patch has lanterns');
assert.ok(run('Object.values(buildField(3, 2).blocks).filter(b => b.type === "trap").length >= 4'), 'the conservatory has flytraps');
assert.equal(run('JSON.stringify(buildField(2, 2).water)'), '[5,9,13]');

// --- one shot kills exactly one segment, and the one behind becomes a head ---
run(`${calm} segments = [${seg(10, 5, ', head: true')}, ${seg(9, 5)}, ${seg(8, 5)}];
  bullets = [{ x: cellX(9), y: cellY(5) + 5, vx: 0, vy: -11 }]; update();`);
assert.equal(run('segments.length'), 2);
assert.ok(run('segments.every(s => s.head)'), 'split: the tail piece gets its own head');
assert.equal(run('mushrooms[key(9, 5)]'), 4, 'a dead segment leaves a toadstool');

// --- tombstones stop shots and survive; pumpkins take five hits ---
run(`${calm} blocks[key(5, 8)] = { type: 'stone', v: 1 }; bullets = [{ x: cellX(5), y: cellY(8) + 4, vx: 0, vy: -11 }]; update();`);
assert.equal(run('bullets.length'), 0);
assert.ok(run('blocks[key(5, 8)]'));
run(`${calm} blocks[key(5, 8)] = { type: 'pumpkin', hp: 5 };`);
for (let i = 0; i < 5; i++) run('bullets = [{ x: cellX(5), y: cellY(8) + 4, vx: 0, vy: -11 }]; update();');
assert.equal(run('blocks[key(5, 8)]'), undefined);

// --- a jack-o'-lantern blast clears the 3×3, kills nearby segments, chains ---
run(`${calm} blocks[key(10, 8)] = { type: 'lantern', hp: 1 }; blocks[key(11, 8)] = { type: 'lantern', hp: 2 };
  mushrooms[key(9, 7)] = 4; mushrooms[key(9, 9)] = 4; mushrooms[key(14, 8)] = 4;
  segments = [${seg(8, 8, ', head: true')}];
  bullets = [{ x: cellX(10), y: cellY(8) + 4, vx: 0, vy: -11 }]; update();`);
assert.equal(run('blocks[key(10, 8)]'), undefined);
assert.equal(run('mushrooms[key(9, 7)] || mushrooms[key(9, 9)] || 0'), 0);
assert.equal(run('segments.length'), 0, 'the blast killed the segment');
steps(10);
assert.equal(run('blocks[key(11, 8)]'), undefined, 'the neighbouring lantern went off');

// --- flytraps: open eats the hauntipede, closed turns it ---
run(`${calm} playT = 0; blocks[key(11, 5)] = { type: 'trap', phase: 0 }; segments = [${seg(10, 5, ', head: true, speed: 1')}]; update();`);
assert.equal(run('segments.length'), 0, 'an open trap ate the segment');
run(`${calm} playT = 0; blocks[key(11, 5)] = { type: 'trap', phase: 130 }; segments = [${seg(10, 5, ', head: true, speed: 1')}]; update();`);
assert.equal(run('segments.length === 1 && segments[0].dir'), -1, 'a closed trap turns it');
assert.equal(run('segments[0].drop'), 24);
run(`${calm} playT = 0; blocks[key(5, 8)] = { type: 'trap', phase: 0 }; bullets = [{ x: cellX(5), y: cellY(8) + 4, vx: 0, vy: -11 }]; update();`);
assert.equal(run('bullets.length + (blocks[key(5, 8)] ? 1 : 0)'), 1, 'an open trap swallows the shot and survives');

// --- poison: hitting a poisoned toadstool sends a segment diving ---
run(`${calm} mushrooms[key(11, 5)] = 4; poisoned[key(11, 5)] = true; segments = [${seg(10, 5, ', head: true, speed: 1')}]; update();`);
assert.ok(run('segments[0].diving'));
steps(80);
assert.equal(run('segments[0].y'), run('cellY(ROWS - 2)'));

// --- zone: the hauntipede climbs back up through the zone instead of sticking at the bottom ---
run(`${calm} segments = [${seg(39, 20, ', head: true, speed: 2')}]; update();`);
assert.equal(run('segments[0].vdir'), -1);
assert.equal(run('segments[0].drop'), -24);

// --- bog: underwater segments can't be shot; lily pads stop shots ---
run(`${calm} waterRows = [5]; segments = [${seg(10, 5, ', head: true')}];
  segments[0].subPhase = (150 - ((tick + 1) % 150)) % 150;
  bullets = [{ x: cellX(10), y: cellY(5) + 5, vx: 0, vy: -11 }]; update();`);
assert.ok(run('segments[0].sub'));
assert.equal(run('segments.length'), 1, 'the shot passed over the swimmer');
run(`${calm} waterRows = [5]; lilies = [{ row: 5, x: cellX(10), vx: 0, spin: 0, bump: 0 }]; bullets = [{ x: cellX(10), y: cellY(5) + 5, vx: 0, vy: -11 }]; update();`);
assert.equal(run('bullets.length'), 0);

// --- puffballs pop in one hit; their spores are lethal once they bloom ---
run(`${calm} mushrooms[key(20, 15)] = 4; puffs[key(20, 15)] = true; bullets = [{ x: cellX(20), y: cellY(15) + 4, vx: 0, vy: -11 }]; update();`);
assert.equal(run('mushrooms[key(20, 15)]'), undefined);
assert.equal(run('spores.length'), 1);
run(`lives = 3; spores[0].x = 300; spores[0].y = 480; spores[0].vx = 0; spores[0].vy = 0; player.x = 300; player.y = 480; update();`);
assert.equal(run('lives'), 3, 'a fresh spore cloud is harmless');
run('spores[0].age = 60; spores[0].r = 30; player.x = spores[0].x; player.y = spores[0].y; update();');
assert.equal(run('Math.round(player.y)'), 480, 'the spore sits inside the zone');
assert.equal(run('lives'), 2);

// --- death: survivors regroup at the top, the field is restored ---
run(`${calm} lives = 3; segments = [${seg(5, 5, ', head: true')}, ${seg(4, 5)}, ${seg(3, 5)}];
  mushrooms[key(7, 7)] = 1; poisoned[key(7, 7)] = true; var s0 = score; loseLife();`);
assert.equal(run('lives'), 2);
steps(70);
assert.equal(run('segments.length'), 3);
assert.ok(run('segments.every(s => s.y === cellY(1))'));
assert.equal(run('mushrooms[key(7, 7)]'), 4);
assert.equal(run('!!poisoned[key(7, 7)]'), false);
assert.ok(run('score - s0') >= 5);
assert.ok(run('readyT > 0'));

// --- extra life every 12,000 ---
assert.equal(run('FIRST_EXTRA_LIFE'), 25000);
run('lives = 2; score = 24990; nextLife = FIRST_EXTRA_LIFE; addScore(20);');
assert.equal(run('lives'), 3); assert.equal(run('nextLife'), 75000);
run('lives = 5; score = 74990; addScore(20);');
assert.equal(run('lives'), 5, 'never more than five lives in hand'); assert.equal(run('nextLife'), 125000);
assert.ok(run('GROUNDS[3].speedMult > 1 && GROUNDS[3].spawnMult > 1 && GROUNDS[3].spores === 3'), 'the conservatory is the hardest ground');

// --- progression: 1-1 → 1-2 → 1-3 → boss → pumpkin patch; the loop is a new cycle ---
run(`startGame(); groundIdx = 0; levelIdx = 2; advance();`);
assert.equal(run('isBossLevel() && levelDef().type'), 'mother');
run('advance();');
assert.equal(run('ground().id + " " + levelIdx'), 'pumpkin 0');
run('groundIdx = 3; levelIdx = 3; advance();');
assert.equal(run('groundIdx + " " + cycle'), '0 1');
assert.ok(run('cycleMult > 1'));

// --- level clear waits for every segment AND every egg ---
run('checkClear = realCheckClear;');
run(`${calm} eggs = [{ c: 3, r: 3, x: cellX(3), y: cellY(3), hp: 2, t: 999 }]; checkClear();`);
assert.equal(run('phase'), 'play');
run('eggs = []; checkClear();');
assert.equal(run('phase'), 'clear');

// ============ Bosses ============

// --- Grave Mother: body plates block and shed; only the head takes damage; eggs hatch ---
enterBoss(0); steps(160);
assert.equal(run('boss && boss.type'), 'mother');
run('boss.x = 480; boss.y = cellY(8); boss.dir = 1; boss.descend = 0; trailReset(boss, -1, 0);');
const hp0 = run('boss.hp');
run('bullets = []; hitBullet({ x: boss.x, y: boss.y + 4, vx: 0, vy: -11 });');
assert.equal(run('boss.hp'), hp0 - 1, 'head shot hurts');
run('var n0 = boss.nodes.length, nx = boss.nodes[2];');
for (let i = 0; i < 2; i++) run('hitBullet({ x: nx.x, y: nx.y, vx: 0, vy: -11 });');
assert.equal(run('boss.hp'), hp0 - 1, 'plate shots do not hurt her');
assert.equal(run('boss.nodes.length'), run('n0'));
run('hitBullet({ x: nx.x, y: nx.y, vx: 0, vy: -11 });');
assert.equal(run('boss.nodes.length'), run('n0 - 1'), 'third hit sheds the plate');
run(`${calm.replace('boss = null;', '')} layEgg(5, 6); eggs[0].t = 1; update();`);
assert.equal(run('eggs.length'), 0);
assert.equal(run('segments.length'), 4, 'the egg hatched a small hauntipede');

// --- Harvest Widow: triple damage while she is down on the ground ---
enterBoss(1); steps(160);
assert.equal(run('boss.type'), 'widow');
run('boss.state = "patrol"; boss.y = 72; boss.x = 400; var w0 = boss.hp;');
run('hitBullet({ x: boss.x, y: boss.y + 4, vx: 0, vy: -11 });');
assert.equal(run('w0 - boss.hp'), 1);
run('boss.state = "bottom"; boss.y = H - 58; boss.wait = 40; w0 = boss.hp; hitBullet({ x: boss.x, y: boss.y + 4, vx: 0, vy: -11 });');
assert.equal(run('w0 - boss.hp'), 3);
run('boss.state = "web"; boss.wait = 20; boss.shots = []; updateBoss(boss);');
assert.equal(run('boss.shots.length'), 3);
run('boss.shots.forEach(s => s.t = s.T - 1); webs = []; updateBoss(boss);');
assert.equal(run('webs.length'), 3, 'web blobs land as webs');
run('player.x = webs[0].x; player.y = webs[0].y; movePlayer(null);');
assert.ok(run('player.slowed'));

// --- Bog Wyrm: immune underwater, head hittable once surfaced ---
enterBoss(2); steps(160);
assert.equal(run('boss.type'), 'wyrm');
assert.equal(run('bossBulletHit(boss, { x: boss.x, y: boss.y })'), 0);
run('boss.wait = 1; updateBoss(boss); boss.wait = 1; updateBoss(boss);');
assert.equal(run('boss.state'), 'swim');
for (let i = 0; i < 40; i++) run('updateBoss(boss);');
assert.equal(run('bossBulletHit(boss, { x: boss.x, y: boss.y })'), 1);
assert.ok(run('Number.isFinite(boss.x) && boss.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))'));

// --- Mandrake: armored when closed, hurt when open; the vine lashes the marked column ---
enterBoss(3); steps(160);
assert.equal(run('boss.type'), 'mandrake');
assert.equal(run('bossBulletHit(boss, { x: boss.x, y: boss.y })'), -1);
run('boss.state = "open"; boss.wait = 50;');
assert.equal(run('bossBulletHit(boss, { x: boss.x, y: boss.y })'), 1);
run('boss.state = "idle"; boss.wait = 1; boss.atk = 0; player.x = 300; player.y = 500; updateBoss(boss);');
assert.equal(run('boss.state'), 'lash');
for (let i = 0; i < 56; i++) run('updateBoss(boss);');
assert.ok(run('bossTouches(boss, boss.vines[0].cx, 500, 10)'), 'the slam is lethal in its column');
assert.ok(!run('bossTouches(boss, boss.vines[0].cx + 120, 500, 10)'), 'and only there');

// --- killing a boss clears the ground ---
enterBoss(1); steps(160);
run('Object.keys(spawnT).forEach(k => spawnT[k] = 1e9); segments = []; boss.hp = 1; hitBullet({ x: boss.x, y: boss.y + 4, vx: 0, vy: -11 });');
assert.ok(run('boss.dying > 0'));
steps(111);
assert.equal(run('boss'), null);
assert.equal(run('phase'), 'clear');
steps(110);
assert.equal(run('ground().id + " " + levelIdx'), 'bog 0');

// --- last life: a GAME OVER beat before the initials prompt ---
run(`${calm} lives = 1; submitted = null; gameRunning = true; loseLife();`);
assert.equal(run('lives'), 0);
steps(149);
assert.equal(submitted, null, 'no initials prompt on the death frame');
steps(1);
assert.equal(run('gameRunning'), false);
assert.notEqual(submitted, null);

// --- soak: the attract pilot plays every ground with lives topped up; nothing goes NaN ---
sandbox.Arcade.attract = true;
run('startGame();');
const seen = new Set();
for (let i = 0; i < 60000; i++) {
  run('lives = 3; update();');
  if (i % 50 === 0) {
    seen.add(run('levelLabel()'));
    assert.ok(run('segments.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)) && critters.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)) && (!boss || Number.isFinite(boss.x) && Number.isFinite(boss.y))'), 'positions stay finite');
  }
  if (i % 3000 === 2999) {
    // nudge progress so the soak covers bosses too: finish whatever is on the field
    run('if (phase === "play") { segments.forEach(s => s.dead = true); sweepSegments(); eggs = []; if (boss && !boss.dying) { boss.hp = 1; damageBoss(1, boss.x, boss.y); } }');
  }
}
sandbox.Arcade.attract = false;
['1-4', '2-4', '3-4', '4-4'].forEach(l => assert.ok(seen.has(l), `soak reached boss ${l}`));

console.log(`infestation rules ok (soak saw ${seen.size} levels)`);
