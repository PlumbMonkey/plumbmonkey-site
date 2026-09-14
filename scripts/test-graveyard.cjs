// Headless rules test for Graveyard Shift (wave3/graveyard*.js). Pure rules — no canvas.
const assert = require('node:assert/strict');
const G = require('../public/arcade/games/wave3/graveyard.js');
const { World: WD, Foes: F, TILE } = G;

const count = (ev, type) => ev.filter(e => e.type === type).length;
function run(s, frames, input = {}, lives = 3) {
  const ev = [];
  for (let i = 0; i < frames; i++) ev.push(...G.step(s, Object.assign({ lives }, typeof input === 'function' ? input(i, s) : input)));
  return ev;
}
function play(n, carry) { const s = G.createState(n, carry); s.phase = 'play'; return s; }
// the level with nothing hostile in it, so a test only sees what it stages
function quiet(n = 1, carry) { const s = play(n, carry); s.foes = []; s.movers = []; s.bars = []; s.bolts = []; return s; }
function stand(s, col, feetRow, room = 'main') { Object.assign(s.p, { room, x: col * TILE + 10, y: (feetRow + 1) * TILE - s.p.h, vx: 0, vy: 0, on: true, inv: 0 }); }
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const ghostAt = (room, x, y) => room.ghost[y * room.w + x];

// --- levels: two worlds of three, the Music Room last, every link paired ---
{
  const L = G.levels();
  assert.equal(L.length, 6);
  assert.deepEqual(L.map(l => l.id), ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
  assert.equal(L.at(-1).name, 'THE MUSIC ROOM');
  assert.equal(L.at(-1).boss.type, 'plumbmonkey');
  assert.equal(L[2].boss.type, 'gatekeeper');
  for (const l of L) {
    const w = WD.createWorld(l);
    assert.ok(w.start, `${l.id} has a start`);
    if (l.boss) assert.ok(w.boss, `${l.id} has a boss spawn`);
    for (const n in w.links) {
      assert.equal(w.links[n].length, 2, `${l.id} link ${n} has two ends`);
      assert.notEqual(w.links[n][0].room, w.links[n][1].room, `${l.id} link ${n} joins two rooms`);
    }
  }
}

// --- the title freezes everything ---
{
  const s = G.createState(1);
  const foes = JSON.stringify(s.foes.map(f => [f.x, f.y])), x = s.p.x;
  run(s, G.INTRO - 1, { move: 1, jump: true, jumpHeld: true });
  assert.equal(s.phase, 'intro');
  assert.equal(JSON.stringify(s.foes.map(f => [f.x, f.y])), foes);
  assert.equal(s.p.x, x);
  run(s, 1);
  assert.equal(s.phase, 'play');
}

// --- jumping: held jumps go higher than taps; coyote time; buffered landing jumps ---
{
  const measure = held => {
    const s = quiet(1); stand(s, 3, 12);
    const y0 = s.p.y; let top = y0;
    for (let i = 0; i < 70; i++) { G.step(s, { jump: i === 0, jumpHeld: held && i < 40, lives: 3 }); top = Math.min(top, s.p.y); }
    return y0 - top;
  };
  const full = measure(true), tap = measure(false);
  assert.ok(full > 3 * TILE && full < 4.3 * TILE, `full jump rises 3-4.3 tiles (got ${full.toFixed(0)}px)`);
  assert.ok(tap < 2.5 * TILE && tap > TILE, `a tapped jump is short (got ${tap.toFixed(0)}px)`);

  // walk off the 1-1 gap edge, then jump three frames late
  const s = quiet(1); stand(s, 51, 12);
  let f = 0; while (s.p.on && f++ < 120) G.step(s, { move: 1, lives: 3 });
  assert.ok(!s.p.on, 'walked off the edge');
  run(s, 3, { move: 1 });
  G.step(s, { move: 1, jump: true, jumpHeld: true, lives: 3 });
  assert.ok(s.p.vy < -10, 'coyote time allows a late jump');

  const b = quiet(1); stand(b, 3, 12); b.p.y -= 14; b.p.vy = 5; b.p.on = false;
  const ev = run(b, 8, i => ({ jump: i === 0, jumpHeld: true }));
  assert.equal(count(ev, 'jump'), 1, 'a jump pressed just before landing still happens');
}

// --- ghost blocks: head-bump and notes blast them to vapour; they re-form without crushing ---
{
  const s = quiet(1), room = s.world.rooms.main;
  stand(s, 15, 12);
  const ev = run(s, 30, i => ({ jump: i === 0, jumpHeld: true }));
  assert.equal(count(ev, 'vapour'), 1, 'head-bump vaporises the ghost block above');
  assert.ok(ghostAt(room, 15, 8), 'block is vapour');
  assert.equal(WD.solidity(s, room, 15, 8), 0, 'vapour is passable');
  run(s, WD.REFORM + 5);
  assert.equal(ghostAt(room, 15, 8), undefined, 're-forms after about six seconds');
  assert.equal(WD.solidity(s, room, 15, 8), 1);

  // re-forming inside the player pushes him out instead of killing him
  const c = quiet(1), cr = c.world.rooms.main;
  cr.ghost[8 * cr.w + 15] = { st: 'flicker', t: 1 };
  Object.assign(c.p, { x: 15 * TILE + 10, y: 8 * TILE - 10, vx: 0, vy: 0, on: false, inv: 0 });
  G.step(c, { lives: 3 });
  assert.equal(c.phase, 'play', 'no crush death');
  assert.ok(!overlaps(c.p, { x: 15 * TILE, y: 8 * TILE, w: TILE, h: TILE }), 'player pushed clear of the block');

  // a guitar note blasts exactly one block of the 1-1 ghost wall (cols 78-79)
  const n = quiet(1, { tier: 3 }), nr = n.world.rooms.main;
  stand(n, 74, 12); n.p.face = 1;
  const nev = run(n, 40, i => ({ fire: i === 0 }));
  assert.equal(count(nev, 'vapour'), 1, 'one note, one block');
  assert.ok(ghostAt(nr, 78, 12));
  // without the guitar, SONIC is a short whistle: too short from four tiles, enough from two
  const w = quiet(1); stand(w, 74, 12); w.p.face = 1;
  assert.equal(count(run(w, 40, i => ({ fire: i === 0 })), 'vapour'), 0);
  stand(w, 76, 12); w.p.cd = 0;
  assert.equal(count(run(w, 40, i => ({ fire: i === 0 })), 'vapour'), 1);
}

// --- crumbling floors fall after being stood on and come back ---
{
  const s = quiet(2), room = s.world.rooms.main;
  stand(s, 40, 12);                               // on the 1-2 crumble bridge
  run(s, WD.CRUMBLE_SHAKE + 2);
  assert.ok(room.crumble[13 * room.w + 40] && room.crumble[13 * room.w + 40].gone, 'crumbled');
  const again = quiet(2), ar = again.world.rooms.main;
  ar.crumble[13 * ar.w + 40] = { gone: true, t: 2 };
  run(again, 3);
  assert.equal(ar.crumble[13 * ar.w + 40], undefined, 'restored');
}

// --- power tiers: Amp from a music box, a hit drops a tier, a hit when small is fatal ---
{
  const s = quiet(1); stand(s, 10, 12);
  const ev = run(s, 20, i => ({ jump: i === 0, jumpHeld: true }));
  assert.equal(count(ev, 'sprout'), 1);
  assert.equal(s.world.rooms.main.grid[8 * s.world.rooms.main.w + 10], 'u', 'box is spent');
  run(s, 60);
  const amp = s.items.find(i => i.kind === 'amp');
  assert.ok(amp, 'small Spaceman gets the Amp');
  Object.assign(s.p, { x: amp.x, y: amp.y + amp.h - s.p.h, vy: 0 });
  assert.equal(count(run(s, 2), 'power'), 1);
  assert.equal(s.p.tier, 2);
  const hurtEv = []; G.hurt(s, hurtEv);
  assert.equal(s.p.tier, 1); assert.ok(s.p.inv > 0);
  s.p.inv = 0; G.hurt(s, hurtEv);
  assert.equal(s.phase, 'dying');

  // refill boxes come back
  const r = quiet(6), rr = r.world.rooms.main;
  stand(r, 49, 12);
  run(r, 20, i => ({ jump: i === 0, jumpHeld: true }));
  assert.equal(rr.grid[8 * rr.w + 49], 'u');
  run(r, WD.BOX_REFILL + 2);
  assert.equal(rr.grid[8 * rr.w + 49], '*', 'refill box restocked');

  // a pit is always fatal, even with Encore
  const p = quiet(1, { tier: 3 }); p.p.encore = 999;
  Object.assign(p.p, { x: 155 * TILE, y: 12 * TILE, vx: 0, vy: 4, on: false });
  run(p, 60);
  assert.equal(p.phase, 'dying'); assert.equal(p.p.why, 'pit');
}

// --- foes: stomp, armour stun and kick, notes kill, whistles don't ---
{
  const s = quiet(1);
  const skull = F.makeFoe('s', 'main', 30, 12); skull.vx = 0; s.foes.push(skull);
  Object.assign(s.p, { x: skull.x + 4, y: skull.y - s.p.h - 4, vx: 0, vy: 6, on: false, inv: 0 });
  const ev = run(s, 3);
  assert.equal(count(ev, 'kill'), 1, 'stomp kills a skull crawler');
  assert.ok(s.p.vy < 0, 'and bounces');

  const k = quiet(1);
  const frank = F.makeFoe('k', 'main', 20, 12); frank.vx = 0; k.foes.push(frank);
  Object.assign(k.p, { x: frank.x + 3, y: frank.y - k.p.h - 4, vx: 0, vy: 6, on: false, inv: 0 });
  run(k, 3);
  assert.equal(frank.st, 'stun');
  k.p.x = frank.x - 240; k.p.vy = 0;             // step clear so the bounce landing doesn't kick it
  const victim = F.makeFoe('s', 'main', 26, 12); victim.vx = 0; k.foes.push(victim);
  run(k, 30);
  Object.assign(k.p, { x: frank.x - k.p.w + 2, y: frank.y + frank.h - k.p.h, vx: 1, vy: 0, on: true, inv: 0 });
  run(k, 2, { move: 1 });
  assert.equal(frank.st, 'slide'); assert.ok(frank.vx > 0, 'kicked away from the player');
  run(k, 60);
  assert.ok(victim.dead > 0 || victim.gone, 'a sliding shell takes out other foes');

  const n = quiet(1, { tier: 3 });
  const target = F.makeFoe('s', 'main', 12, 12); target.vx = 0; n.foes.push(target);
  stand(n, 8, 12); n.p.face = 1;
  assert.equal(count(run(n, 30, i => ({ fire: i === 0 })), 'kill'), 1, 'a note kills');
  const wh = quiet(1);
  const t2 = F.makeFoe('s', 'main', 10, 12); t2.vx = 0; wh.foes.push(t2);
  stand(wh, 8, 12); wh.p.face = 1; wh.p.inv = 999;
  assert.equal(count(run(wh, 20, i => ({ fire: i === 0 })), 'kill'), 0, 'a whistle does not');
}

// --- links: graves warp, one-way exits refuse, portals swap layers; echo blocks follow the gallery ---
{
  const s = quiet(1); stand(s, 100, 12);          // on grave 1
  run(s, 60, i => ({ down: i === 0 }));
  assert.equal(s.p.room, 'crypt');
  const back = quiet(1); stand(back, 122, 12);    // on the crypt's one-way exit
  const ev = run(back, 30, i => ({ down: i === 0 }));
  assert.equal(count(ev, 'warp'), 0, 'a one-way exit cannot be entered backwards');

  const g = quiet(5); stand(g, 24, 12);
  run(g, 50, i => ({ down: i === 0 }));
  assert.equal(g.p.room, 'other', 'painting swaps to the Other Side');
  assert.equal(g.p.state, 'play');
  const other = g.world.rooms.other, main = g.world.rooms.main;
  assert.equal(WD.solidity(g, other, 66, 12), 0, 'echo block is open while the gallery block is formed');
  main.ghost[12 * main.w + 66] = { st: 'vapour', t: 100 };
  assert.equal(WD.solidity(g, other, 66, 12), 1, 'and solid while it is vapour');
  assert.equal(WD.solidity(g, other, 40, 13), 1, 'spirit stone is solid');
  assert.equal(WD.strike(g, other, 40, 13, [], 'note'), 'solid', 'and cannot be blasted');
}

// --- checkpoints: the lantern saves the respawn point ---
{
  const s = quiet(1); stand(s, 93, 12);
  assert.equal(count(run(s, 2), 'checkpoint'), 1);
  const r = G.respawn(s);
  assert.equal(Math.floor((r.p.x + 14) / TILE), 93);
  assert.equal(r.p.tier, 1);
}

// --- the Gatekeeper: telegraphed leap, shots clang off the crouch, the door opens when he falls ---
{
  const s = quiet(3), b = s.boss;
  stand(s, Math.floor(b.arena.left / TILE) + 5, 12);
  run(s, 2);
  assert.equal(b.st, 'wake'); assert.ok(s.arena, 'arena locks');
  const note = () => s.shots.push({ room: 'main', x: b.x - 12, y: b.y + 60, w: 20, h: 16, vx: 9, life: 5, whistle: false, age: 0 });
  b.st = 'walk'; b.t = 200; note(); run(s, 1);
  assert.equal(b.hp, 11);
  b.st = 'crouch'; b.t = 200; note();
  assert.equal(count(run(s, 1), 'clang'), 1); assert.equal(b.hp, 11);
  b.st = 'leap'; b.vy = 1; s.p.inv = 999;
  const land = run(s, 120);
  assert.ok(count(land, 'slam') >= 1, 'landing sends shockwaves');
  b.st = 'walk'; b.t = 200; b.hp = 1; note();
  assert.equal(count(run(s, 1), 'bossDown'), 1);
  run(s, 100);
  assert.equal(b.st, 'gone'); assert.equal(s.arena, null);
  stand(s, 178, 12); s.p.inv = 0;
  run(s, 2);
  assert.equal(s.phase, 'clear');
  assert.equal(count(run(s, G.CLEAR + 2), 'next'), 1);
}

// --- Plumbmonkey and the guitar finale ---
function toDizzy(s) {
  const b = s.boss;
  b.st = 'taunt'; b.t = 200; b.hp = 1;
  s.shots.push({ room: 'main', x: b.x - 12, y: b.y + 50, w: 20, h: 16, vx: 9, life: 5, whistle: false, age: 0 });
  run(s, 1);
  assert.equal(b.st, 'dizzy');
}
function jam(s, hitAll) {
  const b = s.boss, p = b.pedestal;
  Object.assign(s.p, { x: p.x + 10, y: p.y + p.h - s.p.h, vx: 0, vy: 0, on: true });
  run(s, 1);
  assert.equal(s.p.state, 'jam'); assert.ok(b.jam);
  for (let i = 0; i < 600 && b.jam && !b.jam.result; i++) {
    const j = b.jam, next = 60 + j.done * F.JAM_GAP;
    G.step(s, { lives: 3, fire: hitAll && j.t + 1 === next });
  }
}
{
  const s = quiet(6), b = s.boss;
  stand(s, Math.floor(b.arena.left / TILE) + 8, 12);
  s.p.tier = 3; s.p.inv = 999;
  run(s, 2);
  assert.equal(b.st, 'wake');
  for (let stage = 1; stage <= 3; stage++) {
    toDizzy(s);
    assert.ok(b.pedestal, 'the legendary guitar appears');
    assert.equal(b.pedestal.y + b.pedestal.h, b.y + b.h, 'pedestal stands on the floor');
    jam(s, true);
    assert.equal(b.st, 'chord');
    run(s, 80);
    if (stage < 3) { assert.equal(b.stage, stage + 1); assert.equal(b.hp, b.maxHp); assert.equal(s.p.state, 'play'); }
  }
  assert.equal(b.st, 'defeat');
  run(s, 200);
  assert.equal(s.phase, 'victory');
  const ev = run(s, G.VICTORY + 20);
  assert.equal(count(ev, 'win'), 1, 'the Music Room ends the game');

  // missing the beats lets him recover with half a bar
  const f = quiet(6), fb = f.boss;
  stand(f, Math.floor(fb.arena.left / TILE) + 8, 12); f.p.tier = 3; f.p.inv = 999;
  run(f, 2);
  toDizzy(f);
  jam(f, false);
  assert.equal(fb.st, 'recover'); assert.equal(fb.jam, null);
  assert.equal(fb.hp, Math.ceil(fb.maxHp / 2)); assert.equal(f.p.state, 'play');
}

// --- GAME OVER beat: no prompt on the death frame ---
{
  const s = quiet(1); G.die(s, [], 'hit');
  assert.equal(count(run(s, G.DYING, {}, 1), 'gameover'), 0);
  assert.equal(s.phase, 'ending');
  const ev = run(s, G.ENDING + 30, {}, 1);
  assert.equal(count(ev, 'gameover'), 1);
  const l = quiet(1); G.die(l, [], 'hit');
  assert.equal(count(run(l, G.DYING + 30, {}, 3), 'lose'), 1, 'with lives left it is just a lost life');
}

// --- soak: the autopilot clears every level (respawning at checkpoints), positions stay finite ---
for (let n = 1; n <= 6; n++) {
  let s = G.createState(n), deaths = 0, cleared = false, f = 0;
  const t0 = Date.now();
  for (; f < 30000 && !cleared; f++) {
    const ev = G.step(s, G.autopilot(s));
    if (f % 60 === 0) assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y), `level ${n} positions stay finite`);
    if (ev.some(e => e.type === 'lose')) { deaths++; s = G.respawn(s); }
    if (ev.some(e => e.type === 'next' || e.type === 'win')) cleared = true;
  }
  assert.ok(cleared, `autopilot clears level ${G.levels()[n - 1].id} (deaths ${deaths})`);
  console.log(`  ${G.levels()[n - 1].id} cleared in ${f} frames, ${deaths} deaths, ${Date.now() - t0} ms`);
}

console.log('Graveyard Shift: levels, jumps, ghost blocks, crumbles, tiers, foes, links, checkpoints, both bosses, the guitar finale, the GAME OVER beat and the soak passed.');
