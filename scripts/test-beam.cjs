// Headless rules test for Beam Me Up: Live! (wave3/beam.js). Pure rules — no canvas.
const assert = require('node:assert/strict');
const G = require('../public/arcade/games/wave3/beam.js');
const { createState, step, stageInfo, TYPES, PY } = G;

const calm = { move: 0, fire: false, lives: 3 };
function run(s, frames, input = calm, immune = true) {
  const events = [];
  for (let i = 0; i < frames; i++) { if (immune) s.p.inv = 1e9; events.push(...step(s, input)); }
  return events;
}
const count = (events, type) => events.filter(e => e.type === type).length;
// 'test' kind: no dive scheduling and no formation breathing, so parked enemies stay put
function playing(level) { const s = createState(level); s.phase = 'play'; s.playT = 1000; s.diveT = 1e9; s.hazardT = 1e9; s.info = Object.assign({}, s.info, { kind: 'test' }); return s; }
function parked(s, type, x, y, extra = {}) {
  // 'still' is not a state the rules move; formation cases pass state:'form' at a real slot
  const e = G.makeEnemy(type, Object.assign({ state: 'still', x, y, row: 4, col: 0 }, extra));
  s.enemies.push(e); return e;
}
// fire one real shot from the ship line at column x and let it fly
function shoot(s, x, frames = 50) { s.shots.push({ x, y: PY - 22 }); return run(s, frames); }

// --- stage map: two waves, a challenge, a boss per venue; the set loops as a cycle ---
assert.deepEqual([1, 2, 3, 4].map(l => stageInfo(l).kind), ['wave', 'wave', 'challenge', 'boss']);
assert.deepEqual([4, 8, 12, 16].map(l => createState(l).boss.type), ['queen', 'colossus', 'coven', 'deep']);
assert.equal(stageInfo(17).cycle, 1);
assert.equal(stageInfo(17).venue, 0);

// --- formations: 40 per wave, venue-specific rows ---
{
  const lawn = createState(1), tower = createState(5), voidW = createState(13);
  assert.equal(lawn.enemies.length, 40);
  assert.equal(lawn.enemies.filter(e => e.type === 'abductor').length, 4);
  assert.equal(tower.enemies.filter(e => e.type === 'gargoyle').length, 8);
  assert.equal(voidW.enemies.filter(e => e.type === 'drone').length, 4);
}

// --- the title freezes everything; then all forty fly in and settle ---
{
  const s = createState(1);
  run(s, 149);
  assert.equal(s.phase, 'intro');
  assert.ok(s.enemies.every(e => e.state === 'wait'), 'nothing moves under the title');
  run(s, 1);
  assert.equal(s.phase, 'play');
  s.diveT = 1e9;
  for (let i = 0; i < 1500; i++) { s.diveT = 1e9; s.p.inv = 1e9; step(s, calm); }
  assert.ok(s.enemies.every(e => e.state === 'form'), 'every enemy reached its slot');
  assert.ok(s.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)));
}

// --- two shots per ship in flight; a double ship fires pairs ---
{
  const s = playing(1); s.enemies = [];
  run(s, 40, { move: 0, fire: true, lives: 3 });
  assert.ok(s.shots.length <= 2);
  const d = playing(1); d.enemies = []; d.p.ally = 1;
  const ev = run(d, 1, { move: 0, fire: true, lives: 3 });
  assert.equal(d.shots.length, 2); assert.equal(count(ev, 'shoot'), 1);
}

// --- one shot kills exactly one enemy ---
{
  const s = playing(1); s.enemies = [];
  parked(s, 'bat', 300, 300); parked(s, 'bat', 300, 300);
  shoot(s, 300);
  assert.equal(s.enemies.length, 1);
}

// --- abductors take two hits; a diving abductor with escorts is worth more ---
{
  const s = playing(1); s.enemies = [];
  const a = parked(s, 'abductor', 300, 300);
  shoot(s, 300);
  assert.equal(a.hp, 1); assert.equal(s.enemies.length, 1);
  a.state = 'dive'; a.dphase = 'loop'; a.dt = 0; a.side = 1; a.cx = 342; a.cy = 300; a.a0 = Math.PI; a.shotsLeft = 0;
  const e1 = parked(s, 'witch', 900, 100, { state: 'dive', dphase: 'swoop', vx: 0, vy: 0, dt: 0, leader: a.id, shotsLeft: 0 });
  e1.x = 900; e1.y = 100;
  const ev = [];
  a.x = 300; a.y = 300; a.dphase = 'swoop'; a.vx = 0; a.vy = 0;
  ev.push(...G.step(Object.assign(s, { shots: [{ x: 300, y: 312 }] }), calm));
  const scored = ev.filter(e => e.type === 'score').map(e => e.n);
  assert.ok(scored.includes(800), `escort bonus scored ${scored}`);
}

// --- capture: standing in an active beam takes the hero; losing a life follows ---
{
  const s = playing(1); s.enemies = [];
  const a = parked(s, 'abductor', 480, 410, { state: 'beam', bt: 60 });
  s.p.x = 480; s.p.inv = 0;
  const ev = step(s, calm);
  assert.equal(s.phase, 'captured'); assert.equal(count(ev, 'captured'), 1);
  const ev2 = run(s, 110, calm, false);
  assert.equal(count(ev2, 'lose'), 1);
  // the abductor carries the hero home (state 'return', not a dive), so regroup can hand straight over to READY
  assert.ok(a.captive); assert.equal(a.state, 'return'); assert.ok(['regroup', 'ready'].includes(s.phase), s.phase);
}

// --- no beam dive is ever scheduled on the last life ---
{
  const s = createState(1); s.phase = 'play'; s.playT = 1000;
  s.enemies.forEach(e => { const [x, y] = G.slotPos(s, e.row, e.col); e.state = 'form'; e.x = x; e.y = y; });
  let beams = 0;
  for (let i = 0; i < 3000; i++) { s.p.inv = 1e9; step(s, { move: 0, fire: false, lives: 1 }); if (s.enemies.some(e => e.state === 'beamdown')) beams++; if (!s.enemies.length) break; }
  assert.equal(beams, 0);
}

// --- rescue: kill the captive's abductor mid-dive and the hero joins you ---
{
  const s = playing(1); s.enemies = [];
  const a = parked(s, 'abductor', 400, 300, { captive: true, hp: 1, state: 'dive', dphase: 'swoop', vx: 0, vy: 0, dt: 0, shotsLeft: 0 });
  s.shots = [{ x: 400, y: 312 }];
  const ev = run(s, 1);
  assert.equal(count(ev, 'rescue'), 1);
  const ev2 = run(s, 200);
  assert.equal(count(ev2, 'dual'), 1); assert.equal(s.p.ally, 1);
  void a;
}

// --- kill it in formation instead and the captured hero turns on you ---
{
  const s = playing(1); s.enemies = [];
  const t0 = parked(s, 'abductor', ...G.slotPos(s, 0, 4), { captive: true, hp: 1, state: 'form', row: 0, col: 4 });
  s.shots = [{ x: t0.x, y: t0.y + 12 }]; const ev = run(s, 1);
  assert.equal(count(ev, 'turncoat'), 1);
  assert.ok(s.enemies.some(e => e.type === 'turncoat'));
}

// --- the captive ship itself can be shot (the weak point above the abductor) ---
{
  const s = playing(1); s.enemies = [];
  const a = parked(s, 'abductor', 400, 200, { captive: true });
  s.shots = [{ x: 400, y: 200 - 34 + 10 }]; const ev = run(s, 1);
  assert.equal(count(ev, 'captiveLost'), 1); assert.equal(a.captive, false); assert.equal(a.hp, 2);
}

// --- a double ship loses one ship to a hit, not a life ---
{
  const s = playing(1); s.enemies = []; parked(s, 'bat', 100, 100); s.p.ally = 1; s.p.inv = 0;
  const [x0] = G.shipXs(s.p);
  s.bolts = [{ x: x0, y: PY, vx: 0, vy: 0 }];
  const ev = step(s, calm);
  assert.equal(count(ev, 'shipLost'), 1); assert.equal(s.p.ally, 0); assert.equal(s.phase, 'play');
}

// --- death → lose → regroup → ready → play ---
{
  const s = playing(1); s.enemies = []; parked(s, 'bat', 100, 100);
  s.p.inv = 0; s.bolts = [{ x: s.p.x, y: PY, vx: 0, vy: 0 }];
  step(s, calm);
  assert.equal(s.phase, 'dying');
  const ev = run(s, 80, calm, false);
  assert.equal(count(ev, 'lose'), 1);
  for (let i = 0; i < 400 && s.phase !== 'play'; i++) step(s, calm);
  assert.equal(s.phase, 'play'); assert.ok(s.p.inv > 0, 'respawn protection');
}

// --- last life: GAME OVER beat, then exactly one gameover event ---
{
  const s = playing(1); s.enemies = []; parked(s, 'bat', 100, 100);
  s.p.inv = 0; s.bolts = [{ x: s.p.x, y: PY, vx: 0, vy: 0 }];
  const last = { move: 0, fire: false, lives: 1 };
  step(s, last);
  let ev = []; for (let i = 0; i < 80; i++) ev.push(...step(s, last));
  assert.equal(count(ev, 'lose'), 0); assert.equal(s.phase, 'ending');
  ev = []; for (let i = 0; i < 300; i++) ev.push(...step(s, last));
  assert.equal(count(ev, 'gameover'), 1);
}

// --- challenge stage: nothing fires, nothing hurts; results and the perfect bonus ---
{
  const s = createState(3);
  let bolts = 0; const ev = [];
  for (let i = 0; i < 60 * 40 && s.phase !== 'done'; i++) { ev.push(...step(s, calm)); bolts += s.bolts.length; }
  assert.equal(bolts, 0); assert.equal(s.p.inv, 0, 'never needed protection');
  assert.equal(count(ev, 'die'), 0); assert.equal(count(ev, 'next'), 1); assert.equal(s.bonus, 0);
  const p = createState(3); p.phase = 'play'; p.enemies = []; p.hits = 40;
  const ev2 = step(p, calm);
  assert.equal(p.phase, 'result'); assert.equal(p.bonus, 14000); assert.equal(count(ev2, 'perfect'), 1);
}

// --- wraiths split; drones shield their neighbours in formation ---
{
  const s = playing(9); s.enemies = [];
  parked(s, 'wraith', 300, 300); s.shots = [{ x: 300, y: 312 }]; run(s, 1);
  assert.equal(s.enemies.filter(e => e.type === 'wisp').length, 2);
  const v = playing(13); v.enemies = [];
  const drone = parked(v, 'drone', ...G.slotPos(v, 3, 3), { row: 3, col: 3, state: 'form' });
  const bat = parked(v, 'bat', ...G.slotPos(v, 3, 4), { row: 3, col: 4, state: 'form' });
  const ev = shoot(v, bat.x, 45);
  assert.equal(count(ev, 'shield'), 1); assert.equal(bat.hp, 1);
  shoot(v, drone.x, 45); assert.ok(!v.enemies.includes(drone));
  shoot(v, bat.x, 45); assert.ok(!v.enemies.includes(bat));
}

// --- storm tower lightning: warned for 60 frames, then lethal in its column ---
{
  const s = playing(5); s.enemies = []; parked(s, 'bat', 100, 100);
  s.strikes = [{ x: s.p.x, t: 0 }];
  let ev = []; for (let i = 0; i < 59; i++) { s.p.inv = 0; ev.push(...step(s, calm)); }
  assert.equal(s.phase, 'play');
  for (let i = 0; i < 3; i++) { s.p.inv = 0; ev.push(...step(s, calm)); }
  assert.equal(s.phase, 'dying'); assert.equal(count(ev, 'strike'), 1);
}

// ============ bosses ============
function boss(level) { const s = createState(level); s.phase = 'play'; for (let i = 0; i < 200; i++) { s.p.inv = 1e9; step(s, calm); } return s; }

// Abductor Queen: dome shut = the core clangs; turrets break; the core opens after the beam
{
  const s = boss(4), b = s.boss;
  b.state = 'hover'; b.wait = 1e9; b.vx = 0; b.dome = 0;
  const hp0 = b.hp;
  let ev = shoot(s, b.x);
  assert.equal(b.hp, hp0); assert.ok(count(ev, 'clang') >= 1);
  for (let i = 0; i < 6; i++) shoot(s, b.x + b.turrets[0].dx, 45);
  assert.equal(b.turrets[0].hp, 0);
  b.state = 'vent'; b.bt = 0; b.dome = 1;
  ev = shoot(s, b.x, 40);
  assert.equal(b.hp, hp0 - 1, 'a real shot from the ship line reaches the open core');
}

// Gargoyle Colossus: stone while perched, hurt once awake
{
  const s = boss(8), b = s.boss;
  b.state = 'perch'; b.wait = 1e9; b.x = 480; b.y = 130;
  const hp0 = b.hp;
  shoot(s, 480); assert.equal(b.hp, hp0);
  b.state = 'wake'; b.wait = 1e9;
  shoot(s, 480); assert.equal(b.hp, hp0 - 1);
}

// The Coven: only the hex holder can be hurt; a fallen witch passes the hex on
{
  const s = boss(12), b = s.boss;
  b.spin = 0; b.hexT = 1e9;
  run(s, 1);
  const other = b.witches[(b.hex + 1) % 3], holder = b.witches[b.hex];
  const hp0 = b.hp;
  s.shots = [{ x: other.x, y: other.y + 10 }]; run(s, 1); assert.equal(b.hp, hp0);
  holder.hp = 1; const spin0 = b.spin, idx = b.hex;
  s.shots = [{ x: holder.x, y: holder.y + 10 }]; const ev = run(s, 1);
  assert.equal(count(ev, 'witchDown'), 1); assert.notEqual(b.hex, idx); assert.ok(b.r > 150);
  void spin0;
}

// The Deep One: shut eye clangs; an open eye is reachable by a real shot (the body used to swallow it)
{
  const s = boss(16), b = s.boss;
  b.state = 'idle'; b.wait = 1e9; b.eye = 0; b.spawnT = 1e9; b.lanes = [];   // idle keeps the eye shut
  const hp0 = b.hp;
  shoot(s, 480); assert.equal(b.hp, hp0);
  b.state = 'open'; b.eye = 1;
  shoot(s, 480); assert.equal(b.hp, hp0 - 1);
}

// Killing a boss clears the venue
{
  const s = boss(8), b = s.boss;
  b.state = 'wake'; b.wait = 1e9; b.hp = 1;
  const ev = shoot(s, 480);
  assert.equal(count(ev, 'bossDown'), 1);
  const ev2 = run(s, 400);
  assert.equal(s.boss, null); assert.equal(count(ev2, 'next'), 1);
}

// --- soak: the attract pilot clears all sixteen stages; nothing goes NaN ---
for (let level = 1; level <= 16; level++) {
  const s = createState(level);
  let cleared = false;
  for (let f = 0; f < 60 * 360 && !cleared; f++) {
    const a = G.autopilot(s);
    for (const e of step(s, { move: a.move, fire: a.fire, lives: 3 })) if (e.type === 'next') cleared = true;
    if (f % 60 === 0) assert.ok(Number.isFinite(s.p.x) && s.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)) && (!s.boss || Number.isFinite(s.boss.x + s.boss.y)), `finite positions (stage ${level})`);
  }
  assert.ok(cleared, `the pilot clears stage ${level}`);
}

void TYPES;
console.log('Beam Me Up: stage map, formations, entries, shot limit, single-hit, escorts, capture, last-life beam guard, rescue, turncoat, captive shot, dual hit, regroup, ending, challenge + perfect, wraith split, drone shields, lightning, 4 bosses, venue clear, 16-stage soak passed.');
