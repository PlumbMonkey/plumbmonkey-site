/* Amp Rampage — CORE RULES (no drawing; amp-art.js renders and wires the host).

   Owns the state, the phase machine (title → play → dying / clear / collapse
   → ending), the bonus timer, respawns that keep a stage's progress (built
   rigs, pulled rivets), and the look-ahead autopilot used by attract mode and
   the soak test. Movement lives in amp-world.js, stage logic in amp-stages.js.

   Fixed 1/60 s frames. step(s, input) returns events ({type, ...}).
   input: { move, up, down, jump (press edge), action (press edge), lives } */
(function (root) {
  "use strict";
  const NODE = typeof module !== "undefined" && module.exports;
  const D = NODE ? require("./amp-data.js") : root.AmpData;
  const W = NODE ? require("./amp-world.js") : root.AmpWorld;
  const S = NODE ? require("./amp-stages.js") : root.AmpStages;

  const INTRO = 150, DYING = 100, CLEAR = 160, COLLAPSE = 210, ENDING = 150, BONUS_TICK = 120;
  const clamp = W.clamp;

  function rnd(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }

  // ============================================================ state
  function createState(n = 1, carry = {}) {
    const info = D.stageInfo(n), def = info.def;
    const s = { n, def, kind: def.kind, cycle: info.cycle, index: info.index, t: 0, phase: "intro", phaseT: INTRO,
      rng: (n * 2654435761) >>> 0, geo: W.buildGeometry(def), holes: [],
      bonus: 5000 + 1000 * Math.min(info.cycle, 3), phaseLen: INTRO,
      // the bonus counts down 100 a tick; building four rigs and the cable climb take longer than a DK screen
      bonusTick: def.kind === "build" ? 200 : def.kind === "cables" ? 150 : BONUS_TICK };
    s.bonusT = s.bonusTick;
    let x, y, g;
    if (def.kind === "cables") { g = def.start.p; x = def.start.x; y = def.platforms[g].y; }
    else {
      g = def.kind === "build" ? def.floors.length - 1 - def.start.f : def.start.g;
      x = def.start.x; y = W.gy(s.geo, g, x);
    }
    s.p = { x, y, g, lastG: g, vx: 0, vy: 0, state: "walk", face: 1, ladder: -1, jumpY: y, hammer: 0, dist: 0, climb: 0,
      cable: -1, partner: -1, grip: 1, grabCd: 0, lastMove: 0, lead: -1, why: null };
    S.setup(s, carry.stage);
    return s;
  }
  const respawn = s => createState(s.n, { stage: S.carryOf(s) });

  // ============================================================ callbacks for the stage logic
  function die(s, ev, why) {
    if (s.phase !== "play") return;
    const p = s.p;
    s.phase = "dying"; s.phaseT = DYING; s.phaseLen = DYING;
    p.state = "dead"; p.why = why; p.hammer = 0; p.vy = -5;
    ev.push({ type: "die", why, x: p.x, y: p.y - 30 });
  }
  function score(s, ev, n, x, y) { ev.push({ type: "score", n, x, y }); }
  function clear(s, ev) {
    if (s.phase !== "play" && s.phase !== "collapse") return;
    s.phase = "clear"; s.phaseT = CLEAR; s.phaseLen = CLEAR;
    if (s.boss) { s.boss.pose = s.kind === "rivets" ? "defeat" : "hit"; s.boss.poseT = 0; }
    ev.push({ type: "clear", bonus: s.bonus });
    if (s.bonus) score(s, ev, s.bonus, s.p.x, s.p.y - 80);
  }
  function collapse(s, ev) {
    if (s.phase !== "play") return;
    s.phase = "collapse"; s.phaseT = COLLAPSE; s.phaseLen = COLLAPSE;
    s.boss.pose = "defeat"; s.p.state = "walk"; s.p.vx = 0;
    ev.push({ type: "collapse" });
  }
  const C = { die, score, clear, collapse, rnd };

  // ============================================================ one frame
  function step(s, input = {}) {
    const ev = [], p = s.p;
    s.t++;
    switch (s.phase) {
      case "intro": if (--s.phaseT <= 0) s.phase = "play"; return ev;      // nothing moves under the title
      case "done": case "over": return ev;
      case "dying":
        p.vy += 0.3; p.y += p.vy * 0.5;
        if (--s.phaseT <= 0) {
          if ((input.lives ?? 3) <= 1) { s.phase = "ending"; s.phaseT = ENDING; s.phaseLen = ENDING; }
          else { s.phase = "done"; ev.push({ type: "lose" }); }
        }
        return ev;
      case "ending": if (--s.phaseT <= 0) { s.phase = "over"; ev.push({ type: "gameover" }); } return ev;
      case "clear":
        if (--s.phaseT <= 0) { s.phase = "done"; ev.push({ type: "next" }); }
        return ev;
      case "collapse":
        if (s.phaseT === 120) ev.push({ type: "bossFall" });
        if (--s.phaseT <= 0) clear(s, ev);
        return ev;
    }

    if (p.hammer > 0 && --p.hammer === 0) ev.push({ type: "hammerEnd" });
    if (--s.bonusT <= 0) {
      s.bonusT = s.bonusTick;
      s.bonus = Math.max(0, s.bonus - 100);
      if (s.bonus === 0) { die(s, ev, "time"); return ev; }
      if (s.bonus === 1000) ev.push({ type: "hurry" });
    }
    if (s.kind === "cables") W.moveCables(s, input, ev, C);
    else W.moveGirder(s, input, ev, C);
    if (s.phase === "play") S.step(s, input, ev, C);
    return ev;
  }

  // ============================================================ autopilot
  /* A look-ahead pilot for attract mode and the soak test. Every few frames it
     clones the state and tries short input plans (walk left/right/stand × no
     jump/jump × up/down/neither), and keeps the plan that ends cheapest to reach
     the stage goal without dying. Costs come from the ladder graph
     (amp-world.js costField); the Cable Jungle follows a waypoint list. */
  const CABLE_ROUTE = [
    { x: 120, y: 640, lead: 0 }, { x: 175, y: 640 }, { x: 243, y: 300, hang: true }, { x: 430, y: 420, hang: true },
    { x: 630, y: 580, plug: 0 }, { x: 545, y: 580, lead: 1 },
    { x: 713, y: 440, hang: true }, { x: 863, y: 420, hang: true }, { x: 935, y: 560, plug: 1 }, { x: 810, y: 560, lead: 2 },
    { x: 863, y: 460, hang: true }, { x: 863, y: 210, hang: true }, { x: 940, y: 120, plug: 2 }
  ];
  const pilots = new WeakMap();

  function clone(s) {
    const def = s.def, geo = s.geo;
    s.def = null; s.geo = null;
    try { const c = structuredClone(s); c.def = def; c.geo = geo; return c; } finally { s.def = def; s.geo = geo; }
  }

  function goalsFor(s) {
    if (s.kind === "loadin") return [{ g: s.fan.g, x: s.fan.x }];
    if (s.kind === "rivets") return s.rivets.filter(r => !r.pulled).map(r => ({ g: r.g, x: r.x }));
    if (s.kind === "build") {
      const out = [];
      for (const q of s.parts) if (q.state === "rest") q.pressed.forEach((v, k) => { if (!v) out.push({ g: q.g, x: q.x - S.PART_W / 2 + k * S.SLICE + 14 }); });
      return out;
    }
    return [];
  }
  function progress(s) {
    if (s.kind === "rivets") return s.rivets.filter(r => r.pulled).length * 4000;
    if (s.kind === "build") return s.parts.reduce((a, q) => a + (q.k - (q.state === "tray" ? -1 : q.g)) * 900 + q.pressed.reduce((u, v) => u + v, 0) * 250, 0);
    if (s.kind === "cables") return s.sockets.filter(k => k.on).length * 20000 + (s.p.lead >= 0 ? 8000 : 0);
    return 0;
  }
  // standing inside a stack's lit crash zone costs far more than any detour
  function danger(c) {
    if (c.kind !== "loadin") return 0;
    let d = 0;
    for (const k of c.stacks) {
      if ((k.state !== "armed" && k.state !== "wobble") || c.p.g !== k.g) continue;
      const z = S.zone(k);
      if (c.p.x > z.x0 - 20 && c.p.x < z.x1 + 20) d += 1500;
    }
    return d;
  }
  function makeCost(s, pl) {
    if (s.kind === "cables") {
      const wp = CABLE_ROUTE[Math.min(pl.i, CABLE_ROUTE.length - 1)];
      return c => Math.abs(c.p.x - wp.x) + Math.abs(c.p.y - wp.y) * 1.2 + (wp.hang && c.p.state !== "hang" ? 60 : 0);
    }
    const key = `${s.kind}:${s.holes.length}:${s.kind === "build" ? s.parts.map(q => q.g + q.state[0] + q.pressed.join("")).join() : s.rivets ? s.rivets.map(r => +r.pulled).join("") : ""}`;
    if (pl.costKey !== key) {
      pl.costKey = key;
      pl.fields = goalsFor(s).map(goal => W.costField(s, goal));
    }
    const fields = pl.fields;
    return c => fields.length ? Math.min(...fields.map(f => f(c.p))) : 0;
  }
  function evaluate(c, cost) {
    if (c.phase === "dying" || c.phase === "ending" || c.phase === "over") return -1e9;
    if (c.phase === "clear" || c.phase === "collapse" || c.phase === "done") return 1e9;
    const k = cost(c);
    return -(Number.isFinite(k) ? k : 5000) + progress(c) + (c.p.hammer > 0 ? 50 : 0) - danger(c);
  }
  function cableReached(s, wp) {
    const p = s.p;
    if (wp.lead != null) return s.leads[wp.lead].taken;
    if (wp.plug != null) return s.sockets[wp.plug].on;
    return Math.abs(p.x - wp.x) < 16 && Math.abs(p.y - wp.y) < 30 && (wp.hang ? p.state === "hang" : p.state === "walk");
  }

  // hold a direction (or stop after a few frames), jump now or a moment later, or climb
  const PLANS = [];
  for (const move of [1, 0, -1]) for (const jump of [false, true]) for (const vert of [0, -1, 1]) if (!(jump && vert)) PLANS.push({ move, jump, vert, jumpAt: 0, stop: 0 });
  for (const move of [1, 0, -1]) PLANS.push({ move, jump: true, vert: 0, jumpAt: 4, stop: 0 });
  for (const move of [1, -1]) for (const stop of [4, 10, 20]) PLANS.push({ move, jump: false, vert: 0, jumpAt: 0, stop });
  const BUILD_PLANS = PLANS.filter(pn => !pn.jump).concat([1, 0, -1].map(move => ({ move, jump: false, vert: 0, jumpAt: 0, stop: 0, action: true })));
  const planInput = (pn, f) => ({ move: pn.stop && f >= pn.stop ? 0 : pn.move, jump: pn.jump && f === pn.jumpAt,
    up: pn.vert < 0, down: pn.vert > 0, action: !!pn.action && f === 0, lives: 3 });

  function autopilot(s, opts = {}) {
    const p = s.p, horizon = opts.horizon || 36, every = opts.every || 6;
    const out = { move: 0, up: false, down: false, jump: false, action: false, lives: 3 };
    if (s.phase !== "play" || p.state === "dead") return out;
    let pl = pilots.get(s);
    if (!pl) { pl = { i: 0, plan: null, k: 0 }; pilots.set(s, pl); }
    if (s.kind === "cables") while (pl.i < CABLE_ROUTE.length - 1 && cableReached(s, CABLE_ROUTE[pl.i])) { pl.i++; pl.plan = null; }
    if (!pl.plan || (pl.k >= every && !(pl.plan.jump && pl.k <= pl.plan.jumpAt))) {
      const cost = makeCost(s, pl);
      let best = null, bestV = -Infinity;
      for (const pn of s.kind === "build" ? BUILD_PLANS : PLANS) {
        const c = clone(s);
        for (let f = 0; f < horizon; f++) { step(c, planInput(pn, f)); if (c.phase !== "play") break; }
        // a jump or a let-go still in the air at the horizon has to land before it can be judged
        for (let f = 0; f < 60 && c.phase === "play" && c.p.state === "air"; f++) step(c, { move: 0, lives: 3 });
        const v = evaluate(c, cost) - (pn.move === 0 && pn.vert === 0 ? 6 : 0) - (pn.jump ? 3 : 0) - (pn.action ? 400 : 0);
        if (v > bestV) { bestV = v; best = pn; }
      }
      pl.plan = best || PLANS[0]; pl.k = 0;
    }
    const inp = planInput(pl.plan, pl.k);
    out.move = inp.move; out.up = inp.up; out.down = inp.down; out.jump = inp.jump; out.action = inp.action;
    pl.k++;
    return out;
  }
  const pilotInfo = s => pilots.get(s);

  const exports = { createState, step, respawn, autopilot, pilotInfo, clone, die, rnd,
    INTRO, DYING, CLEAR, COLLAPSE, ENDING, BONUS_TICK, CABLE_ROUTE, Data: D, World: W, Stages: S };
  if (NODE) module.exports = exports;
  else root.AmpGame = exports;
})(typeof window !== "undefined" ? window : globalThis);
