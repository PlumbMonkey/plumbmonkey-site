// Headless rules test for Spectral Manor Cruise: loads the four game scripts
// into a VM with a stub canvas, then drives the rules directly.
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
/* A seeded Math.random for the VM. Rivals pick lanes, wobble and throw fire at
   random, so the bot races below would otherwise pass or fail by luck. The
   margins were checked across many unseeded runs; the seed just keeps the
   suite reproducible. */
let seed = 20260913;
const seededMath = Object.create(Math);
seededMath.random = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sandbox = {
  console, Math: seededMath, setTimeout: noop, location: { search: '' },
  performance: { now: () => clock },
  localStorage: { getItem: () => null, setItem: noop },
  document: { body: { classList: { add: noop } }, getElementById: el, createElement: () => ({ getContext: () => ctx }) },
  addEventListener: noop,
  ArcadeVR: { schedule: noop },
  Arcade: { attract: false, submitFlow: (s, done) => { submitted = s; done(); }, boardHTML: () => '', slug: 'spectral-manor-cruise' },
  ArcadeAudio: { context: () => null, resume: noop }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const dir = 'public/arcade/games/spectral-manor-cruise/';
['tracks.js', 'cars.js', 'render.js', 'game.js'].forEach(f => vm.runInContext(fs.readFileSync(dir + f, 'utf8'), sandbox, { filename: f }));
const run = code => vm.runInContext(code, sandbox);
const steps = n => run(`for (let i = 0; i < ${n}; i++) update();`);
const go = 'countdown = 0; finishing = 0; paused = false; Arcade.attract = false; MOVE_KEYS.forEach(k => keys[k] = false);';

// --- the four tracks ---
for (let i = 0; i < 4; i++) {
  const r = JSON.parse(run(`(() => { const T = buildTrack(${i}), s = T.segments, n = s.length;
    const names = new Set(); s.forEach(q => q.sprites.forEach(p => names.add(p.name)));
    const m = T.map;
    return JSON.stringify({
      len: T.length, endY: s[n - 1].y2,
      badJumps: T.jumps.filter(j => Math.abs(s[j].curve) > 1e-9).length,
      missing: [...names].filter(nm => !SPRITE_DEFS[nm] && !['ramp', 'gantry', 'boneArch'].includes(nm)),
      badHazards: s.filter(q => q.hazards.some(h => q.jump || Math.abs(h.x) > 0.7 || Math.abs(q.curve) > 1e-9)).length,
      roadsideOnRoad: s.filter(q => q.sprites.some(p => SPRITE_DEFS[p.name] && SPRITE_DEFS[p.name].collide > 0 && Math.abs(p.offset) < 1.1)).length,
      mapGap: Math.hypot(m[0][0] - m[m.length - 1][0], m[0][1] - m[m.length - 1][1])
    }); })()`));
  assert.ok(r.len > 180000 && r.len < 260000, `track ${i} length ${r.len}`);
  assert.ok(Math.abs(r.endY) < 1, `track ${i} lap joins at height 0`);
  assert.equal(r.badJumps, 0, `track ${i} ramps sit on straights`);
  assert.deepEqual(r.missing, [], `track ${i} sprites all have art`);
  assert.equal(r.badHazards, 0, `track ${i} hazards sit in lanes on straights`);
  assert.equal(r.roadsideOnRoad, 0, `track ${i} nothing solid stands on the road`);
  assert.ok(r.mapGap < 1e-6, `track ${i} minimap closes`);
}

// --- start: the countdown freezes everyone, even with the gas held ---
run('race = 1; startRace(); keys.ArrowUp = true; var z0 = player.totalZ, r0 = opponents.map(o => o.totalZ).join();');
steps(100);
assert.equal(run('player.totalZ'), run('z0'));
assert.equal(run('opponents.map(o => o.totalZ).join()'), run('r0'), 'rivals hold the grid');
assert.equal(run('raceTime'), 0, 'the clock starts on green');
steps(81);
assert.ok(run('player.totalZ') > run('z0'), 'go on green');
[0, 1, 2, 3].forEach(i => { run(`race = ${i + 1}; startRace(); countdown = 0; player.totalZ = 40000; draw(); player.totalZ = 90000; draw(); countdown = 100; draw();`); });

// --- fixed timestep ---
run('previousFrame = 1000; accumulator = 0;'); clock = 1051; run('var t0 = tick; loop();');
assert.equal(run('tick - t0'), 3);

// --- speed cap (holding the gas used to creep 30/frame past top speed) ---
run(`race = 1; startRace(); ${go} keys.ArrowUp = true; var vmax = 0; for (let i = 0; i < 900; i++) { player.x = 0; update(); vmax = Math.max(vmax, player.speed); }`);
assert.ok(run('vmax') <= run('MAX_SPEED * 1.05') + 1, 'gas alone never passes top speed');
run(`player.nitro = 100; keys.Space = true; for (let i = 0; i < 60; i++) { player.x = 0; update(); vmax = Math.max(vmax, player.speed); }`);
assert.ok(run('player.nitroOn') || run('player.nitro') < 100, 'nitro lights');
assert.ok(run('vmax') > run('MAX_SPEED'), 'nitro goes past the cap');
assert.ok(run('vmax') <= run('MAX_SPEED * 1.22 * 1.05') + 1);
run(`${go} player.nitro = 10; player.nitroOn = false; keys.Space = true; update();`);
assert.equal(run('player.nitroOn'), false, 'nitro needs a minimum charge to light');

// --- ramps: lane-gated and speed-gated ---
const jumpZ = run('track.jumps[0] * SEG_LEN');
run(`${go} player.air = 0; player.x = 0; player.speed = MAX_SPEED; player.totalZ = ${jumpZ} - 150; sweepTrack(player.totalZ, player.totalZ + 200);`);
assert.ok(run('player.air') > 0, 'centre of the road launches');
run(`player.air = 0; player.x = 1.3; sweepTrack(${jumpZ} - 150, ${jumpZ} + 50);`);
assert.equal(run('player.air'), 0, 'the shoulder never launches');
run(`player.x = 0; player.speed = 3000; sweepTrack(${jumpZ} - 150, ${jumpZ} + 50);`);
assert.equal(run('player.air'), 0, 'crawling over a ramp does not launch');

// --- static hazards: swept at top speed (no tunnelling), cleared when airborne ---
run('race = 2; startRace();');
const log = JSON.parse(run('JSON.stringify(track.segments.find(s => s.hazards.length && s.hazards[0].type === "log").hazards.map(h => h).concat([track.segments.find(s => s.hazards.length && s.hazards[0].type === "log").i]))'));
run(`${go} player.x = ${log[0].x}; player.air = 0; player.speed = MAX_SPEED * 1.2; player.totalZ = ${log[1]} * SEG_LEN - 5; update();`);
assert.ok(run('player.speed') < run('MAX_SPEED * 0.7'), 'a log at nitro speed is not tunnelled through');
run(`${go} player.x = ${log[0].x}; player.air = 30; player.airMax = 60; player.speed = MAX_SPEED; player.totalZ = ${log[1]} * SEG_LEN - 5; update();`);
assert.ok(run('player.speed') > run('MAX_SPEED * 0.9'), 'airborne sails over it');
run('race = 4; startRace();');
const pud = JSON.parse(run('(() => { const s = track.segments.find(q => q.hazards.length); return JSON.stringify([s.hazards[0].x, s.i]); })()'));
run(`${go} player.x = ${pud[0]}; player.slide = 0; player.speed = MAX_SPEED; player.totalZ = ${pud[1]} * SEG_LEN - 5; update();`);
assert.ok(run('player.slide') > 0, 'a puddle breaks traction');

// --- orbs: nitro once per lap ---
const orb = JSON.parse(run('(() => { const s = track.segments.find(q => q.orbs.length); return JSON.stringify([s.orbs[0].x, s.i]); })()'));
run(`${go} player.nitro = 0; player.x = ${orb[0]}; sweepTrack(${orb[1]} * SEG_LEN - 10, ${orb[1]} * SEG_LEN + 10);`);
assert.equal(run('player.nitro'), 12);
run(`sweepTrack(${orb[1]} * SEG_LEN - 10, ${orb[1]} * SEG_LEN + 10);`);
assert.equal(run('player.nitro'), 12, 'not twice in one lap');

// --- roadside objects spin you out; open shoulder only slows you ---
run('race = 1; startRace();');
const solid = JSON.parse(run('(() => { for (const s of track.segments) { const p = s.sprites.find(q => SPRITE_DEFS[q.name] && SPRITE_DEFS[q.name].collide > 0.05 && Math.abs(q.offset) < 1.6); if (p) return JSON.stringify([p.offset, s.i]); } })()'));
run(`${go} player.spin = 0; player.air = 0; player.x = ${solid[0]}; player.speed = 9000; sweepTrack(${solid[1]} * SEG_LEN - 10, ${solid[1]} * SEG_LEN + 10);`);
assert.ok(run('player.spin') > 0 && run('player.speed') < 3000, 'crash into a roadside object');

// --- rivals: a bump shoves and slows, the Ghost reverses steering ---
run(`${go} player.spin = 0; player.x = 0; player.speed = 11000; const wolf = opponents.find(o => o.key === 'werewolf'); wolf.x = 0.1; wolf.lane = 0.1; wolf.boosting = false; wolf.totalZ = player.totalZ - 100; updateRivals(false);   // it moves ~155 before contact is measured`);
assert.ok(run('player.speed') < 11000 * 0.7 && run('player.bumpVx') !== 0, 'trading paint');
run(`${go} scramble = 0; const gh = opponents.find(o => o.ghost); gh.x = 0; gh.lane = 0; gh.phasing = false; gh.boosting = false; gh.totalZ = player.totalZ - 120; player.x = 0; updateRivals(false);`);
assert.equal(run('scramble'), run('SCRAMBLE_FRAMES'));
run(`player.bumpVx = 0; player.slide = 0; player.spin = 0; player.speed = 6000; player.x = 0; keys.ArrowRight = true; var sx = player.x; updatePlayer(); keys.ArrowRight = false;`);
assert.ok(run('player.x') < run('sx'), 'haunted steering goes the other way');

// --- drafting charges nitro ---
run(`${go} scramble = 0; player.nitro = 0; player.speed = 10000; player.x = 0; opponents.forEach(o => o.totalZ = -1e6); const v = opponents[0]; v.x = 0; v.totalZ = player.totalZ + SEG_LEN * 4; for (let i = 0; i < 40; i++) { v.totalZ = player.totalZ + SEG_LEN * 4; player.x = 0; updatePlayer(); }`);
assert.ok(run('player.drafting') > 20 && run('player.nitro') > 0, 'slipstream');

// --- finish: a beat BEFORE the results / initials ---
submitted = null;
run(`race = 1; cruiseScore = 0; startRace(); ${go} opponents.forEach(o => o.totalZ = 0); player.totalZ = LAPS * track.length - 30; player.lap = LAPS; player.speed = 9000; update();`);
assert.ok(run('finishing') > 0 && run('gameRunning'), 'finish beat starts');
assert.equal(run('finishPlace'), 1);
steps(run('FINISH_FRAMES'));   // the crossing frame set the beat; it runs its full length
assert.equal(run('gameRunning'), false, 'results after the beat');
assert.equal(run('race'), 2, 'a win unlocks the next track');
run(`startRace(); ${go}`);
assert.equal(run('track.theme.key'), 'woods');
run(`${go} opponents.forEach(o => o.totalZ = LAPS * track.length + 5000); player.totalZ = LAPS * track.length - 30; player.lap = LAPS; player.speed = 9000; update();`);
assert.equal(submitted, null, 'no initials prompt on the finish frame');
steps(run('FINISH_FRAMES'));
assert.ok(submitted !== null && run('race') === 1, 'a loss banks the run and resets the series');
run('race = 5; startRace();');
assert.equal(run('track.theme.key === "highway" && cycle === 1'), true, 'the series loops');

// --- bots: a clean driver wins, a sloppy one does not ---
function botRace(r, mode) {
  run(`race = ${r}; startRace(); Arcade.attract = ${mode === 'clean'}; MOVE_KEYS.forEach(k => keys[k] = false);`);
  run(`for (let f = 0; f < 20000 && gameRunning; f++) { ${mode === 'sloppy' ? "MOVE_KEYS.forEach(k => keys[k] = false); keys.ArrowUp = true; if (player.x > 0.9) keys.ArrowLeft = true; else if (player.x < -0.9) keys.ArrowRight = true;" : ''} update(); }`);
  run('Arcade.attract = false; cruiseScore = 0;');
  return run('finishPlace');
}
[1, 2, 3, 4].forEach(r => assert.equal(botRace(r, 'clean'), 1, `clean driver wins race ${r}`));
[1, 2].forEach(r => assert.ok(botRace(r, 'sloppy') > 1, `sloppy driver loses race ${r}`));

console.log('Cruise: 4 tracks valid, countdown freeze, fixed step, speed cap, nitro, ramps, swept hazards, orbs, roadside crash, bump, haunting, draft, finish beat, series loop, clean-wins/sloppy-loses passed.');
