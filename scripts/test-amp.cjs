// Headless rules test for Amp Rampage (wave3/amp*.js). Pure rules — no canvas.
const assert = require('node:assert/strict');
const G = require('../public/arcade/games/wave3/amp.js');
const { World: W, Data: D } = G;

const count = (ev, type) => ev.filter(e => e.type === type).length;
function run(s, frames, input = {}, lives = 3) {
  const ev = [];
  for (let i = 0; i < frames; i++) ev.push(...G.step(s, Object.assign({ lives }, typeof input === 'function' ? input(i, s) : input)));
  return ev;
}
function play(n) { const s = G.createState(n); s.phase = 'play'; return s; }
function standG(s, g, x) { Object.assign(s.p, { g, lastG: g, x, y: W.gy(s.geo, g, x), vx: 0, vy: 0, state: 'walk', ladder: -1 }); }
const stackAt = (s, g, x) => s.stacks.find(q => q.g === g && q.x === x);
function hang(s, cable, hands) { const c = s.def.cables[cable]; Object.assign(s.p, { state: 'hang', cable, partner: -1, grip: 1, x: c.x, y: hands + W.BODY_H, vx: 0, vy: 0, g: -1, lastMove: 0 }); }

// --- stage map: four types, then the set loops harder ---
{
  assert.deepEqual([1, 2, 3, 4, 5, 8].map(n => D.stageInfo(n).def.kind), ['loadin', 'cables', 'build', 'rivets', 'loadin', 'rivets']);
  assert.equal(D.stageInfo(5).cycle, 1);
  assert.ok(G.createState(5).kickEvery < G.createState(1).kickEvery, 'a second loop kicks faster');
}

// --- the title freezes everything ---
{
  const s = G.createState(1), x = s.p.x, kickT = s.boss.kickT;
  run(s, G.INTRO - 1, { move: 1, jump: true });
  assert.equal(s.phase, 'intro'); assert.equal(s.p.x, x); assert.equal(s.boss.kickT, kickT);
  run(s, 1); assert.equal(s.phase, 'play');
}

// --- LOAD-IN: a stomp sends a pulse to the stack nearest you; it wobbles with its zone lit, then topples ---
{
  const S = G.Stages;
  const s = play(1); standG(s, 2, 180); s.boss.kickT = S.KICK_WIND + 1;
  assert.equal(count(run(s, 1), 'warning'), 1); assert.equal(s.boss.pose, 'stomp', 'he winds up where you can see it');
  assert.equal(count(run(s, S.KICK_WIND), 'kick'), 1);
  const k = s.stacks.find(q => q.state === 'armed');
  assert.ok(k, 'the stomp arms a stack'); assert.deepEqual([k.g, k.x], [2, 110], 'the stack whose zone is nearest you');
  s.boss.kickT = 1e9;
  let wobbled = 0, crashed = false;
  for (let i = 0; i < S.ORB + S.WOBBLE + 5 && !crashed; i++) {
    const e = run(s, 1);
    if (count(e, 'crash')) crashed = true;
    else { assert.equal(s.phase, 'play', 'nothing hurts before the crash'); if (k.state === 'wobble') wobbled++; }
  }
  assert.ok(crashed); assert.ok(wobbled >= S.WOBBLE - 2, `a full wobble telegraph (${wobbled} frames)`);
  assert.equal(s.phase, 'dying'); assert.equal(s.p.why, 'stack', 'standing in the lit zone at the crash is fatal');

  // just outside the zone: a close call, worth points
  const c = play(1); c.boss.kickT = 1e9; standG(c, 2, 260);
  Object.assign(stackAt(c, 2, 110), { state: 'wobble', t: 2 });
  const e2 = run(c, 3);
  assert.equal(c.phase, 'play'); assert.equal(count(e2, 'closeCall'), 1);

  // a crash over a ladder top sends a cabinet down the ladder: fatal below, shatters at the bottom
  const d = play(1); d.boss.kickT = 1e9; standG(d, 1, 200);
  Object.assign(stackAt(d, 2, 110), { state: 'wobble', t: 1 });
  assert.equal(count(run(d, 1), 'tumble'), 1); assert.equal(d.cabinets.length, 1);
  run(d, 60);
  assert.equal(d.phase, 'dying'); assert.equal(d.p.why, 'stack', 'a tumbling cabinet hits whoever is at the foot of the ladder');
  const u = play(1); u.boss.kickT = 1e9; standG(u, 1, 320);
  Object.assign(stackAt(u, 2, 110), { state: 'wobble', t: 1 });
  const e4 = run(u, 60);
  assert.equal(count(e4, 'shatter'), 1); assert.equal(u.phase, 'play'); assert.equal(u.cabinets.length, 0);

  // a hot stack sparks a fire ghost where it lands
  const h = play(1); h.boss.kickT = 1e9; standG(h, 0, 900);
  Object.assign(stackAt(h, 3, 300), { state: 'wobble', t: 1, hot: true });
  assert.equal(count(run(h, 1), 'ignite'), 1); assert.equal(h.fires.length, 1);

  // the crew stacks it back up
  const r = play(1); r.boss.kickT = 1e9; standG(r, 0, 900);
  const k6 = Object.assign(stackAt(r, 1, 420), { state: 'wobble', t: 1 });
  run(r, 1 + S.DOWN + S.REBUILD + S.RISE + 2);
  assert.equal(k6.state, 'stand');
}

// --- hammer: jump into a mic stand, smash gear, and no climbing while you hold it ---
{
  const s = play(1); s.boss.kickT = 1e9;
  standG(s, 1, 860);
  const ev = run(s, 50, i => ({ jump: i === 0 }));
  assert.equal(count(ev, 'hammer'), 1); assert.ok(s.p.hammer > 500);
  standG(s, 1, 660); s.p.face = 1;
  const k = stackAt(s, 1, 700);
  const smash = run(s, 30);
  assert.equal(count(smash, 'smash'), 1, 'the mic stand smashes a stack in front');
  assert.equal(k.state, 'gone');
  assert.ok(smash.some(e => e.type === 'score' && e.n === 300));
  assert.equal(s.phase, 'play');
  standG(s, 1, 780);
  run(s, 5, { down: true });
  assert.equal(s.p.state, 'walk', 'no ladders while holding the hammer');
}

// --- walking off a truss end is a fall; the bonus clock kills ---
{
  const f = play(1); f.boss.kickT = 1e9; standG(f, 1, 868);
  run(f, 60, { move: 1 });
  assert.equal(f.phase, 'dying'); assert.equal(f.p.why, 'fall');

  const t = play(1); t.boss.kickT = 1e9; t.bonus = 100; t.bonusT = 1;
  run(t, 1);
  assert.equal(t.phase, 'dying'); assert.equal(t.p.why, 'time');
}

// --- CABLES: one hand climbs slowly and slides fast; two hands the reverse ---
{
  const s = play(2); s.boss.jackT = 1e9; s.bats = [];
  hang(s, 0, 400);
  let y = s.p.y; run(s, 20, { up: true }); const up1 = y - s.p.y;
  y = s.p.y; run(s, 20, { down: true }); const down1 = s.p.y - y;
  G.step(s, { move: 1, lives: 3 });
  assert.equal(s.p.grip, 2, 'reaching toward the neighbouring cable takes it in the other hand');
  y = s.p.y; run(s, 20, { up: true }); const up2 = y - s.p.y;
  y = s.p.y; run(s, 20, { down: true }); const down2 = s.p.y - y;
  assert.ok(up2 > up1 * 2, `two cables climb faster (${up1} vs ${up2})`);
  assert.ok(down1 > down2 * 2, `one cable slides faster (${down1} vs ${down2})`);

  const lone = play(2); lone.boss.jackT = 1e9; lone.bats = [];
  hang(lone, 2, 300);
  G.step(lone, { move: 1, lives: 3 });
  assert.equal(lone.p.state, 'air', 'reaching for nothing lets go');

  const top = play(2); top.boss.jackT = 1e9; top.bats = [];
  hang(top, 5, 151);
  run(top, 3, { up: true });
  assert.equal(top.p.state, 'walk'); assert.equal(top.p.g, 4, 'climbs off the top of a cable onto the deck');

  // a touched cymbal falls and takes a snap-jack with it
  const c = play(2); c.boss.jackT = 1e9; c.bats = [];
  c.jacks.push({ cable: 2, x: 430, y: 330, speed: 0, state: 'crawl', vy: 0, dead: 0 });
  c.cymbals[0].state = 'fall'; c.cymbals[0].vy = 1;
  assert.equal(count(run(c, 40), 'crush'), 1);

  // leads: carry one at a time; each socket powers up; the third clears the stage and survives a death
  const k = play(2); k.boss.jackT = 1e9; k.bats = [];
  const L0 = k.leads[0], L1 = k.leads[1], S0 = k.sockets[0], S2 = k.sockets[2];
  Object.assign(k.p, { g: L0.p, x: L0.x, y: L0.y, state: 'walk' });
  assert.equal(count(run(k, 2), 'lead'), 1); assert.equal(k.p.lead, 0);
  Object.assign(k.p, { g: L1.p, x: L1.x, y: L1.y });
  run(k, 2);
  assert.equal(k.p.lead, 0, 'one lead at a time'); assert.ok(!L1.taken);
  Object.assign(k.p, { g: S0.p, x: S0.x, y: S0.y, state: 'walk' });
  assert.equal(count(run(k, 2), 'plug'), 1);
  assert.equal(k.p.lead, -1); assert.ok(S0.on); assert.equal(k.phase, 'play');
  const again = G.respawn(k);
  assert.ok(again.sockets[0].on && again.leads[0].taken, 'a plugged lead stays plugged after a death');
  k.sockets[1].on = true; k.leads[2].taken = true; k.p.lead = 2;
  Object.assign(k.p, { g: S2.p, x: S2.x, y: S2.y, state: 'walk' });
  run(k, 2);
  assert.equal(k.phase, 'clear', 'the third socket powers the stage');
  assert.equal(count(run(k, G.CLEAR + 2), 'next'), 1);
}

// --- BUILD: walk a part to drop it; it knocks the part below into the tray; crushes and riders ---
{
  const s = play(3); s.foes = [];
  const drum = s.parts.find(q => q.j === 0 && q.kind === 'drum'), cab = s.parts.find(q => q.j === 0 && q.kind === 'cab');
  standG(s, 1, 96);
  const walk = run(s, 60, { move: 1 });
  assert.equal(count(walk, 'drop'), 1, 'walking the whole part drops it');
  run(s, 120);
  assert.equal(drum.g, 0); assert.equal(drum.state, 'rest');
  assert.equal(cab.state, 'tray', 'the part it landed on was knocked into the tray');
  assert.equal(s.trayCount[0], 1);

  const c = play(3), cd = c.parts.find(q => q.j === 0 && q.kind === 'drum');
  c.foes = [G.Stages.makeFoe(c, 'frank', 150, 0), G.Stages.makeFoe(c, 'ghost', 150, 1)];
  c.foes.forEach(f => { f.stun = 9999; });
  G.Stages.startDrop(c, cd, []);
  assert.equal(c.foes[1].state, 'ride', 'a monster on a dropping part rides it down');
  standG(c, 3, 880);
  const ev = run(c, 120);
  assert.equal(count(ev, 'crush'), 1, 'a falling part crushes the monster under it');
  assert.equal(count(ev, 'riders'), 1, 'and the rider goes down with it');

  // Feedback stuns what is in front; the ends of a deck are walls
  const f = play(3); f.foes = [G.Stages.makeFoe(f, 'witch', 560, 0)];
  standG(f, 0, 500); f.p.face = 1;
  const charges = f.charges;
  run(f, 1, { action: true });
  assert.ok(f.foes[0].stun > 0); assert.equal(f.charges, charges - 1);
  const e = play(3); e.foes = []; standG(e, 2, 900);
  run(e, 40, { move: 1 });
  assert.equal(e.p.state, 'walk'); assert.equal(e.phase, 'play');

  // progress survives a death
  s.p.state = 'walk'; const r = G.respawn(s);
  assert.equal(r.trayCount[0], 1);
  assert.equal(r.parts.find(q => q.j === 0 && q.kind === 'drum').g, 0);
}

// --- RIVETS: a pulled bolt leaves a gap once you step clear; the last one brings the rig down ---
{
  const s = play(4); s.fires = [];
  standG(s, 1, 125);
  run(s, 30, { move: -1 });
  assert.ok(s.rivets[0].pulled); assert.ok(s.holes.some(h => h.g === 1 && h.x === 100), 'gap opens behind you');
  assert.equal(s.phase, 'play', 'pulling a bolt does not drop you through it');
  run(s, 70, { move: 1 });
  assert.equal(s.phase, 'dying'); assert.equal(s.p.why, 'fall', 'walking into the gap is a fall');

  const k = play(4); k.fires = [];
  k.rivets.slice(0, 7).forEach(r => { r.pulled = true; k.holes.push({ g: r.g, x: r.x }); });
  standG(k, 4, 760);
  run(k, 40, { move: -1 });
  assert.equal(k.phase, 'collapse', 'the eighth bolt collapses the rig');
  const ev = run(k, G.COLLAPSE + 2);
  assert.equal(count(ev, 'bossFall'), 1);
  assert.equal(k.phase, 'clear');
  assert.equal(count(run(k, G.CLEAR + 2), 'next'), 1);

  const d = play(4); d.fires = []; d.rivets[2].pulled = true; d.holes.push({ g: 2, x: 140 });
  const r = G.respawn(d);
  assert.ok(r.rivets[2].pulled); assert.equal(r.holes.length, 1, 'pulled bolts stay pulled after a death');
}

// --- GAME OVER beat: no prompt on the death frame ---
{
  const s = play(1); G.die(s, [], 'barrel');
  assert.equal(count(run(s, G.DYING, {}, 1), 'gameover'), 0);
  assert.equal(s.phase, 'ending');
  assert.equal(count(run(s, G.ENDING + 30, {}, 1), 'gameover'), 1);
  const l = play(1); G.die(l, [], 'barrel');
  assert.equal(count(run(l, G.DYING + 20, {}, 3), 'lose'), 1);
}

// --- soak: the autopilot clears two full loops (respawning), positions stay finite ---
for (let n = 1; n <= 8; n++) {
  let s = G.createState(n), deaths = 0, cleared = false, f = 0;
  const t0 = Date.now();
  for (; f < 25000 && !cleared; f++) {
    const ev = G.step(s, G.autopilot(s));
    if (f % 60 === 0) assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y), `stage ${n} positions stay finite`);
    if (ev.some(e => e.type === 'lose')) { deaths++; s = G.respawn(s); }
    if (ev.some(e => e.type === 'next')) cleared = true;
  }
  assert.ok(cleared, `autopilot clears stage ${n} (${s.kind}, deaths ${deaths})`);
  console.log(`  stage ${n} ${s.kind} cleared in ${f} frames, ${deaths} deaths, ${Date.now() - t0} ms`);
}

console.log('Amp Rampage: stage map, title freeze, stomp → pulse → wobble → topple, close calls, tumbling cabinets, hot stacks, rebuilds, hammer, falls, bonus clock, cable grips, cymbals, leads + sockets, build cascade + crush + riders + feedback, rivet gaps + collapse, respawn progress, GAME OVER beat and the soak passed.');
