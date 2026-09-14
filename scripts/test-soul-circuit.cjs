// Headless rules test for Soul Circuit: loads the five game scripts into a VM
// with a stub canvas, then drives the rules directly.
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
  console, Math, setTimeout: noop, setInterval: noop, location: { search: '' },
  performance: { now: () => clock },
  localStorage: { getItem: () => null, setItem: noop },
  document: { body: { classList: { add: noop } }, getElementById: el, createElement: () => ({ getContext: () => ctx }) },
  addEventListener: noop,
  ArcadeVR: { schedule: noop },
  Arcade: { attract: false, submitFlow: (s, done) => { submitted = s; done(); }, boardHTML: () => '', slug: 'spectral-manor-soul-circuit' },
  ArcadeAudio: { context: () => null, resume: noop }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const dir = 'public/arcade/games/spectral-manor-soul-circuit/';
['realms.js', 'cast.js', 'bosses.js', 'render.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const play = 'ready = 0; levelFade = 0; bannerTime = 0; dying = 0; hitPause = 0;';

// --- every board for two full cycles: connected, symmetric, one cell wide ---
for (let L = 1; L <= 32; L++) {
  const r = run(`(() => {
    const m = generateMaze(${L}), g = m.grid;
    let wide = 0, asym = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (g[r][c] !== g[r][COLS - 1 - c]) asym++;
      if (r < ROWS - 1 && c < COLS - 1 && [g[r][c], g[r+1][c], g[r][c+1], g[r+1][c+1]].every(v => v !== WALL) && !(inPen(r, c) && inPen(r + 1, c + 1))) wide++;
    }
    const d = floodFrom(g, m.tunnels, START_CELL.r, START_CELL.c);
    let unreachable = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (g[r][c] === OPEN && !inPen(r, c) && d[r][c] < 0) unreachable++;
    const power = m.powerCells.every(p => g[p.r][p.c] === OPEN);
    const portals = m.portals.every(pair => pair.every(p => g[p.r][p.c] === OPEN && d[p.r][p.c] >= 0));
    return { wide, asym, unreachable, power, portals, gems: placeCrystals(m, isBossLevel(${L})).count };
  })()`);
  assert.deepEqual([r.wide, r.asym, r.unreachable, r.power, r.portals], [0, 0, 0, true, true], `level ${L} board`);
  assert.ok(r.gems > 80, `level ${L} has crystals`);
}
assert.equal(run('generateMaze(3).grid.join()'), run('generateMaze(3).grid.join()'), 'boards are seeded');

// --- start ---
run('startGame();');
assert.equal(run('level'), 1);
assert.equal(run('hunters.length'), 3);
assert.ok(run('ready') > 0, 'a READY beat before play');
assert.equal(run('gems.flat().filter(Boolean).length'), run('gemsLeft'));
run('draw();');

// --- fixed timestep ---
run('previousFrame = 1000; accumulator = 0;'); clock = 1051; run('var t0 = tick; loop();');
assert.equal(run('tick - t0'), 3);

// --- READY is a canvas beat, never the start overlay (attract restarts on that) ---
run(`startGame(); ${play} hunters = []; lives = 3; hurtSoul();`);
steps(run('DYING_FRAMES'));
assert.ok(run('ready > 0 && gameRunning'), 'resumes via READY');
steps(run('READY_FRAMES'));
assert.equal(run('ready'), 0);

// --- cornering: a turn a few px wide of the junction still lands ---
run(`${play} hunters = []; player.x = (START_CELL.c + 0.5) * CELL + 4; player.y = (START_CELL.r + 0.5) * CELL; player.dir = {x: 1, y: 0};
  keys.ArrowUp = true; var ok = [0, 1].some(() => { updatePlayer(); return player.dir.y === -1; }) || grid[START_CELL.r - 1][START_CELL.c] === WALL; keys.ArrowUp = false;`);
assert.ok(run('ok'), 'turn slack');

// --- clearing the board opens the exit, the exit ends the level ---
run(`startGame(); ${play} hunters = []; for (const row of gems) row.fill(0);
  const pc = cellOf(player.x, player.y); gems[pc.r][pc.c] = 1; gemsLeft = 1; update();`);
assert.equal(run('exitOpen'), true, 'exit opens');
assert.ok(run('exitCell.r === 1 || exitCell.r === ROWS - 2 || exitCell.c === 1 || exitCell.c === COLS - 2'), 'exit on the edge');
run('const ex = centreOf(exitCell); player.x = ex.x; player.y = ex.y; update();');
assert.ok(run('levelDelay > 0'));
steps(run('LEVEL_OUT'));
assert.equal(run('level'), 2);

// --- magic field: hunters cower, a catch doubles, eyes fly home ---
run(`startGame(); ${play} hunters.forEach(m => { m.state = 'out'; m.tr = PEN_DOOR.r; m.tc = PEN_DOOR.c; m.x = (m.tc + .5) * CELL; m.y = (m.tr + .5) * CELL; }); startField();`);
assert.ok(run('hunters.every(m => m.scared)'));
run('var sc = score; hunters[0].x = player.x; hunters[0].y = player.y; collideHunter(hunters[0]);');
assert.equal(run('score - sc'), 200);
assert.equal(run('hunters[0].state'), 'eyes');
run('hitPause = 0; sc = score; hunters[1].x = player.x; hunters[1].y = player.y; collideHunter(hunters[1]);');
assert.equal(run('score - sc'), 400, 'chain doubles');
run('hitPause = 0; freezeTime = 0; hunters.splice(2);');
for (let f = 0; f < 900 && run('hunters.some(m => m.state !== "pen")'); f++) run('player.invuln = 1e9; magicField = 0; update();');
assert.ok(run('hunters.every(m => m.state === "pen" || m.state === "leaving" || m.state === "out")'), 'eyes return through the gate');
assert.ok(run('hunters.every(m => !inPen(Math.floor(m.y / CELL), Math.floor(m.x / CELL)) || m.state !== "eyes")'));

// --- an unscared hunter takes a life; a frozen one does not ---
run(`startGame(); ${play} var lv = lives; const h = hunters[0]; h.x = player.x; h.y = player.y; freezeTime = 10; updateHunters();`);
assert.equal(run('lives'), run('lv'), 'frozen hunters are harmless');
run('freezeTime = 0; hunters[0].frozen = false; collideHunter(hunters[0]);');
assert.equal(run('lives'), run('lv - 1'));

// --- werewolf: howl, then sprint ---
run(`loadLevel(2); ${play} hunters = [makeHunter('werewolf', 0, START_CELL.r, START_CELL.c - 4, 'out', 0)]; hunters[0].cool = 0;
  const w = hunters[0]; player.invuln = 1e9;`);
assert.ok(run('lineOfSight(w)') || run('!walkable(START_CELL.r, START_CELL.c - 2)'), 'sees the Soul down the corridor');
if (run('lineOfSight(w)')) {
  run('hunterSpecials(w);'); assert.ok(run('w.alert') > 0);
  run('for (let i = 0; i < 40; i++) hunterSpecials(w);'); assert.ok(run('w.sprint') > 0, 'sprints after the tell');
  assert.equal(run('hunterSpeed(w)'), 3.4);
}

// --- witch hex puddle slows the Soul ---
run(`${play} hunters = []; const q = cellOf(player.x, player.y); puddles = [{r: q.r, c: q.c, t: 100}]; updatePlayer();`);
assert.ok(Math.abs(run('player.speed') - 1.44) < 1e-9);

// --- graveyard hands: telegraphed, then lethal on their cell only ---
run(`loadLevel(5); ${play} hunters = []; player.invuln = 0; var lv = lives; const pc2 = cellOf(player.x, player.y);
  hands = [{r: pc2.r, c: pc2.c, state: 'warn', t: 5}];`);
run('for (let i = 0; i < 4; i++) updateHazards();');
assert.equal(run('lives'), run('lv'), 'no damage during the warning');
run('for (let i = 0; i < 3; i++) updateHazards();');
assert.equal(run('lives'), run('lv - 1'), 'hand strikes');

// --- ethereal portals move the Soul and the hunters ---
run(`loadLevel(9); ${play} hunters = []; const [a, b] = maze.portals[0]; player.x = (a.c + .5) * CELL; player.y = (a.r + .5) * CELL; updateHazards();`);
assert.ok(run('cellOf(player.x, player.y).r === maze.portals[0][1].r && cellOf(player.x, player.y).c === maze.portals[0][1].c'), 'Soul teleports');
run('updateHazards();');
assert.ok(run('cellOf(player.x, player.y).r === maze.portals[0][1].r'), 'no ping-pong while standing on the exit portal');

// --- the catacombs draw their darkness ---
run(`loadLevel(13); ${play} draw();`);
assert.equal(run('REALMS[realmOf(level)].hazard'), 'dark');
assert.ok(run('maze.torches.length') > 0);

// --- bosses ---
const bosses = { 4: 'scarecrow', 8: 'gravelord', 12: 'mirror', 16: 'batqueen' };
for (const [L, type] of Object.entries(bosses)) {
  run(`startGame(); loadLevel(${L}); ${play}`);
  assert.equal(run('boss.type'), type);
  assert.equal(run('hunters.length'), 2);
  for (let f = 0; f < 1500; f++) { run('player.invuln = 1e9; lives = 3; update();'); if (f % 60 === 0) run('draw();'); }
  assert.ok(run('boss !== null'), `${type} survives idling`);
  // no field: touching it costs a life
  run(`${play} player.invuln = 0; magicField = 0; boss.invuln = 0; boss.state = 'drift'; var lv = lives; boss.x = player.x; boss.y = player.y - 8; bossCollide(boss);`);
  assert.equal(run('lives'), run('lv - 1'), `${type} hurts without the field`);
  // field: each ram costs one hp and spends the field
  run(`${play} lives = 3; player.invuln = 0; var hp = boss.hp; magicField = 200; boss.invuln = 0; boss.x = player.x; boss.y = player.y - 8; bossCollide(boss);`);
  assert.equal(run('boss.hp'), run('hp - 1'), `${type} takes a ram`);
  assert.equal(run('magicField'), 0);
  run(`boss.hp = 1; magicField = 200; boss.invuln = 0; boss.x = player.x; boss.y = player.y - 8; if (bossCollide(boss)) defeatBoss();`);
  assert.equal(run('boss'), null, `${type} can be defeated`);
  assert.equal(run('exitOpen'), true, `${type} opens the exit`);
}

// scarecrow: pumpkins burst along corridors, blocked by walls
run(`loadLevel(4); ${play} player.invuln = 0; var lv = lives; const pc3 = cellOf(player.x, player.y);
  bombs = [{r: pc3.r, c: pc3.c, fromX: 0, fromY: 0, t: 0, fall: 2, state: 'fall', blast: []}];`);
assert.ok(run('blastCells(pc3.r, pc3.c).every(q => walkable(q.r, q.c))'), 'blast stays in corridors');
run('for (let i = 0; i < 4; i++) updateBossFx(boss);');
assert.equal(run('lives'), run('lv - 1'), 'pumpkin burst');

// grave lord: the beam hits its lane only after the warning
run(`loadLevel(8); ${play} player.invuln = 0; var lv = lives; beams = [{axis: 'row', idx: cellOf(player.x, player.y).r, t: 3, state: 'warn'}];`);
run('updateBossFx(boss); updateBossFx(boss);');
assert.equal(run('lives'), run('lv'));
run('updateBossFx(boss); updateBossFx(boss);');
assert.equal(run('lives'), run('lv - 1'), 'soul beam');

// mirror wraith: the shadow is harmless at the centre line, deadly away from it
run(`loadLevel(12); ${play} player.invuln = 0; var lv = lives; boss.trail = []; player.x = MW / 2 + 12; updateMirror(boss);`);
assert.equal(run('shadowActive(boss)'), false);
run('boss.shadow = {x: player.x, y: player.y, dir: {x: 0, y: 0}}; boss.shadow.x = player.x = 5.5 * CELL; updateBossFx(boss);');
assert.equal(run('lives'), run('lv - 1'), 'shadow strikes');

// bat queen: aims, swoops, then is dazed (and harmless while dazed)
run(`loadLevel(16); ${play} player.invuln = 1e9; const bq = boss; bq.attackT = 1; bq.x = 200; bq.y = 100; player.x = 500; player.y = 300; updateBatQueen(bq);`);
assert.equal(run('bq.state'), 'aim');
run('for (let i = 0; i < 200 && bq.state !== "dazed"; i++) updateBatQueen(bq);');
assert.equal(run('bq.state'), 'dazed');
run(`${play} player.invuln = 0; magicField = 0; var lv = lives; bq.invuln = 0; bq.x = player.x; bq.y = player.y - 8; bossCollide(bq);`);
assert.equal(run('lives'), run('lv'), 'a dazed queen does not bite');

// --- the pilot clears whole boards unaided (invulnerable) — every board is completable ---
for (const L of [1, 6, 13]) {
  run(`startGame(); loadLevel(${L}); Arcade.attract = true;`);
  let f = 0;
  for (; f < 30000 && run('level') === L; f++) run('player.invuln = 1e9; lives = 3; update();');
  assert.equal(run('level'), L + 1, `pilot clears level ${L} (${f} frames)`);
}
run('Arcade.attract = false;');

// --- the run loops back to the hedge maze ---
run('loadLevel(17);');
assert.equal(run('realmOf(level) === 0 && cycleOf(level) === 1 && !boss'), true, 'cycle 2 starts in the hedge maze');
assert.ok(run('hunterSpeed(makeHunter("vampire", 0, 7, 19, "out", 0))') > 1.9);

// --- the last life plays a GAME OVER beat before the initials prompt ---
submitted = null;
run(`startGame(); ${play} hunters = []; lives = 1; hurtSoul();`);
steps(run('DYING_FRAMES'));
assert.equal(run('gameOver'), false);
assert.equal(submitted, null, 'no initials prompt on the death frame');
steps(run('ENDING_FRAMES'));
assert.equal(run('gameOver'), true);
assert.equal(submitted, run('score'));

console.log('Soul Circuit: 32 boards valid, fixed step, READY beat, turn slack, exit, field + eyes, freeze, werewolf, hexes, hands, portals, darkness, 4 bosses, pilot clears, loop, ending passed.');
