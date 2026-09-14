/* Amp Rampage — WHAT HAPPENS ON EACH STAGE (rules only, no drawing).

   setup(s, carry) builds a stage's objects; step(s, input, ev, C) runs them for
   one fixed frame after the Spaceman has moved. `C` is the core's callback
   table { die, score, clear, collapse, rnd } — this file never decides what a
   death costs or what a clear is worth beyond its own points.

     LOAD-IN  Plumbmonkey telegraphs and throws rolling gear that follows the
              slopes, sometimes drops down a ladder, and at the bottom a burning
              one lights the amp stack and releases a fire ghost. Mic stands hang
              above the deck: jump into one to smash for ten seconds.
     CABLES   snap-jack amps crawl down the cables, bats patrol, cymbals hang
              on cables and fall when touched, taking out whatever is below. Carry
              the key to the cage.
     BUILD    four rigs of four parts. Walking the whole length of a part drops
              it a floor; a part that lands on another knocks that one down too.
              Monsters riding a dropping part go down with it. Feedback stuns.
     RIVETS   walk over all eight bolts; each leaves a gap you must jump. */
(function (root) {
  "use strict";
  const NODE = typeof module !== "undefined" && module.exports;
  const W = NODE ? require("./amp-world.js") : root.AmpWorld;
  const { gy, inSpan, supported, rollDir, body, overlap, clamp } = W;

  const hitbox = p => ({ x: p.x - 8, y: p.y - 46, w: 16, h: 43 });
  function smashBox(p) {
    return [{ x: p.x + (p.face > 0 ? 4 : -48), y: p.y - 70, w: 44, h: 72 }, { x: p.x - 22, y: p.y - 90, w: 44, h: 40 }];
  }
  const hammerHits = (p, box) => p.hammer > 0 && smashBox(p).some(b => overlap(b, box));

  // ============================================================ shared: hammers and fire ghosts
  function setupHammers(s) {
    s.hammers = (s.def.hammers || []).map(h => ({ x: h.x, y: gy(s.geo, h.g, h.x) - h.lift, taken: false }));
  }
  function stepHammers(s, ev) {
    const p = s.p;
    for (const h of s.hammers) {
      if (h.taken || p.state !== "air") continue;
      if (overlap(body(p), { x: h.x - 13, y: h.y - 16, w: 26, h: 32 })) { h.taken = true; p.hammer = 600; ev.push({ type: "hammer", x: h.x, y: h.y }); }
    }
  }
  function makeFire(s, x, g, dir) {
    return { x, g, y: gy(s.geo, g, x), dir: dir || 1, speed: 0.9 + 0.15 * Math.min(s.cycle, 4), state: "walk", ladder: -1, climbDir: 0, lastL: -1, t: 0, dead: 0 };
  }
  function stepFires(s, ev, C) {
    const G = s.geo, p = s.p;
    for (const f of s.fires) {
      f.t++;
      if (f.dead) { f.dead--; continue; }
      if (f.state === "walk") {
        const nx = f.x + f.dir * f.speed;
        if (!supported(s, f.g, nx)) f.dir = -f.dir;
        else { f.x = nx; f.y = gy(G, f.g, f.x); }
        G.ladders.forEach((L, i) => {
          if (L.broken || i === f.lastL || Math.abs(L.x - f.x) > f.speed) return;
          const k = L.stops.findIndex(st => st.g === f.g);
          if (k < 0) return;
          f.lastL = i;
          const pg = p.g >= 0 ? p.g : (p.lastG ?? f.g);
          let dir = pg > f.g ? 1 : pg < f.g ? -1 : 0;
          if (!dir || C.rnd(s) < 0.35) dir = C.rnd(s) < 0.5 ? 1 : -1;
          const nk = k + dir;
          if (nk < 0 || nk >= L.stops.length || C.rnd(s) < 0.3) return;
          f.state = "climb"; f.ladder = i; f.climbDir = dir; f.x = L.x;
        });
        if (f.lastL >= 0 && Math.abs(G.ladders[f.lastL].x - f.x) > 30) f.lastL = -1;
      } else {
        const L = G.ladders[f.ladder];
        f.y -= f.climbDir * 0.9;                 // climbDir +1 = up the rig (smaller y)
        const next = L.stops.find(st => f.climbDir > 0 ? st.y < f.y + 0.9 && st.y >= f.y - 0.01 && st.g > f.g : st.y > f.y - 0.9 && st.y <= f.y + 0.01 && st.g < f.g);
        if (next) { f.y = next.y; f.g = next.g; f.state = "walk"; f.lastL = f.ladder; }
        if (f.y < L.yTop - 1 || f.y > L.yBot + 1) { f.y = clamp(f.y, L.yTop, L.yBot); f.state = "walk"; f.g = L.stops[f.y <= L.yTop ? L.stops.length - 1 : 0].g; }
      }
      const box = { x: f.x - 14, y: f.y - 30, w: 28, h: 30 };
      if (hammerHits(p, box)) { f.dead = 40; f.gone = true; ev.push({ type: "smash", x: f.x, y: f.y - 14, what: "fire" }); C.score(s, ev, 500, f.x, f.y - 30); continue; }
      if (s.phase === "play" && p.state !== "dead" && overlap(hitbox(p), box)) C.die(s, ev, "fire");
    }
    s.fires = s.fires.filter(f => !f.gone);
  }

  // ============================================================ LOAD-IN
  function setupLoadin(s) {
    const G = s.geo, D = s.def;
    setupHammers(s);
    s.barrels = []; s.fires = [];
    s.drum = { x: D.drum.x, y: gy(G, D.drum.g, D.drum.x), lit: 0 };
    s.boss = { x: D.boss.x, y: gy(G, D.boss.g, D.boss.x), pose: "idle", poseT: 0, face: 1, throwT: 120, count: 0 };
    s.fan = { x: D.fan.x, y: gy(G, D.fan.g, D.fan.x), g: D.fan.g };
    s.throwEvery = Math.max(80, D.throwEvery - 14 * s.cycle);
    s.rollSpeed = D.rollSpeed + 0.22 * Math.min(s.cycle, 4);
  }
  function stepLoadin(s, input, ev, C) {
    const G = s.geo, p = s.p, b = s.boss;
    if (--b.throwT === 42) { b.pose = "throw"; b.poseT = 70; ev.push({ type: "warning" }); }
    if (b.throwT <= 0) {
      const x = b.x + 36;
      s.barrels.push({ x, y: gy(G, 5, x), g: 5, dir: rollDir(G, 5, 1), state: "roll", vx: 0, vy: 0, spin: 0,
        burning: b.count % 5 === 4 || C.rnd(s) < 0.06 * s.cycle, decided: {}, jumped: false });
      b.count++; b.throwT = s.throwEvery;
      ev.push({ type: "throw", x, y: b.y - 60 });
    }
    if (b.poseT > 0 && --b.poseT === 0) b.pose = b.count && b.count % 6 === 0 ? "taunt" : "idle";
    if (s.drum.lit > 0) s.drum.lit--;

    for (const r of s.barrels) {
      if (r.state === "roll") {
        const nx = r.x + r.dir * s.rollSpeed;
        if (!inSpan(G, r.g, nx)) { r.state = "fall"; r.vx = r.dir * 0.9; r.vy = 1; }
        else {
          G.ladders.forEach((L, i) => {
            if (r.decided[i] || L.stops[L.stops.length - 1].g !== r.g) return;
            if ((r.x - L.x) * (nx - L.x) > 0 && r.x !== L.x) return;
            r.decided[i] = true;
            const below = p.g >= 0 && p.g < r.g && Math.abs(p.x - L.x) < 220;
            if (C.rnd(s) < 0.2 + (below ? 0.25 : 0) + 0.04 * s.cycle) { r.state = "ladder"; r.x = L.x; r.ladder = i; ev.push({ type: "ladderDrop", x: L.x, y: r.y }); }
          });
          if (r.state === "roll") { r.x = nx; r.y = gy(G, r.g, r.x); r.spin += r.dir * s.rollSpeed / 15; }
        }
      } else if (r.state === "ladder") {
        const L = G.ladders[r.ladder];
        r.y += 2; r.spin += 0.05;
        if (r.y >= L.yBot) { r.y = L.yBot; r.g = L.stops[0].g; r.state = "roll"; r.dir = r.g === 0 ? -1 : rollDir(G, r.g, -1); r.decided = {}; }
      } else {
        const prevY = r.y;
        r.vy = Math.min(8, r.vy + 0.3); r.x += r.vx; r.y += r.vy; r.spin += r.vx * 0.08;
        for (let g = r.g - 1; g >= 0; g--) {
          if (!inSpan(G, g, r.x)) continue;
          const yy = gy(G, g, r.x);
          if (prevY <= yy && r.y >= yy) { r.y = yy; r.g = g; r.state = "roll"; r.dir = g === 0 ? -1 : rollDir(G, g, -1); r.decided = {}; ev.push({ type: "bounce", x: r.x, y: yy }); break; }
        }
        if (r.y > 760) r.gone = true;
      }
      if (r.g === 0 && r.state === "roll" && r.x < s.drum.x + 26) {
        r.gone = true;
        if (r.burning && s.fires.length < 2 + Math.min(s.cycle, 3)) { s.fires.push(makeFire(s, s.drum.x + 30, 0, 1)); s.drum.lit = 60; ev.push({ type: "ignite", x: s.drum.x, y: s.drum.y - 40 }); }
        continue;
      }
      // drawn at 14px radius, collides at 12: a straight-up jump over oncoming gear must clear it
      const box = { x: r.x - 12, y: r.y - 24, w: 24, h: 24 };
      if (hammerHits(p, box)) { r.gone = true; ev.push({ type: "smash", x: r.x, y: r.y - 14, what: "barrel" }); C.score(s, ev, r.burning ? 500 : 300, r.x, r.y - 30); continue; }
      if (!r.jumped && p.state === "air" && Math.abs(r.x - p.x) < 16 && p.y < r.y - 24 && r.g === (p.lastG ?? -2)) {
        r.jumped = true; C.score(s, ev, 100, p.x, p.y - 60); ev.push({ type: "jumpBonus" });
      }
      if (s.phase === "play" && p.state !== "dead" && overlap(hitbox(p), box)) C.die(s, ev, "barrel");
    }
    s.barrels = s.barrels.filter(r => !r.gone);
    stepHammers(s, ev);
    stepFires(s, ev, C);
    if (s.phase === "play" && p.state === "walk" && p.g === s.fan.g && Math.abs(p.x - s.fan.x) < 40) C.clear(s, ev);
  }

  // ============================================================ CABLES
  function setupCables(s) {
    const D = s.def;
    s.cymbals = D.cymbals.map(c => ({ x: D.cables[c.cable].x, y: c.y, state: "hang", vy: 0, kills: 0 }));
    s.jacks = [];
    s.bats = D.bats.map((b, i) => ({ x: b.x0 + (b.x1 - b.x0) * (0.3 + 0.4 * i), base: b.y, y: b.y, x0: b.x0, x1: b.x1, dir: i % 2 ? -1 : 1, t: i * 40, dead: 0 }));
    s.key = { x: D.key.x, y: D.platforms[D.key.p].y, taken: false };
    s.cage = { x: D.cage.x, y: D.platforms[D.cage.p].y, p: D.cage.p };
    s.boss = { x: D.boss.x, y: D.platforms[D.boss.p].y, pose: "idle", poseT: 0, face: -1, jackT: 120 };
  }
  function stepCables(s, input, ev, C) {
    const D = s.def, p = s.p, b = s.boss, hb = hitbox(p);
    if (--b.jackT === 30) { b.pose = "command"; b.poseT = 50; }
    if (b.jackT <= 0) {
      b.jackT = Math.max(95, D.jackEvery - 12 * s.cycle);
      if (s.jacks.length < 3 + Math.min(s.cycle, 2)) {
        const i = Math.floor(C.rnd(s) * D.cables.length), c = D.cables[i];
        s.jacks.push({ cable: i, x: c.x, y: c.top, speed: 1.1 + 0.15 * Math.min(s.cycle, 4), state: "crawl", vy: 0, dead: 0 });
        ev.push({ type: "jack", x: c.x, y: c.top });
      }
    }
    if (b.poseT > 0 && --b.poseT === 0) b.pose = "idle";

    for (const j of s.jacks) {
      if (j.dead) { if (--j.dead <= 0) j.gone = true; continue; }
      const c = D.cables[j.cable];
      if (j.state === "crawl") { j.y += j.speed; if (j.y > c.bottom) { j.state = "fall"; j.vy = 1; } }
      else {
        j.vy = Math.min(8, j.vy + 0.3); const prev = j.y; j.y += j.vy;
        if (D.platforms.some(pl => j.x >= pl.x0 && j.x <= pl.x1 && prev <= pl.y && j.y >= pl.y) || j.y > 740) { j.gone = true; ev.push({ type: "pop", x: j.x, y: j.y }); continue; }
      }
      if (s.phase === "play" && p.state !== "dead" && overlap(hb, { x: j.x - 13, y: j.y - 13, w: 26, h: 26 })) C.die(s, ev, "jack");
    }
    for (const bat of s.bats) {
      if (bat.dead) { if (--bat.dead <= 0) { bat.dead = 0; bat.x = bat.dir > 0 ? bat.x0 : bat.x1; } continue; }
      bat.t++; bat.x += bat.dir * (1.4 + 0.2 * Math.min(s.cycle, 3));
      if (bat.x < bat.x0 || bat.x > bat.x1) bat.dir = -bat.dir;
      bat.y = bat.base + Math.sin(bat.t * 0.05) * 22;
      if (s.phase === "play" && p.state !== "dead" && overlap(hb, { x: bat.x - 18, y: bat.y - 10, w: 36, h: 20 })) C.die(s, ev, "bat");
    }
    for (const cy of s.cymbals) {
      if (cy.state === "hang") {
        if (overlap(body(p), { x: cy.x - 16, y: cy.y - 10, w: 32, h: 20 })) { cy.state = "fall"; cy.vy = 1; ev.push({ type: "cymbal", x: cy.x, y: cy.y }); }
        continue;
      }
      if (cy.state !== "fall") continue;
      cy.vy = Math.min(9, cy.vy + 0.35); cy.y += cy.vy;
      const box = { x: cy.x - 20, y: cy.y - 10, w: 40, h: 22 };
      for (const j of s.jacks) if (!j.dead && overlap(box, { x: j.x - 13, y: j.y - 13, w: 26, h: 26 })) { j.dead = 20; C.score(s, ev, 400 << Math.min(cy.kills++, 3), j.x, j.y); ev.push({ type: "crush", x: j.x, y: j.y }); }
      for (const bat of s.bats) if (!bat.dead && overlap(box, { x: bat.x - 18, y: bat.y - 10, w: 36, h: 20 })) { bat.dead = 300; C.score(s, ev, 400 << Math.min(cy.kills++, 3), bat.x, bat.y); ev.push({ type: "crush", x: bat.x, y: bat.y }); }
      if (cy.y > 740) cy.state = "gone";
    }
    s.jacks = s.jacks.filter(j => !j.gone);
    if (!s.key.taken && overlap(body(p), { x: s.key.x - 14, y: s.key.y - 34, w: 28, h: 30 })) {
      s.key.taken = true; p.key = true; ev.push({ type: "key", x: s.key.x, y: s.key.y - 20 }); C.score(s, ev, 800, s.key.x, s.key.y - 40);
    }
    if (s.phase === "play" && p.key && p.state === "walk" && p.g === s.cage.p && Math.abs(p.x - s.cage.x) < 40) C.clear(s, ev);
  }

  // ============================================================ BUILD
  const PART_W = 112, SLICE = 28;
  const FOE_SPEED = { frank: 1.0, ghost: 1.2, witch: 1.35 };
  function setupBuild(s, carry) {
    const D = s.def, G = s.geo;
    if (carry && carry.parts) {
      s.parts = carry.parts.map(q => Object.assign({}, q, { pressed: q.state === "tray" ? q.pressed.slice() : [0, 0, 0, 0], vy: 0,
        state: q.state === "fall" ? "rest" : q.state }));
      s.trayCount = carry.trayCount.slice();
    } else {
      s.parts = [];
      D.stacks.forEach((cx, j) => D.layers.forEach((kind, k) => s.parts.push({ j, k, kind, x: cx, g: k, y: gy(G, k, cx), state: "rest", pressed: [0, 0, 0, 0], vy: 0 })));
      s.trayCount = D.stacks.map(() => 0);
    }
    s.parts.forEach(q => { if (q.state === "rest") q.y = gy(G, q.g, q.x); });
    const n = D.floors.length, roster = D.foes.slice();
    const extra = ["ghost", "frank", "witch"];
    for (let i = 0; i < Math.min(s.cycle, 2); i++) roster.push({ type: extra[i], x: i ? 240 : 720, f: 0 });
    s.foes = roster.map(f => makeFoe(s, f.type, f.x, n - 1 - f.f));
    s.charges = carry && carry.charges != null ? Math.max(carry.charges, 2) : D.feedback;
    s.boss = { x: D.boss.x, y: D.boss.y, pose: "idle", poseT: 0, face: 1 };
  }
  function makeFoe(s, type, x, g) {
    return { type, x, g, y: gy(s.geo, g, x), dir: 1, speed: FOE_SPEED[type] + 0.15 * Math.min(s.cycle, 4), state: "walk", ladder: -1, climbDir: 0, stun: 0, dead: 0, ride: -1, face: 1, t: 0 };
  }
  function startDrop(s, q, ev) {
    q.state = "fall"; q.vy = 0;
    const i = s.parts.indexOf(q);
    for (const f of s.foes) if (!f.dead && f.state !== "climb" && f.g === q.g && Math.abs(f.x - q.x) < PART_W / 2) { f.state = "ride"; f.ride = i; }
    ev.push({ type: "drop", x: q.x, y: q.y });
  }
  function stepBuild(s, input, ev, C) {
    const D = s.def, G = s.geo, p = s.p;
    // pressing parts underfoot
    if (p.state === "walk") for (const q of s.parts) {
      if (q.state !== "rest" || q.g !== p.g || Math.abs(p.x - q.x) > PART_W / 2) continue;
      const k = clamp(Math.floor((p.x - (q.x - PART_W / 2)) / SLICE), 0, 3);
      if (!q.pressed[k]) {
        q.pressed[k] = 1; ev.push({ type: "press", x: q.x - PART_W / 2 + k * SLICE + 14, y: q.y }); C.score(s, ev, 50, p.x, p.y - 60);
        if (q.pressed.every(Boolean)) startDrop(s, q, ev);
      }
    }
    // falling parts, cascades and the trays
    for (const q of s.parts) {
      if (q.state !== "fall") continue;
      q.vy = Math.min(7, q.vy + 0.35); q.y += q.vy;
      const riders = s.foes.filter(f => f.state === "ride" && s.parts[f.ride] === q);
      riders.forEach(f => { f.y = q.y - 6; });
      const box = { x: q.x - PART_W / 2, y: q.y - 22, w: PART_W, h: 22 };
      for (const f of s.foes) if (!f.dead && f.state !== "ride" && overlap(box, { x: f.x - 12, y: f.y - 40, w: 24, h: 40 })) {
        f.dead = 300; f.state = "dead"; C.score(s, ev, 500, f.x, f.y - 40); ev.push({ type: "crush", x: f.x, y: f.y - 20 });
      }
      const toTray = q.g === 0, target = toTray ? D.tray - 18 * s.trayCount[q.j] : gy(G, q.g - 1, q.x);
      if (q.y < target) continue;
      q.y = target; q.vy = 0;
      riders.forEach((f, i) => { f.dead = 300; f.state = "dead"; f.ride = -1; C.score(s, ev, 1000 * (i + 1), f.x, f.y - 40); });
      if (riders.length) ev.push({ type: "riders", n: riders.length, x: q.x, y: q.y });
      if (toTray) {
        q.state = "tray"; s.trayCount[q.j]++;
        s.charges = Math.min(9, s.charges + 1);          // every part that lands in a tray refills one Feedback
        C.score(s, ev, 300, q.x, q.y - 30); ev.push({ type: "stack", x: q.x, y: q.y });
        if (s.trayCount[q.j] === D.layers.length) { C.score(s, ev, 2000, q.x, q.y - 60); ev.push({ type: "rigDone", x: q.x, y: q.y }); }
      } else {
        q.g--; q.state = "rest"; q.pressed = [0, 0, 0, 0];
        ev.push({ type: "land", x: q.x, y: q.y });
        const under = s.parts.find(o => o !== q && o.state === "rest" && o.j === q.j && o.g === q.g);
        if (under) startDrop(s, under, ev);
      }
    }
    // Feedback
    if (input.action && s.charges > 0 && p.state !== "dead") {
      s.charges--;
      ev.push({ type: "feedback", x: p.x, y: p.y - 30, face: p.face });
      for (const f of s.foes) if (!f.dead && f.state !== "ride" && Math.abs(f.y - p.y) < 44 && (f.x - p.x) * p.face > -14 && (f.x - p.x) * p.face < 150) { f.stun = 210; ev.push({ type: "stun", x: f.x, y: f.y - 30 }); }
    }
    // monsters chase along floors and up and down ladders
    const pg = p.state === "climb" ? nearestStop(G.ladders[p.ladder], p.y).g : p.g >= 0 ? p.g : p.lastG;
    for (const f of s.foes) {
      f.t++;
      if (f.state === "dead") {
        if (--f.dead <= 0) {
          const top = G.girders.length - 1, xs = [60, 720], x = xs[Math.floor(C.rnd(s) * 2)];
          Object.assign(f, makeFoe(s, f.type, x, top));
          ev.push({ type: "respawnFoe", x, y: f.y });
          s.boss.pose = "command"; s.boss.poseT = 50;
        }
        continue;
      }
      if (f.state === "ride") continue;
      if (f.stun > 0) { f.stun--; continue; }
      if (f.state === "walk") {
        /* Three personalities, so they spread out instead of queueing at one
           ladder top: Frankenstein walks straight at you, the witch heads you
           off where you are going, and the ghost drifts off on his own now and
           then. Each picks ladders by its own target, not by its own position. */
        if (f.type === "ghost" && f.t % 240 === 0) f.wander = C.rnd(s) < 0.45 ? 90 : 0;
        if (f.wander > 0) f.wander--;
        const aim = f.type === "witch" ? clamp(p.x + p.face * 130, D.x0, D.x1) : f.wander > 0 ? (f.t % 480 < 240 ? D.x0 + 40 : D.x1 - 40) : p.x;
        let tx;
        if (f.g === pg && !f.wander) tx = aim;
        else if (f.wander > 0) tx = aim;
        else {
          const up = pg > f.g;
          let best = null;
          const ref = f.type === "frank" ? f.x : aim;
          G.ladders.forEach((L, i) => {
            const k = L.stops.findIndex(st => st.g === f.g);
            if (k < 0 || (up ? k === L.stops.length - 1 : k === 0)) return;
            if (!best || Math.abs(L.x - ref) < Math.abs(best.L.x - ref)) best = { L, i };
          });
          if (best) {
            tx = best.L.x;
            if (Math.abs(f.x - tx) <= f.speed) { f.x = tx; f.state = "climb"; f.ladder = best.i; f.climbDir = up ? 1 : -1; }
          } else tx = p.x;
        }
        if (f.state === "walk") {
          const dx = tx - f.x;
          if (Math.abs(dx) > 1) { f.dir = Math.sign(dx); f.face = f.dir; f.x = clamp(f.x + f.dir * Math.min(f.speed, Math.abs(dx)), D.x0, D.x1); }
          f.y = gy(G, f.g, f.x);
        }
      } else if (f.state === "climb") {
        const L = G.ladders[f.ladder];
        f.y -= f.climbDir * f.speed * 0.8;
        const passed = L.stops.find(st => (f.climbDir > 0 ? st.g > f.g && f.y <= st.y : st.g < f.g && f.y >= st.y));
        if (passed) {
          f.g = passed.g; f.y = passed.y;
          const k = L.stops.indexOf(passed), end = f.climbDir > 0 ? k === L.stops.length - 1 : k === 0;
          if (end || passed.g === pg) f.state = "walk";
        }
      }
      if (s.phase === "play" && p.state !== "dead" && overlap(hitbox(p), { x: f.x - 12, y: f.y - 40, w: 24, h: 40 })) C.die(s, ev, "monster");
    }
    if (s.boss.poseT > 0 && --s.boss.poseT === 0) s.boss.pose = "idle";
    if (s.phase === "play" && s.parts.every(q => q.state === "tray")) C.clear(s, ev);
  }
  const nearestStop = (L, y) => L.stops.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);

  // ============================================================ RIVETS
  function setupRivets(s, carry) {
    const D = s.def, G = s.geo;
    setupHammers(s);
    s.rivets = D.rivets.map(([g, x], i) => ({ g, x, pulled: !!(carry && carry.pulled && carry.pulled[i]), pending: false }));
    s.holes = s.rivets.filter(r => r.pulled).map(r => ({ g: r.g, x: r.x }));
    s.fires = D.fires.map((f, i) => makeFire(s, f.x, f.g, i % 2 ? -1 : 1));
    for (let i = 0; i < Math.min(s.cycle, 2); i++) s.fires.push(makeFire(s, 500, 1 + i, 1));
    s.boss = { x: D.boss.x, y: gy(G, D.boss.g, D.boss.x), pose: "taunt", poseT: 0, face: 1, dir: 1 };
    s.fan = { x: D.fan.x, y: gy(G, D.fan.g, D.fan.x), g: D.fan.g };
  }
  function stepRivets(s, input, ev, C) {
    const p = s.p, b = s.boss;
    for (const r of s.rivets) {
      if (!r.pulled && p.state === "walk" && p.g === r.g && Math.abs(p.x - r.x) < 10) {
        r.pulled = true; r.pending = true;
        C.score(s, ev, 100, r.x, p.y - 60); ev.push({ type: "rivet", x: r.x, y: p.y });
        const n = s.rivets.filter(q => q.pulled).length;
        if (n % 2 === 0 && n < 8 && s.fires.length < 3 + Math.min(s.cycle, 2)) {
          const g = 1 + Math.floor(C.rnd(s) * 3), girder = s.geo.girders[g];
          s.fires.push(makeFire(s, C.rnd(s) < 0.5 ? girder.x0 + 30 : girder.x1 - 30, g, 1));
          ev.push({ type: "ignite", x: s.fires[s.fires.length - 1].x, y: s.fires[s.fires.length - 1].y - 20 });
        }
      }
      // the gap opens once the Spaceman has stepped clear of it
      if (r.pending && (p.g !== r.g || Math.abs(p.x - r.x) > W.HOLE + 12)) { r.pending = false; s.holes.push({ g: r.g, x: r.x }); }
    }
    b.x += b.dir * 0.8; if (b.x < s.geo.girders[5].x0 + 40 || b.x > s.fan.x - 60) b.dir = -b.dir;
    b.face = b.dir; b.y = gy(s.geo, 5, b.x);
    stepHammers(s, ev);
    stepFires(s, ev, C);
    if (s.phase === "play" && s.rivets.every(r => r.pulled) && !s.rivets.some(r => r.pending)) C.collapse(s, ev);
  }

  const SETUP = { loadin: setupLoadin, cables: setupCables, build: setupBuild, rivets: setupRivets };
  const STEP = { loadin: stepLoadin, cables: stepCables, build: stepBuild, rivets: stepRivets };
  function setup(s, carry) { s.holes = []; s.fires = []; s.hammers = []; SETUP[s.kind](s, carry); }
  function step(s, input, ev, C) { STEP[s.kind](s, input, ev, C); }
  function carryOf(s) {
    if (s.kind === "build") return { parts: s.parts.map(q => Object.assign({}, q, { pressed: q.pressed.slice() })), trayCount: s.trayCount.slice(), charges: s.charges };
    if (s.kind === "rivets") return { pulled: s.rivets.map(r => r.pulled) };
    return null;
  }

  const exports = { setup, step, carryOf, hitbox, smashBox, makeFire, makeFoe, startDrop, PART_W, SLICE };
  if (NODE) module.exports = exports;
  else root.AmpStages = exports;
})(typeof window !== "undefined" ? window : globalThis);
