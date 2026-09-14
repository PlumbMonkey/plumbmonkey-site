/* Graveyard Shift — THE TILE WORLD (rules only, no drawing).

   Turns a level from graveyard-levels.js into mutable rooms, and owns every
   question about tiles: what is solid, what a head-bump or a note does to a
   cell, and the slow cycles of ghost blocks, crumbling floors and refilling
   music boxes. Everything is per fixed 1/60 s frame. */
(function (root) {
  "use strict";
  const TILE = 48;
  const REFORM = 360, FLICKER = 60;          // ghost vapour lasts 6 s, then flickers 1 s
  const CRUMBLE_SHAKE = 24, CRUMBLE_GONE = 300, BOX_REFILL = 600;
  const ENEMY = "skpwcbtfFmhv";

  function linkSolid(rows, x, y) {
    const l = rows[y][x - 1], r = rows[y][x + 1];
    return (l === "#" || l === "B") && (r === "#" || r === "B");
  }

  /* Parse a built level into rooms (mutable char grids) plus the things that
     live on them. Returns plain data only, so the state can be cloned. */
  function createWorld(level) {
    const rooms = {}, spawns = [], links = {};
    let start = null, boss = null;
    for (const name in level.rooms) {
      const src = level.rooms[name], other = level.other === name;
      const grid = [];
      src.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        let out = ch;
        if (ch === "@") { start = { room: name, x, y }; out = "."; }
        else if (ch === "X") { boss = { room: name, x, y }; out = "."; }
        else if (/[1-9]/.test(ch)) {
          (links[ch] = links[ch] || []).push({ room: name, x, y, solid: linkSolid(src.rows, x, y) });
          out = linkSolid(src.rows, x, y) ? "g" : ".";
        } else if (ENEMY.includes(ch)) {
          spawns.push({ type: ch, room: name, x, y });
          out = ch === "f" || ch === "F" ? "B" : ".";
        } else if (ch === "p") { spawns.push({ type: "p", room: name, x, y }); out = "U"; }
        else if (ch === "G" && other) out = "S";            // spirit stone: the Other Side's permanent ghosts
        grid.push(out);
      }));
      rooms[name] = { name, w: src.w, h: src.h, grid, other, ghost: {}, crumble: {}, refill: {} };
    }
    return { rooms, spawns, links, start, boss, twin: level.other ? "main" : null };
  }

  const idx = (room, x, y) => y * room.w + x;
  function cell(room, x, y) {
    if (x < 0 || x >= room.w) return "#";                  // room edges are walls
    if (y < 0 || y >= room.h) return ".";                  // above is open, below is a pit
    return room.grid[y * room.w + x];
  }
  function ghostSolid(room, i) { const g = room.ghost[i]; return !g; }

  /* 0 = passable, 1 = solid, 2 = one-way (solid from above only). */
  function solidity(s, room, x, y) {
    const ch = cell(room, x, y);
    switch (ch) {
      case "#": case "B": case "S": case "U": case "g":
      case "?": case "!": case "$": case "*": case "u": case "^": return 1;
      case "G": return ghostSolid(room, idx(room, x, y)) ? 1 : 0;
      case "=": { const c = room.crumble[idx(room, x, y)]; return c && c.gone ? 0 : 1; }
      case "L": {
        const twin = s.world.rooms[s.world.twin];
        return twin && twin.ghost[idx(room, x, y)] ? 1 : 0;
      }
      case "-": return 2;
    }
    return 0;
  }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* Does box b hit anything solid in room? One-way ledges count only when the
     box's previous bottom was at or above the ledge top. */
  function boxSolid(s, room, b, prevBottom) {
    const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = solidity(s, room, x, y);
      if (k === 1) return { x, y };
      if (k === 2 && prevBottom !== undefined && prevBottom <= y * TILE + 0.01 && b.y + b.h > y * TILE) return { x, y, oneWay: true };
    }
    return null;
  }

  /* A note or a head-bump reaches cell (x, y). Returns what happened. */
  function strike(s, room, x, y, ev, from) {
    const ch = cell(room, x, y), i = idx(room, x, y);
    if (ch === "G" && ghostSolid(room, i)) {
      room.ghost[i] = { st: "vapour", t: REFORM };
      ev.push({ type: "vapour", room: room.name, x: x * TILE + 24, y: y * TILE + 24 });
      ev.push({ type: "score", n: 50, x: x * TILE + 24, y: y * TILE });
      s.notes++; ev.push({ type: "note" });
      return "vapour";
    }
    if (from === "head" && "?!$*".includes(ch)) {
      ev.push({ type: "box", room: room.name, kind: ch, x, y });
      if (ch === "$") {
        const c = room.refill[i] || (room.refill[i] = { left: 6 });
        if (--c.left <= 0) room.grid[i] = "u";
        s.notes++; ev.push({ type: "note" }, { type: "score", n: 100, x: x * TILE + 24, y: y * TILE });
      } else {
        room.grid[i] = "u";
        if (ch === "*") room.refill[i] = { t: BOX_REFILL, kind: "*" };
      }
      return "box";
    }
    if (from === "head" && ch === "=") return "solid";
    return solidity(s, room, x, y) === 1 ? "solid" : "none";
  }

  /* The slow cycles. `bodies` are boxes in this room that a re-forming block
     must not crush: they are pushed up (or aside) instead, and if there is
     nowhere to go the block waits. */
  function tickCells(s, ev, bodies) {
    for (const name in s.world.rooms) {
      const room = s.world.rooms[name];
      for (const k in room.ghost) {
        const g = room.ghost[k];
        if (--g.t > 0) { if (g.t === FLICKER) g.st = "flicker"; continue; }
        const i = +k, x = i % room.w, y = (i - x) / room.w;
        const cellBox = { x: x * TILE, y: y * TILE, w: TILE, h: TILE };
        const stuck = bodies.filter(b => b.room === name && overlap(b, cellBox));
        delete room.ghost[k];
        let ok = true;
        for (const b of stuck) if (!pushOut(s, room, b, cellBox)) ok = false;
        if (!ok) { room.ghost[k] = { st: "flicker", t: 30 }; continue; }
        ev.push({ type: "reform", room: name, x: x * TILE + 24, y: y * TILE + 24 });
      }
      for (const k in room.crumble) {
        const c = room.crumble[k];
        if (!c.gone) { if (--c.t <= 0) { c.gone = true; c.t = CRUMBLE_GONE; ev.push({ type: "crumble", room: name, i: +k }); } continue; }
        if (--c.t > 0) continue;
        const i = +k, x = i % room.w, y = (i - x) / room.w;
        const cellBox = { x: x * TILE, y: y * TILE, w: TILE, h: TILE };
        if (bodies.some(b => b.room === name && overlap(b, cellBox))) { c.t = 20; continue; }
        delete room.crumble[k];
      }
      for (const k in room.refill) {
        const r = room.refill[k];
        if (r.kind !== "*" || --r.t > 0) continue;
        room.grid[+k] = "*"; delete room.refill[k];
      }
    }
  }
  function touchCrumble(room, x, y) {
    if (cell(room, x, y) !== "=") return;
    const i = idx(room, x, y);
    if (!room.crumble[i]) room.crumble[i] = { t: CRUMBLE_SHAKE, gone: false };
  }

  // Try up (the usual case: a block forms under the feet), then left, then right.
  function pushOut(s, room, b, cellBox) {
    const tries = [
      { x: b.x, y: cellBox.y - b.h },
      { x: cellBox.x - b.w, y: b.y },
      { x: cellBox.x + TILE, y: b.y }
    ];
    // the block is already back in the grid for these checks
    for (const t of tries) {
      const test = { x: t.x, y: t.y, w: b.w, h: b.h };
      if (!boxSolid(s, room, test)) { b.x = t.x; b.y = t.y; if (b.vy > 0) b.vy = 0; b.pushed = true; return true; }
    }
    return false;
  }

  function linkAt(s, roomName, box, standing) {
    for (const n in s.world.links) {
      for (const end of s.world.links[n]) {
        if (end.room !== roomName) continue;
        const def = s.level.links[n] || { kind: "grave" };
        if (def.oneWay && def.oneWay !== roomName) continue;
        const cx = end.x * TILE + 24;
        if (end.solid) {
          if (standing && Math.abs(box.x + box.w / 2 - cx) < 20 && Math.abs(box.y + box.h - end.y * TILE) < 2) return { n, end, def };
        } else if (overlap(box, { x: end.x * TILE + 8, y: end.y * TILE, w: 32, h: TILE })) return { n, end, def };
      }
    }
    return null;
  }
  function otherEnd(s, n, end) { return s.world.links[n].find(e => e !== end); }

  const exports = { TILE, REFORM, FLICKER, CRUMBLE_SHAKE, CRUMBLE_GONE, BOX_REFILL,
    createWorld, cell, solidity, boxSolid, strike, tickCells, touchCrumble, pushOut, overlap, linkAt, otherEnd, idx };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  else root.GraveyardWorld = exports;
})(typeof window !== "undefined" ? window : globalThis);
