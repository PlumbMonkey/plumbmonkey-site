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
// play(n) quiets the round-3 hazards (thrown gear, the roaming fire ghost, scream, roadies) so older
// tests see one rule at a time; live(n) leaves everything on.
function live(n) { const s = G.createState(n); s.phase = 'play'; return s; }
function play(n) {
  const s = live(n);
  if (s.kind === 'loadin') { s.boss.throwT = 1e9; s.fires = []; }
  if (s.kind === 'rivets') { s.screamT = 1e9; s.roadieT = 1e9; }
  return s;
}
const climbAt = (s, i, y) => { const L = s.geo.ladders[i]; Object.assign(s.p, { state: 'climb', ladder: i, x: L.x, y, g: L.stops[0].g, lastG: L.stops[0].g, vx: 0, vy: 0 }); };
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


// --- round 3: stage 1 tuning ---
{
  const S = G.Stages, s = G.createState(1);
  assert.equal(s.kickEvery, 130, 'he stomps every 130 frames on the first loop');
  assert.equal(S.WOBBLE, 45);
  const clock = (s.bonus / 100) * s.bonusTick / 60;
  assert.ok(clock >= 65 && clock <= 75, `Load-in bonus clock is about 70 s (${clock.toFixed(1)})`);
  assert.equal(s.fires.length, 1, 'a fire ghost roams from the start');
  assert.deepEqual(s.arsenal, ['cymbal']);
  assert.deepEqual(G.createState(5).arsenal, ['cymbal', 'sticks'], 'loop 2 adds drumsticks');
  assert.deepEqual(G.createState(9).arsenal, ['cymbal', 'sticks', 'mic'], 'loop 3 adds the mic whip');

  // from truss 3 up one stomp arms two stacks; below that, one
  const two = play(1); standG(two, 3, 420); two.boss.kickT = 1;
  assert.equal(count(run(two, 1), 'kick'), 2); assert.equal(two.stacks.filter(k => k.state === 'armed').length, 2);
  const one = play(1); standG(one, 2, 420); one.boss.kickT = 1;
  assert.equal(count(run(one, 1), 'kick'), 1);
}

// --- round 3: the fling is telegraphed from his hands ---
function fling(n, weapon, g, x) {
  const s = play(n); s.boss.kickT = 1e9; s.arsenal = [weapon]; s.boss.throwT = 0;
  standG(s, g, x);
  const wind = run(s, 1);
  assert.equal(count(wind, 'windUp'), 1, `${weapon}: he winds up first`); assert.equal(s.boss.pose, 'fling'); assert.equal(s.boss.weapon, weapon);
  return s;
}
{
  const S = G.Stages;
  // CYMBALS: nothing leaves his hand during the wind-up; it lands at his end of your truss and skims at shin height
  const s = fling(1, 'cymbal', 1, 500);
  assert.equal(s.throws.length, 0);
  assert.equal(count(run(s, S.FLING_WIND), 'fling'), 1); assert.equal(s.throws.length, 1);
  const cy = s.throws[0];
  run(s, S.CYMBAL_FLY);
  assert.equal(cy.state, 'skim'); assert.equal(cy.g, 1); assert.ok(cy.x < 60, 'it lands at the far end from you');
  const deck = W.gy(s.geo, 1, cy.x);
  assert.ok(deck - cy.y > 4 && deck - cy.y < 14, 'shin height');
  run(s, 200);
  assert.equal(s.phase, 'dying'); assert.equal(s.p.why, 'cymbal', 'standing still, it takes your legs');

  // jump it as it comes
  const j = fling(1, 'cymbal', 1, 500);
  let jumped = 0, passed = false;
  for (let i = 0; i < 400 && !passed; i++) {
    const o = j.throws[0];
    const go = o && o.state === 'skim' && j.p.state === 'walk' && Math.abs(o.x - j.p.x) < 34 && (o.x - j.p.x) * o.dir < 0;
    if (go) jumped++;
    run(j, 1, { jump: go });
    if (o && o.bounced && o.dir < 0 && o.x < j.p.x - 30) passed = true;
  }
  assert.equal(j.phase, 'play', 'jumping clears a cymbal'); assert.equal(jumped, 2, 'once each way'); assert.ok(passed, 'it bounced once off the far end and came back');

  // bounces once, then spins off the end it came from
  const b = fling(1, 'cymbal', 0, 900); b.p.state = 'dead'; b.phase = 'play';
  const be = run(b, 700);
  assert.equal(count(be, 'clang'), 1); assert.equal(b.throws.length, 0, 'gone after the return pass');

  // the mic-stand hammer smashes one for points
  const h = fling(1, 'cymbal', 1, 400); h.p.hammer = 600; h.p.face = -1;
  const he = run(h, 200);
  assert.ok(he.some(e => e.type === 'smash' && e.what === 'cymbal')); assert.ok(he.some(e => e.type === 'score' && e.n === 300));
  assert.equal(h.phase, 'play');
}
{
  const S = G.Stages;
  // DRUMSTICKS (loop 2): three, staggered, landing either side of you and on you
  const s = fling(5, 'sticks', 1, 500);
  run(s, S.FLING_WIND);
  const st = s.throws.filter(o => o.type === 'stick');
  assert.equal(st.length, 3); assert.deepEqual(st.map(o => o.tx), [500 - S.STICK_SPREAD, 500, 500 + S.STICK_SPREAD]);
  assert.deepEqual(st.map(o => o.t - st[0].t), [0, -S.STICK_GAP, -2 * S.STICK_GAP], 'lobbed one after another');
  run(s, S.STICK_FLY + 20);
  assert.equal(s.phase, 'dying'); assert.equal(s.p.why, 'stick');

  // stand between two landing spots and they miss
  const m = fling(5, 'sticks', 1, 500);
  run(m, S.FLING_WIND);
  standG(m, 1, 500 + S.STICK_SPREAD / 2);
  const me = run(m, S.STICK_FLY + 30);
  assert.equal(count(me, 'thud'), 3); assert.equal(m.phase, 'play', 'the gap between landing spots is safe');

  // the hammer smashes them for points
  const h = fling(5, 'sticks', 1, 500); h.p.hammer = 600;
  const he = run(h, S.FLING_WIND + S.STICK_FLY + 30);
  assert.ok(he.some(e => e.type === 'smash' && e.what === 'stick')); assert.equal(h.phase, 'play');
  assert.ok(he.filter(e => e.type === 'score' && e.n === 200).length >= 1);
}
{
  const S = G.Stages;
  // MIC WHIP (loop 3): aimed where you stood; the arc is telegraphed for the whole wind-up
  const setBoss = s => { s.boss.x = 150; s.boss.y = W.gy(s.geo, 5, 150); };
  const s = play(9); s.boss.kickT = 1e9; s.arsenal = ['mic']; setBoss(s); standG(s, 4, 330); s.boss.throwT = 0;
  run(s, 1);
  assert.equal(s.boss.weapon, 'mic'); assert.ok(s.whip, 'the whip is wound up');
  const R = Math.hypot(330 - s.whip.cx, s.p.y - 24 - s.whip.cy);
  assert.ok(Math.abs(s.whip.R - R) < 0.01, 'the arc passes through where you stood');
  run(s, S.MIC_WIND - 2);
  assert.equal(s.phase, 'play', 'nothing hurts during the wind-up');
  run(s, S.MIC_SWEEP + 4);
  assert.equal(s.phase, 'dying'); assert.equal(s.p.why, 'mic');

  // walk out of the drawn arc and it misses
  const d = play(9); d.boss.kickT = 1e9; d.arsenal = ['mic']; setBoss(d); standG(d, 4, 330); d.boss.throwT = 0;
  run(d, 1); run(d, 40, { move: 1 });
  const de = run(d, S.MIC_LEN);
  assert.equal(count(de, 'whip'), 1); assert.equal(d.phase, 'play', 'stepping out of the arc dodges it');

  // he only whips the top trusses; lower down he throws something else
  const low = play(9); low.boss.kickT = 1e9; setBoss(low); standG(low, 2, 330);
  for (let i = 0; i < 6; i++) { low.boss.throwT = 0; low.boss.pose = 'idle'; low.throws = []; run(low, 1); assert.notEqual(low.boss.weapon, 'mic'); }
}

// --- round 3, RIVETS: the feedback scream knocks a climber off its ladder ---
{
  const S = G.Stages;
  const li = G.createState(4).geo.ladders.findIndex(L => L.x === 260 && L.gBot === 2);
  const s = play(4); s.fires = []; s.screamT = 1;
  climbAt(s, li, s.geo.ladders[li].yBot - 90);
  const e = run(s, 1);
  assert.equal(count(e, 'scream'), 1); assert.equal(s.scream.ladder, li, 'he screams down the ladder you are on');
  run(s, S.SCREAM_CHARGE - 1);
  assert.equal(s.p.state, 'climb', 'the charge at the top is the warning');
  const k = run(s, 60);
  assert.equal(count(k, 'knock'), 1); assert.equal(s.phase, 'dying'); assert.equal(s.p.why, 'fall', 'knocked off high up is a fatal fall');

  const low = play(4); low.fires = []; low.screamT = 1;
  climbAt(low, li, low.geo.ladders[li].yBot - 30);
  run(low, S.SCREAM_CHARGE + 80);
  assert.equal(low.phase, 'play'); assert.equal(low.p.state, 'walk'); assert.equal(low.p.g, 2, 'knocked off near the bottom you land on the truss');

  const walk = play(4); walk.fires = []; walk.screamT = 1; standG(walk, 2, 400);
  run(walk, S.SCREAM_CHARGE + 80);
  assert.equal(walk.phase, 'play', 'it only hits climbers');
}

// --- round 3, RIVETS: roadies walk a truss, turn at gaps, die to the hammer and to a pulled bolt ---
{
  const S = G.Stages;
  const s = play(4); s.fires = []; standG(s, 0, 900);
  s.rng = 1; S.spawnRoadie(s, [], { rnd: () => 0.1, score: () => {} });
  assert.equal(s.roadies.length, 1); assert.equal(s.boss.pose, 'command', 'he points the roadie in');
  const r = s.roadies[0], x0 = r.x;
  run(s, S.ROADIE_ARRIVE);
  assert.equal(r.x, x0, 'he arrives before he walks');
  run(s, 30); assert.notEqual(r.x, x0);

  // contact kills
  const c = play(4); c.fires = []; S.spawnRoadie(c, [], { rnd: () => 0.1 });
  const cr = c.roadies[0]; cr.arrive = 0; standG(c, cr.g, cr.x + cr.dir * 30);
  run(c, 30);
  assert.equal(c.phase, 'dying'); assert.equal(c.p.why, 'monster');

  // turns at an open gap instead of walking into it
  const t = play(4); t.fires = []; standG(t, 0, 900); S.spawnRoadie(t, [], { rnd: () => 0.1 });
  const tr = t.roadies[0]; tr.arrive = 0; t.holes.push({ g: tr.g, x: tr.x + tr.dir * 60 });
  const d0 = tr.dir; run(t, 40);
  assert.equal(tr.dir, -d0, 'he turns back at the gap');

  // a bolt pulled under his boots drops him
  const f = play(4); f.fires = []; standG(f, 0, 900); S.spawnRoadie(f, [], { rnd: () => 0.1 });
  const fr = f.roadies[0]; fr.arrive = 0; f.holes.push({ g: fr.g, x: fr.x });
  const fe = run(f, 1);
  assert.equal(count(fe, 'roadieFall'), 1); assert.equal(f.roadies.length, 0);

  // the hammer smashes him for 500
  const h = play(4); h.fires = []; S.spawnRoadie(h, [], { rnd: () => 0.1 });
  const hr = h.roadies[0]; hr.arrive = 0; standG(h, hr.g, hr.x + hr.dir * 50); h.p.hammer = 600; h.p.face = -hr.dir;
  const he = run(h, 30);
  assert.ok(he.some(e => e.type === 'smash' && e.what === 'roadie')); assert.equal(h.phase, 'play');
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

// --- soak: the autopilot clears two full loops plus loop 3's Load-in (the mic whip), respawning; positions stay finite ---
for (let n = 1; n <= 9; n++) {
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

console.log('Amp Rampage: round 3 tuning, cymbals, drumsticks, mic whip, scream, roadies, stage map, title freeze, stomp → pulse → wobble → topple, close calls, tumbling cabinets, hot stacks, rebuilds, hammer, falls, bonus clock, cable grips, cymbals, leads + sockets, build cascade + crush + riders + feedback, rivet gaps + collapse, respawn progress, GAME OVER beat and the soak passed.');
