/* Graveyard Shift — CORE RULES (no drawing; graveyard-art.js renders and wires the host).

   A Super Mario Bros.-style climb from the cemetery gate to the Music Room at
   the top of the manor. This file owns the state, the Spaceman's physics, his
   notes, power tiers, pickups, links, exits, the camera and the phase machine.
   Tiles live in graveyard-world.js, foes and bosses in graveyard-foes.js,
   level maps in graveyard-levels.js.

   Fixed 1/60 s frames. step(s, input) returns events ({type, ...}).
   input: { move, jump (press edge), jumpHeld, fire (press edge), down (press edge), lives }

   POWER TIERS (Mario rules): 1 = Spaceman, one hit and he's down. 2 = Amp,
   takes a hit. 3 = Guitar, takes a hit and fires notes. Any hit drops a tier.
   Without the Guitar, FIRE is a short whistle that still blasts ghost blocks,
   so the core mechanic is never out of reach. */
(function (root) {
  "use strict";
  const NODE = typeof module !== "undefined" && module.exports;
  const LV = NODE ? require("./graveyard-levels.js") : root.GraveyardLevels;
  const WD = NODE ? require("./graveyard-world.js") : root.GraveyardWorld;
  const F = NODE ? require("./graveyard-foes.js") : root.GraveyardFoes;
  const { TILE } = WD;

  const INTRO = 150, DYING = 110, CLEAR = 200, ENDING = 150, VICTORY = 320;
  const TIME = 300;        // seconds on each level's clock; it stands still inside a boss arena
  const LIGHT = 40;        // frames from touching the great lantern to its flare
  const PHYS = { accel: 0.42, skid: 0.9, decel: 0.5, air: 0.3, max: 5.2, jumpV: -13.6, gUp: 0.5, gDown: 1.0, maxFall: 13, coyote: 6, buffer: 6 };
  const VIEW_L = 160, VIEW_R = 1120;     // world 960 drawn into a 1280 view (PAD 160 either side)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let LEVELS = null;
  const levels = () => LEVELS || (LEVELS = LV.LEVELS);

  function rnd(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }

  function scan(world, ch) {
    const out = [];
    for (const name in world.rooms) {
      const r = world.rooms[name];
      r.grid.forEach((c, i) => { if (c === ch) out.push({ room: name, x: i % r.w, y: Math.floor(i / r.w) }); });
    }
    return out;
  }
  function groundBelow(s, room, x, y) {
    for (let yy = y; yy < room.h; yy++) if (WD.solidity(s, room, x, yy) === 1) return yy * TILE;
    return room.h * TILE;
  }

  // ============================================================ state
  function createState(n = 1, carry = {}) {
    const all = levels(), L = all[clamp(n, 1, all.length) - 1];
    const world = WD.createWorld(L);
    const s = { n, count: all.length, last: n >= all.length, level: L, world, t: 0, phase: "intro", phaseT: INTRO,
      rng: (n * 2654435761) >>> 0, notes: carry.notes || 0, shots: [], bolts: [], items: [], foes: [], movers: [], bars: [],
      boss: null, arena: null, checkpoint: carry.checkpoint || null, cam: { x: 0, y: 0, lead: 0 }, finish: null,
      timeT: (L.time || TIME) * 60, stats: { notes: carry.stats ? carry.stats.notes : 0, ghosts: carry.stats ? carry.stats.ghosts : 0 } };
    const at = s.checkpoint || world.start;
    s.p = { room: at.room, x: at.x * TILE + 10, y: (at.y + 1) * TILE - 60, w: 28, h: 60, vx: 0, vy: 0, face: 1, on: true,
      coyote: 0, buffer: 0, held: false, tier: carry.tier || 1, inv: 0, encore: 0, cd: 0, dist: 0, land: 0, shootT: 0,
      state: "play", warpT: 0, ride: null };
    // the great lantern stands on the ground below its E; the whole column above it lights it, so it can't be jumped over
    s.exitLanterns = scan(world, "E").map(e => { const r = world.rooms[e.room]; return { room: e.room, x: e.x * TILE + 24, top: e.y * TILE, bottom: groundBelow(s, r, e.x, e.y) }; });
    s.doors = scan(world, "D");
    s.lanterns = scan(world, "C");
    F.spawnFoes(s);
    s.boss = F.createBoss(s);
    if (s.checkpoint) s.foes = s.foes.filter(f => !(f.room === s.p.room && Math.abs(f.x - s.p.x) < 260));
    camera(s, true);
    return s;
  }
  const respawn = s => createState(s.n, { notes: s.notes, checkpoint: s.checkpoint, tier: 1, stats: s.stats });
  const nextState = s => createState(s.n + 1, { notes: s.notes, tier: s.p.tier });

  // ============================================================ player
  function hurt(s, ev) {
    const p = s.p;
    if (p.inv > 0 || p.encore > 0 || p.state !== "play" || s.phase !== "play") return;
    if (p.tier > 1) { p.tier--; p.inv = 110; ev.push({ type: "shrink", tier: p.tier, x: p.x, y: p.y }); }
    else die(s, ev, "hit");
  }
  function die(s, ev, why) {
    if (s.phase !== "play") return;
    const p = s.p;
    s.phase = "dying"; s.phaseT = DYING; p.state = "dead"; p.vx = 0; p.vy = why === "pit" ? 0 : -12; p.why = why;
    ev.push({ type: "die", why, x: p.x + p.w / 2, y: p.y });
  }
  function bounce(s) { s.p.vy = s.p.held ? -13 : -8.5; s.p.on = false; s.p.ride = null; }
  const C = { hurt, bounce, rnd };

  function movePlayer(s, input, ev) {
    const p = s.p, room = s.world.rooms[p.room];
    const move = p.state === "play" ? clamp(input.move || 0, -1, 1) : 0;
    if (move) {
      const skid = p.vx && Math.sign(p.vx) !== move;
      p.vx += move * (p.on ? (skid ? PHYS.skid : PHYS.accel) : PHYS.air);
      p.face = move;
    } else if (p.on) p.vx = Math.abs(p.vx) <= PHYS.decel ? 0 : p.vx - Math.sign(p.vx) * PHYS.decel;
    p.vx = clamp(p.vx, -PHYS.max, PHYS.max);

    if (p.ride) { p.x += p.ride.dx; p.y += p.ride.dy; }
    if (p.state === "play") {
      if (input.jump) p.buffer = PHYS.buffer; else if (p.buffer > 0) p.buffer--;
    } else p.buffer = 0;
    p.coyote = p.on ? PHYS.coyote : Math.max(0, p.coyote - 1);
    p.held = !!input.jumpHeld;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = PHYS.jumpV - Math.abs(p.vx) * 0.12; p.on = false; p.coyote = 0; p.buffer = 0; p.ride = null;
      ev.push({ type: "jump" });
    }

    // horizontal
    p.x += p.vx;
    if (s.arena && s.arena.room === p.room) p.x = clamp(p.x, s.arena.left, s.arena.right - p.w);
    const side = WD.boxSolid(s, room, p);
    if (side) {
      const cx = side.x * TILE + 24;
      if (p.x + p.w / 2 < cx) p.x = side.x * TILE - p.w - 0.01; else p.x = (side.x + 1) * TILE + 0.01;
      p.vx = 0;
    }

    // vertical
    const g = p.vy < 0 && p.held ? PHYS.gUp : PHYS.gDown;
    p.vy = Math.min(PHYS.maxFall, p.vy + g);
    const prevBottom = p.y + p.h, wasOn = p.on;
    p.y += p.vy;
    p.on = false; p.ride = null;
    if (p.vy >= 0) {
      const hit = WD.boxSolid(s, room, p, prevBottom);
      if (hit) { p.y = hit.y * TILE - p.h; p.vy = 0; p.on = true; }
      for (const m of s.movers) {
        if (m.room !== p.room || p.x + p.w <= m.x || p.x >= m.x + m.w) continue;
        if (prevBottom <= m.y + Math.max(0, m.dy) + 1.5 && p.y + p.h >= m.y) { p.y = m.y - p.h; p.vy = 0; p.on = true; p.ride = m; }
      }
    } else {
      const hit = WD.boxSolid(s, room, p);
      if (hit) {
        p.y = (hit.y + 1) * TILE + 0.01; p.vy = 0;
        const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w) / TILE), mid = p.x + p.w / 2;
        let best = null;
        for (let x = x0; x <= x1; x++) if (WD.solidity(s, room, x, hit.y) === 1 && (best === null || Math.abs(x * TILE + 24 - mid) < Math.abs(best * TILE + 24 - mid))) best = x;
        if (best !== null) {
          const r = WD.strike(s, room, best, hit.y, ev, "head");
          if (r === "box") spawnItem(s, ev, room, best, hit.y);
          else ev.push({ type: "bonk", x: best * TILE + 24, y: (hit.y + 1) * TILE });
        }
      }
    }
    if (p.on && !wasOn) { p.land = 8; ev.push({ type: "land" }); }
    if (p.on) p.dist += Math.abs(p.vx);

    // what the feet are on
    if (p.on && !p.ride) {
      const fy = Math.floor((p.y + p.h + 1) / TILE);
      let spikes = false;
      for (let x = Math.floor(p.x / TILE); x <= Math.floor((p.x + p.w - 0.01) / TILE); x++) {
        WD.touchCrumble(room, x, fy);
        if (WD.cell(room, x, fy) === "^") spikes = true;
      }
      if (spikes) { hurt(s, ev); if (s.phase === "play") { p.vy = -9; p.on = false; } }
    }
  }

  function spawnItem(s, ev, room, x, y) {
    const ch = ev.filter(e => e.type === "box").pop().kind;
    if (ch === "$") return;
    const kind = ch === "!" ? "encore" : s.p.tier >= 2 ? "guitar" : "amp";
    const side = s.p.x + s.p.w / 2 <= x * TILE + 24 ? -1 : 1;
    s.items.push({ kind, room: room.name, x: x * TILE + 8, y: y * TILE, w: 32, h: 32, vx: 0, vy: 0, rise: 24, side, still: ch === "*" });
    ev.push({ type: "sprout", kind });
  }

  /* Power-ups rise out of the box, hop off toward the side it was bumped from
     and land on the floor, so a box with nothing beside it can still pay out.
     Then the Amp walks toward that side (a refill box keeps its Amp still),
     Encore bounces and the Guitar waits. */
  function stepItems(s, ev) {
    const p = s.p;
    for (const it of s.items) {
      const room = s.world.rooms[it.room];
      if (it.rise > 0) { it.y -= 1.4; if (--it.rise === 0) { it.vx = it.side * 2.4; it.vy = -6; } }
      else {
        it.vy = Math.min(10, it.vy + 0.45);
        it.x += it.vx;
        if (WD.boxSolid(s, room, it)) { it.x -= it.vx; it.vx = -it.vx; }
        const pb = it.y + it.h; it.y += it.vy;
        const fl = WD.boxSolid(s, room, it, pb);
        if (fl && it.vy >= 0) {
          it.y = fl.y * TILE - it.h;
          if (it.kind === "encore") it.vy = -8;
          else { it.vy = 0; it.vx = it.kind === "amp" && !it.still ? it.side * 1.8 : 0; }
        } else if (fl) { it.y = (fl.y + 1) * TILE; it.vy = 0; }
        if (it.y > room.h * TILE) it.gone = true;
      }
      if (p.state === "play" && it.room === p.room && it.rise <= 0 && WD.overlap(p, it)) {
        it.gone = true;
        if (it.kind === "amp") p.tier = Math.max(p.tier, 2);
        if (it.kind === "guitar") p.tier = 3;
        if (it.kind === "encore") p.encore = 600;
        ev.push({ type: "power", kind: it.kind, x: it.x, y: it.y }, { type: "score", n: 1000, x: it.x, y: it.y });
      }
    }
    s.items = s.items.filter(i => !i.gone);
  }

  function fire(s, ev) {
    const p = s.p;
    if (p.cd > 0 || p.state !== "play") return;
    const guitar = p.tier >= 3;
    if (guitar && s.shots.filter(q => !q.whistle).length >= 3) return;
    const x = p.face > 0 ? p.x + p.w - 4 : p.x - 16;
    s.shots.push({ room: p.room, x, y: p.y + 20, w: 20, h: 16, vx: p.face * (guitar ? 9 : 7), life: guitar ? 52 : 15, whistle: !guitar, age: 0 });
    p.cd = guitar ? 10 : 16; p.shootT = 12;
    ev.push({ type: guitar ? "shoot" : "whistle" });
  }

  function stepShots(s, ev) {
    for (const q of s.shots) {
      const room = s.world.rooms[q.room];
      q.x += q.vx; q.age++;
      const lx = q.vx > 0 ? q.x + q.w : q.x, cy = q.y + q.h / 2;
      const r = WD.strike(s, room, Math.floor(lx / TILE), Math.floor(cy / TILE), ev, "note");
      if (r === "vapour" || r === "solid") { q.dead = true; if (r === "solid") ev.push({ type: "fizzle", x: lx, y: cy }); continue; }
      if (s.boss && F.noteVsBoss(s, q, ev)) { q.dead = true; continue; }
      if (F.noteVsFoes(s, q, ev)) { q.dead = true; continue; }
      if (--q.life <= 0) q.dead = true;
    }
    s.shots = s.shots.filter(q => !q.dead);
  }

  function collect(s, ev) {
    const p = s.p, room = s.world.rooms[p.room];
    for (let y = Math.floor(p.y / TILE); y <= Math.floor((p.y + p.h - 1) / TILE); y++)
      for (let x = Math.floor(p.x / TILE); x <= Math.floor((p.x + p.w - 1) / TILE); x++) {
        const ch = WD.cell(room, x, y);
        if (ch === "o") {
          room.grid[WD.idx(room, x, y)] = ".";
          s.notes++;
          ev.push({ type: "note" }, { type: "score", n: 100, x: x * TILE + 24, y: y * TILE });
        } else if (ch === "C") {
          const cp = s.checkpoint;
          if (!cp || cp.room !== p.room || cp.x !== x || cp.y !== y) { s.checkpoint = { room: p.room, x, y }; ev.push({ type: "checkpoint", x: x * TILE + 24, y: y * TILE }); }
        }
      }
    while (s.notes >= 100) { s.notes -= 100; ev.push({ type: "extraLife" }); }
  }

  function exits(s, ev, input) {
    const p = s.p;
    if (p.state !== "play") return;
    if (input.down) {
      const link = WD.linkAt(s, p.room, p, p.on);
      if (link) {
        p.state = "warp"; p.warpT = link.def.kind === "portal" ? 36 : 48; p.vx = 0; p.vy = 0;
        s.warp = { to: WD.otherEnd(s, link.n, link.end), kind: link.def.kind, half: link.def.kind === "portal" ? 18 : 24 };
        ev.push({ type: "warp", kind: link.def.kind });
        return;
      }
    }
    for (const L of s.exitLanterns) {
      if (L.room !== p.room || p.x + p.w < L.x - 24 || p.x > L.x + 24 || p.y + p.h < L.top) continue;
      // the tally: soul notes gathered, seconds left on the clock, ghost blocks blasted to vapour
      const secs = Math.ceil(s.timeT / 60), { notes, ghosts } = s.stats;
      const bonus = { notes: notes * 50, time: secs * 20, ghosts: ghosts * 100 };
      const n = bonus.notes + bonus.time + bonus.ghosts;
      s.phase = "clear"; s.phaseT = CLEAR; p.state = "light"; p.vx = 0; p.vy = 0; p.face = 1; p.x = L.x - p.w / 2 - 40;
      s.finish = { kind: "lantern", lantern: L, t: 0, secs, notes, ghosts, bonus, points: n };
      ev.push({ type: "lantern", x: L.x, y: L.bottom - 130 });
      return;
    }
    const bossDown = !s.boss || s.boss.st === "gone";
    for (const d of s.doors) {
      if (d.room !== p.room || !bossDown) continue;
      if (WD.overlap(p, { x: d.x * TILE + 8, y: d.y * TILE - 24, w: 32, h: 72 })) {
        s.phase = "clear"; s.phaseT = CLEAR; p.state = "door"; p.vx = 0;
        s.finish = { kind: "door", door: d };
        ev.push({ type: "door" }, { type: "score", n: 2000, x: d.x * TILE, y: d.y * TILE });
        return;
      }
    }
  }

  function warp(s, ev) {
    const p = s.p, w = s.warp;
    p.warpT--;
    if (p.warpT === w.half) {
      const to = w.to;
      p.room = to.room;
      p.x = to.x * TILE + 24 - p.w / 2;
      p.y = to.solid ? to.y * TILE - p.h : (to.y + 1) * TILE - p.h;
      p.vx = 0; p.vy = 0; p.ride = null;
      s.shots = [];
      camera(s, true);
      ev.push({ type: "arrive", kind: w.kind });
    }
    if (p.warpT <= 0) { p.state = "play"; p.inv = Math.max(p.inv, 30); s.warp = null; }
  }

  // ============================================================ camera
  function camera(s, snap) {
    const p = s.p, room = s.world.rooms[p.room], wpx = room.w * TILE, hpx = room.h * TILE;
    const c = s.cam;
    if (Math.abs(p.vx) > 1) c.lead += (p.face * 110 - c.lead) * 0.04;
    let tx = p.x + p.w / 2 - 480 + c.lead;
    let lo = VIEW_L, hi = wpx - VIEW_R;
    if (s.arena && s.arena.room === p.room) { lo = Math.max(lo, s.arena.left + VIEW_L); hi = Math.min(hi, s.arena.right - VIEW_R); }
    tx = hi < lo ? (lo + hi) / 2 : clamp(tx, lo, hi);
    const ty = clamp(p.y + p.h / 2 - 400, 0, Math.max(0, hpx - 720));
    if (snap) { c.x = tx; c.y = ty; }
    else { c.x += (tx - c.x) * 0.2; c.y += (ty - c.y) * 0.12; }
  }

  // ============================================================ one frame
  function step(s, input = {}) {
    const ev = [], p = s.p;
    s.t++;
    switch (s.phase) {
      case "intro": if (--s.phaseT <= 0) s.phase = "play"; return ev;      // nothing moves under the title
      case "done": case "over": return ev;
      case "dying":
        if (p.why !== "pit") { p.vy += 0.6; p.y += p.vy; }
        if (--s.phaseT <= 0) {
          if ((input.lives ?? 3) <= 1) { s.phase = "ending"; s.phaseT = ENDING; }
          else { s.phase = "done"; ev.push({ type: "lose" }); }
        }
        return ev;
      case "ending": if (--s.phaseT <= 0) { s.phase = "over"; ev.push({ type: "gameover" }); } return ev;
      case "clear": {
        const f = s.finish;
        if (f && f.kind === "lantern") {
          if (p.y + p.h < f.lantern.bottom) p.y = Math.min(f.lantern.bottom - p.h, p.y + 6);
          if (++f.t === LIGHT) {
            ev.push({ type: "flare", n: f.points, x: f.lantern.x, y: f.lantern.bottom - 130 });
            if (f.points) ev.push({ type: "score", n: f.points, x: f.lantern.x, y: f.lantern.bottom - 200 });
          }
        }
        camera(s);
        if (--s.phaseT <= 0) { s.phase = "done"; ev.push({ type: s.last ? "win" : "next" }); }
        return ev;
      }
      case "victory":
        F.stepBoss(s, ev, C, {});
        if (--s.phaseT <= 0) { s.phase = "done"; ev.push({ type: "win" }); }
        return ev;
    }

    // ---- play ----
    const notes0 = s.notes;
    if (!s.arena && s.timeT > 0) {
      if (--s.timeT === 60 * 60) ev.push({ type: "hurry" });
      if (s.timeT <= 0) die(s, ev, "time");
    }
    for (const k of ["inv", "encore", "cd", "shootT", "land"]) if (p[k] > 0) p[k]--;
    if (p.state === "warp") warp(s, ev);
    else {
      movePlayer(s, input, ev);
      if (p.state === "play") {
        if (input.fire) fire(s, ev);
        collect(s, ev);
        exits(s, ev, input);
      }
    }
    F.stepMovers(s, ev, C);
    F.stepFoes(s, ev, C);
    if (s.boss) F.stepBoss(s, ev, C, input);
    stepShots(s, ev);
    stepItems(s, ev);
    const bodies = [p, ...s.foes.filter(f => f.type === "s" || f.type === "k" || f.type === "pumpkin")];
    WD.tickCells(s, ev, bodies);
    if (s.phase === "play") { F.playerVsFoes(s, ev, C); F.playerVsBoss(s, ev, C); }
    const room = s.world.rooms[p.room];
    if (s.phase === "play" && p.state !== "warp" && p.y > room.h * TILE + 10) die(s, ev, "pit");
    if (s.boss && s.boss.type === "plumbmonkey" && s.boss.st === "gone" && s.phase === "play") {
      s.phase = "victory"; s.phaseT = VICTORY; p.state = "victory"; p.vx = 0;
      ev.push({ type: "victory" }, { type: "score", n: 20000, x: p.x, y: p.y });
    }
    // level stats for the lantern tally (an extra life takes 100 notes off the counter)
    s.stats.notes += s.notes - notes0;
    for (const e of ev) { if (e.type === "vapour") s.stats.ghosts++; else if (e.type === "extraLife") s.stats.notes += 100; }
    camera(s);
    return ev;
  }

  // ============================================================ autopilot
  /* A look-ahead pilot for attract mode and the soak tests. Every few frames it
     clones the state and tries a handful of short input plans (a direction held
     or released, a jump now or after a delay), lets any airborne ending land,
     and keeps the plan that ends closest to the next target without dying.
     Targets: a nearby upgrade first, then the boss (or a refill box, or the
     pedestal) inside an arena, then ROUTES waypoints, else the level exit. If
     a waypoint stops getting closer it falls back to the nearest earlier one. */
  const ROUTES = {
    "2-1": [[9, 38], [15, 35], [21, 32], [14, 29], [7, 26], [24, 20, "cp"], [17, 17], [11, 14], [5, 11], [21, 5], [26, 5]].map(([col, row, cp]) => ({ room: "main", col, row, cp: !!cp, rewind: true })),
    "2-2": [
      { room: "main", col: 24, row: 12, down: true },
      { room: "other", col: 40, row: 12, down: true, cp: true },
      { room: "main", col: 63, row: 12, tier: 3 },
      { room: "main", col: 63, row: 12, face: 1, vapour: [[66, 12], [67, 12], [68, 12], [69, 12], [70, 12], [71, 12]] },
      { room: "main", col: 62, row: 12, down: true },
      { room: "other", col: 79, row: 11, down: true },
      { exit: true }
    ]
  };
  function clone(s) {
    const L = s.level; s.level = null;
    try { const c = structuredClone(s); c.level = L; return c; } finally { s.level = L; }
  }
  const pilots = new WeakMap();

  function routeFor(s) {
    const r = ROUTES[s.level.id];
    if (!r) return [{ exit: true }];
    if (!s.checkpoint) return r;
    const last = r.map(w => w.cp).lastIndexOf(true);
    return last >= 0 ? r.slice(last + 1) : r;
  }
  function upgradeItem(s) {
    const p = s.p;
    return s.items.find(it => it.room === p.room && it.rise <= 0 && Math.abs(it.x - p.x) < 520 && Math.abs(it.y - p.y) < 300 &&
      (it.kind === "encore" || (it.kind === "amp" && p.tier < 2) || (it.kind === "guitar" && p.tier < 3)));
  }
  function target(s, wp) {
    const p = s.p, b = s.boss, it = upgradeItem(s);
    if (it) return { room: it.room, x: it.x + it.w / 2, y: it.y + it.h };
    if (b && b.st !== "sleep" && b.st !== "gone" && s.arena) {
      if (b.pedestal) return { room: b.room, x: b.pedestal.x + 24, y: b.pedestal.y + 60 };
      const room = s.world.rooms[b.room];
      if (p.tier < 3) {
        const i = room.grid.findIndex((c, k) => c === "*" && (k % room.w) * TILE >= s.arena.left);
        if (i >= 0) { const x = i % room.w, y = Math.floor(i / room.w); return { room: b.room, x: x * TILE + 24, y: groundBelow(s, room, x, y + 1) }; }
      }
      const side = p.x < b.x ? -1 : 1;
      return { room: b.room, x: clamp(b.x + b.w / 2 + side * 280, s.arena.left + 60, s.arena.right - 60), y: b.y + b.h };
    }
    if (!wp || wp.exit) {
      const d = s.doors[0], e = s.exitLanterns[0];
      if (d) return { room: d.room, x: d.x * TILE + 24, y: (d.y + 1) * TILE };
      if (e) return { room: e.room, x: e.x, y: e.bottom };
      if (b) return { room: b.room, x: b.x, y: b.y + b.h };
      return { room: p.room, x: p.x + 500, y: p.y + p.h };
    }
    return { room: wp.room, x: wp.col * TILE + 24, y: (wp.row + 1) * TILE };
  }
  function reached(s, wp) {
    const p = s.p;
    return wp && !wp.exit && p.room === wp.room && p.on && Math.abs(p.x + p.w / 2 - (wp.col * TILE + 24)) < 30 && Math.abs(p.y + p.h - (wp.row + 1) * TILE) < 6;
  }
  function vapourReady(s, wp) {
    const room = s.world.rooms[wp.room];
    return wp.vapour.every(([x, y]) => room.ghost[WD.idx(room, x, y)]);
  }
  // Height only matters as the target gets near: from far away, climbing a stair
  // or a ledge on the way must not look like moving away from a ground-level goal.
  function distTo(p, tg) {
    const dx = Math.abs(p.x + p.w / 2 - tg.x), wy = 1.6 * clamp(1 - (dx - 200) / 400, 0.1, 1);
    return dx + wy * Math.abs(p.y + p.h - tg.y) + (p.room !== tg.room ? 5000 : 0);
  }
  function evaluate(s, tg) {
    const p = s.p;
    if (s.phase === "dying" || s.phase === "ending" || s.phase === "over") return -1e9;
    if (s.phase === "clear" || s.phase === "victory" || s.phase === "done") return 1e9;
    let v = -distTo(p, tg);
    v += p.tier * 4000;
    if (p.inv > 0) v -= 2500;
    const b = s.boss;
    if (b && b.st !== "sleep") v += (b.maxHp - b.hp) * 600 + (b.stage || 0) * 40000 + (b.jam ? 60000 : 0) + (b.st === "dying" || b.st === "gone" ? 1e6 : 0);
    if (p.on) v += 30;
    return v;
  }
  // Let an airborne ending play out (no input) so a jump into a pit scores as the death it is.
  function settle(c) {
    for (let f = 0; f < 50 && c.phase === "play" && !c.p.on; f++) step(c, { move: 0, lives: 3 });
  }

  const JUMPS = [null, [0, 7], [0, 22], [8, 22], [16, 22], [26, 22]];
  const planInput = (pn, f, t) => ({ move: pn.stop && f >= pn.stop ? 0 : pn.dir, jump: !!pn.jp && f === pn.jp[0],
    jumpHeld: !!pn.jp && f >= pn.jp[0] && f < pn.jp[0] + pn.jp[1], fire: (t % 12) === 0, down: false, lives: 3 });

  function autopilot(s, opts = {}) {
    const p = s.p;
    const horizon = opts.horizon || 44, every = opts.every || 6;
    let pl = pilots.get(s);
    if (!pl) { pl = { route: routeFor(s), i: 0, plan: null, k: 0, best: Infinity, stall: 0 }; pilots.set(s, pl); }
    const out = { move: 0, jump: false, jumpHeld: false, fire: false, down: false, lives: 3 };
    const b = s.boss;
    if (b && b.jam) {
      const j = b.jam, next = 60 + j.done * F.JAM_GAP;
      out.fire = Math.abs(j.t - next) <= 2;
      return out;
    }
    if (s.phase !== "play" || p.state !== "play") return out;

    let wp = pl.route[pl.i];
    if (wp && !upgradeItem(s) && reached(s, wp)) {
      if (wp.tier && p.tier < wp.tier) {          // bonk the refill box overhead until the upgrade drops
        pl.plan = null;
        out.jump = p.on && s.t % 24 === 0; out.jumpHeld = true;
        return out;
      }
      if (wp.vapour && !vapourReady(s, wp)) {
        pl.plan = null;
        out.fire = s.t % 11 === 0;
        if (p.face !== wp.face) out.move = wp.face;
        return out;
      }
      if (wp.down) { out.down = true; pl.i++; pl.plan = null; pl.best = Infinity; pl.stall = 0; return out; }
      pl.i++; pl.plan = null; pl.best = Infinity; pl.stall = 0; wp = pl.route[pl.i];
    }
    const tg = target(s, wp);

    const d = distTo(p, tg);
    if (d < pl.best - 24) { pl.best = d; pl.stall = 0; }
    else if (++pl.stall > 300 && wp && wp.rewind && pl.i > 0) {
      let j = 0, bd = Infinity;
      for (let k = 0; k < pl.i; k++) {
        const w = pl.route[k];
        if (w.exit || w.room !== p.room) continue;
        const dd = distTo(p, { room: w.room, x: w.col * TILE + 24, y: (w.row + 1) * TILE });
        if (dd < bd) { bd = dd; j = k; }
      }
      pl.i = j; pl.best = Infinity; pl.stall = 0; pl.plan = null;
      return out;
    }

    // replan every few frames, but never before a planned jump has actually happened
    if (!pl.plan || (pl.k >= every && !(pl.plan.jp && pl.k <= pl.plan.jp[0] + 2))) {
      const plans = [];
      for (const dir of [1, 0, -1]) for (const jp of JUMPS) plans.push({ dir, jp, stop: 0 });
      for (const dir of [1, -1]) for (const stop of [3, 8, 16]) plans.push({ dir, jp: null, stop });
      let best = null, bestV = -Infinity;
      pl.scores = [];
      for (const pn of plans) {
        const c = clone(s);
        for (let f = 0; f < horizon; f++) { step(c, planInput(pn, f, c.t)); if (c.phase !== "play") break; }
        settle(c);
        const v = evaluate(c, tg) + (pn.dir === 0 ? -8 : 0) + (pn.jp ? -4 : 0) + (pn.stop ? -2 : 0);
        pl.scores.push([pn.dir, pn.jp && pn.jp.join("/"), pn.stop, Math.round(v)]);
        if (v > bestV) { bestV = v; best = pn; }
      }
      pl.plan = best || { dir: Math.sign(tg.x - p.x) || 1, jp: null, stop: 0 }; pl.k = 0; pl.tg = tg;
    }
    const inp = planInput(pl.plan, pl.k, s.t);
    out.move = inp.move; out.jump = inp.jump; out.jumpHeld = inp.jumpHeld;
    out.fire = s.t % 12 === 0;
    pl.k++;
    return out;
  }
  const pilotInfo = s => pilots.get(s);

  const exports = { createState, step, respawn, nextState, autopilot, pilotInfo, clone, hurt, die, camera, levels, rnd,
    PHYS, INTRO, DYING, CLEAR, ENDING, VICTORY, TIME, LIGHT, TILE, ROUTES, World: WD, Foes: F, Levels: LV };
  if (NODE) module.exports = exports;
  else root.GraveyardGame = exports;
})(typeof window !== "undefined" ? window : globalThis);
