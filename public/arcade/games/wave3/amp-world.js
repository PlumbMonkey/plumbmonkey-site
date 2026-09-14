/* Amp Rampage — GEOMETRY AND MOVEMENT (rules only, no drawing).

   Turns a stage from amp-data.js into girders and ladders, moves the Spaceman
   on them (walk, jump, climb, fall) or on the Cable Jungle's cables (one hand,
   two hands, let go), and builds the ladder graph the autopilot plans over.
   Positions are FEET: p.x is the centre, p.y is where the boots touch.
   Everything runs on fixed 1/60 s frames. */
(function (root) {
  "use strict";
  const WALK = 2.0, HAMMER_WALK = 1.5, CLIMB = 1.5, JUMP_V = -6.6, GRAV = 0.3, MAXFALL = 8;
  const FALL_DEATH = 74, BODY_H = 52, HOLE = 14;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- geometry ----------
  function buildGeometry(def) {
    if (def.kind === "cables") return { kind: "cables", girders: [], ladders: [] };
    let girders, ladders;
    if (def.kind === "build") {
      const n = def.floors.length;                         // floors are listed top→bottom; girder 0 is the bottom
      girders = def.floors.slice().reverse().map(y => ({ x0: def.x0, x1: def.x1, y0: y, y1: y }));
      ladders = def.ladders.map(l => ({ x: l.x, gBot: n - 1 - l.lo, gTop: n - 1 - l.hi }));
    } else {
      girders = def.girders.map(g => Object.assign({}, g));
      ladders = def.ladders.map(l => ({ x: l.x, gBot: l.lo, gTop: l.hi, broken: !!l.broken }));
    }
    const G = { kind: def.kind, girders, ladders };
    for (const L of ladders) {
      L.stops = [];
      for (let g = L.gBot; g <= L.gTop; g++) if (inSpan(G, g, L.x)) L.stops.push({ g, y: gy(G, g, L.x) });
      L.yBot = L.stops[0].y; L.yTop = L.stops[L.stops.length - 1].y;
    }
    return G;
  }
  const inSpan = (G, g, x) => { const r = G.girders[g]; return !!r && x >= r.x0 && x <= r.x1; };
  function gy(G, g, x) {
    const r = G.girders[g];
    return r.y0 + (r.y1 - r.y0) * (x - r.x0) / (r.x1 - r.x0);
  }
  const holeAt = (s, g, x) => s.holes.some(h => h.g === g && Math.abs(h.x - x) < HOLE);
  const supported = (s, g, x) => g >= 0 && inSpan(s.geo, g, x) && !holeAt(s, g, x);
  // the low end of a sloped girder is where rolling gear heads
  function rollDir(G, g, fallback) {
    const r = G.girders[g];
    if (r.y1 > r.y0) return 1;
    if (r.y1 < r.y0) return -1;
    return fallback || -1;
  }
  const body = p => ({ x: p.x - 12, y: p.y - BODY_H, w: 24, h: BODY_H });
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function ladderFor(G, p, dir) {
    for (let i = 0; i < G.ladders.length; i++) {
      const L = G.ladders[i];
      if (L.broken || Math.abs(L.x - p.x) > 9) continue;
      const k = L.stops.findIndex(st => Math.abs(st.y - p.y) < 4);
      if (k < 0) continue;
      if (dir < 0 && k < L.stops.length - 1) return i;      // up
      if (dir > 0 && k > 0) return i;                       // down
    }
    return -1;
  }

  /* One frame of girder movement (Load-in, Build, Rivets). `C` = { die(s, ev, why) }. */
  function moveGirder(s, input, ev, C) {
    const p = s.p, G = s.geo;
    if (p.state === "walk") {
      const vert = input.up ? -1 : input.down ? 1 : 0;
      if (vert && !p.hammer) {
        const i = ladderFor(G, p, vert);
        if (i >= 0) { p.state = "climb"; p.ladder = i; p.x = G.ladders[i].x; p.vx = 0; ev.push({ type: "climb" }); }
      }
    }
    if (p.state === "walk") {
      const mv = clamp(input.move || 0, -1, 1);
      p.vx = mv * (p.hammer ? HAMMER_WALK : WALK);
      if (mv) p.face = mv;
      if (input.jump && !p.hammer && s.kind !== "build") {
        p.state = "air"; p.vy = JUMP_V; p.jumpY = p.y; p.lastG = p.g; p.g = -1;
        ev.push({ type: "jump" });
      } else {
        // Stage Build's decks run wall to wall: the ends are the edge of the stage, not a drop
        const r = G.girders[p.g], lo = s.kind === "build" ? r.x0 : 12, hi = s.kind === "build" ? r.x1 : 948;
        p.x = clamp(p.x + p.vx, lo, hi);
        p.dist += Math.abs(p.vx);
        if (!supported(s, p.g, p.x)) { p.state = "air"; p.vy = 0; p.jumpY = p.y; p.lastG = p.g; p.g = -1; }
        else p.y = gy(G, p.g, p.x);
      }
    }
    if (p.state === "air") {
      const prevY = p.y;
      p.vy = Math.min(MAXFALL, p.vy + GRAV);
      p.y += p.vy;
      p.x = clamp(p.x + p.vx, 12, 948);
      if (p.vy > 0) {
        for (let g = 0; g < G.girders.length; g++) {
          if (!supported(s, g, p.x)) continue;
          const yy = gy(G, g, p.x);
          if (prevY <= yy + 0.5 && p.y >= yy) {
            p.y = yy;
            if (yy - p.jumpY > FALL_DEATH) { C.die(s, ev, "fall"); return; }
            p.vy = 0; p.g = g; p.state = "walk"; p.vx = 0;
            ev.push({ type: "land" });
            break;
          }
        }
      }
      if (p.state === "air" && p.y > 760) C.die(s, ev, "fall");
    }
    if (p.state === "climb") {
      const L = G.ladders[p.ladder], v = (input.up ? -CLIMB : 0) + (input.down ? CLIMB : 0);
      p.y += v; p.climb += Math.abs(v);
      if (p.y <= L.yTop) { p.y = L.yTop; p.g = L.stops[L.stops.length - 1].g; p.state = "walk"; }
      else if (p.y >= L.yBot) { p.y = L.yBot; p.g = L.stops[0].g; p.state = "walk"; }
      else if (input.move) {
        const st = L.stops.find(q => Math.abs(q.y - p.y) < 3);
        if (st) { p.y = st.y; p.g = st.g; p.state = "walk"; }
      }
    }
  }

  /* One frame on the Cable Jungle: platforms, jumps, and cables. One hand
     climbs slowly and slides fast; two hands climb fast and slide slowly. */
  function moveCables(s, input, ev, C) {
    const p = s.p, D = s.def;
    if (p.grabCd > 0) p.grabCd--;
    const mv = clamp(input.move || 0, -1, 1), moveEdge = mv && mv !== p.lastMove;
    p.lastMove = mv;
    if (p.state === "walk") {
      p.vx = mv * WALK;
      if (mv) p.face = mv;
      const pl = D.platforms[p.g];
      if (input.jump) { p.state = "air"; p.vy = JUMP_V; p.jumpY = p.y; p.lastG = p.g; p.g = -1; ev.push({ type: "jump" }); }
      else {
        p.x = clamp(p.x + p.vx, 12, 948);
        p.dist += Math.abs(p.vx);
        if (p.x < pl.x0 || p.x > pl.x1) { p.state = "air"; p.vy = 0; p.jumpY = p.y; p.lastG = p.g; p.g = -1; }
      }
    }
    if (p.state === "air") {
      const prevY = p.y;
      p.vy = Math.min(MAXFALL, p.vy + GRAV);
      p.y += p.vy; p.x = clamp(p.x + p.vx, 12, 948);
      if (p.vy > 0) D.platforms.forEach((pl, i) => {
        if (p.state !== "air" || p.x < pl.x0 || p.x > pl.x1) return;
        if (prevY <= pl.y + 0.5 && p.y >= pl.y) { p.y = pl.y; p.vy = 0; p.vx = 0; p.g = i; p.state = "walk"; ev.push({ type: "land" }); }
      });
      if (p.state === "air" && p.grabCd <= 0) {
        const hands = p.y - BODY_H;
        const i = D.cables.findIndex(c => Math.abs(c.x - p.x) < 12 && hands >= c.top && hands <= c.bottom);
        if (i >= 0) { Object.assign(p, { state: "hang", cable: i, partner: -1, grip: 1, x: D.cables[i].x, vx: 0, vy: 0 }); ev.push({ type: "grab" }); }
      }
      if (p.state === "air" && p.y > D.pit) C.die(s, ev, "pit");
    }
    if (p.state === "hang") {
      const c = D.cables[p.cable], q = p.partner >= 0 ? D.cables[p.partner] : null;
      const top = q ? Math.max(c.top, q.top) : c.top, bottom = q ? Math.min(c.bottom, q.bottom) : c.bottom;
      const upV = q ? 2.2 : 0.9, dnV = q ? 1.1 : 2.4;
      let hands = p.y - BODY_H;
      const before = hands;
      hands += (input.up ? -upV : 0) + (input.down ? dnV : 0);
      if (input.jump) {
        Object.assign(p, { state: "air", vx: (mv || p.face) * 2.8, vy: -4.8, grabCd: 14, jumpY: p.y, g: -1 });
        if (mv) p.face = mv;
        ev.push({ type: "jump" });
        return;
      }
      if (hands < top) {
        hands = top;
        if (input.up) {
          const i = D.platforms.findIndex(pl => p.x >= pl.x0 - 10 && p.x <= pl.x1 + 10 && pl.y <= top + 10 && pl.y >= top - 80);
          if (i >= 0) { Object.assign(p, { state: "walk", g: i, y: D.platforms[i].y, x: clamp(p.x, D.platforms[i].x0, D.platforms[i].x1) }); ev.push({ type: "climbUp" }); return; }
        }
      }
      if (hands > bottom) { Object.assign(p, { state: "air", vy: 1, vx: 0, grabCd: 12, jumpY: p.y, g: -1 }); return; }
      p.y = hands + BODY_H; p.climb += Math.abs(hands - before);
      if (moveEdge) {
        p.face = mv;
        if (!q) {
          const j = D.cables.findIndex((o, k) => k !== p.cable && Math.sign(o.x - c.x) === mv && Math.abs(o.x - c.x) <= 34 && hands >= o.top && hands <= o.bottom);
          if (j >= 0) { p.partner = j; p.grip = 2; p.x = (c.x + D.cables[j].x) / 2; ev.push({ type: "grip2" }); }
          else { Object.assign(p, { state: "air", vx: mv * 2.4, vy: -2.2, grabCd: 14, jumpY: p.y, g: -1 }); }
        } else {
          const keep = Math.sign(q.x - c.x) === mv ? p.partner : p.cable;
          Object.assign(p, { cable: keep, partner: -1, grip: 1, x: D.cables[keep].x });
        }
      }
    }
  }

  // ---------- the ladder graph, for the autopilot ----------
  /* Nodes are the points where a ladder meets a girder. Walking along a girder
     costs its distance (plus a little for each rivet hole in the way, which has
     to be jumped); climbing costs a bit more than walking. */
  function costField(s, goal) {
    const G = s.geo, nodes = [];
    G.ladders.forEach((L, li) => { if (!L.broken) L.stops.forEach((st, k) => nodes.push({ li, k, g: st.g, x: L.x, y: st.y })); });
    const holesBetween = (g, a, b) => s.holes.filter(h => h.g === g && h.x > Math.min(a, b) && h.x < Math.max(a, b)).length * 60;
    const walk = (g, a, b) => Math.abs(a - b) + holesBetween(g, a, b);
    const dist = nodes.map(n => n.g === goal.g ? walk(n.g, n.x, goal.x) : Infinity);
    const done = nodes.map(() => false);
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done[u] = true;
      const a = nodes[u];
      nodes.forEach((b, v) => {
        if (done[v]) return;
        let w = Infinity;
        if (b.li === a.li && Math.abs(b.k - a.k) === 1) w = Math.abs(b.y - a.y) * 1.3;
        else if (b.g === a.g) w = walk(a.g, a.x, b.x);
        if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
      });
    }
    return function cost(p) {
      if (p.state === "climb") {
        const L = G.ladders[p.ladder];
        let best = Infinity;
        nodes.forEach((n, i) => { if (n.li === p.ladder) best = Math.min(best, Math.abs(n.y - p.y) * 1.3 + dist[i]); });
        void L;
        return best;
      }
      let g = p.g;
      if (g < 0) {                                     // airborne: the girder under the feet
        let bestY = Infinity;
        G.girders.forEach((r, i) => { if (inSpan(G, i, p.x)) { const yy = gy(G, i, p.x); if (yy >= p.y - 2 && yy < bestY) { bestY = yy; g = i; } } });
        if (g < 0) return Infinity;
      }
      let best = g === goal.g ? walk(g, p.x, goal.x) : Infinity;
      nodes.forEach((n, i) => { if (n.g === g) best = Math.min(best, walk(g, p.x, n.x) + dist[i]); });
      return best;
    };
  }

  const exports = { WALK, HAMMER_WALK, CLIMB, JUMP_V, GRAV, FALL_DEATH, BODY_H, HOLE,
    buildGeometry, gy, inSpan, supported, holeAt, rollDir, body, overlap, ladderFor, moveGirder, moveCables, costField, clamp };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  else root.AmpWorld = exports;
})(typeof window !== "undefined" ? window : globalThis);
