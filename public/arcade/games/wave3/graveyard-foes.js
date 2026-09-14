/* Graveyard Shift — FOES, MOVERS AND BOSSES (rules only, no drawing).

   Plumbmonkey's army in Mario roles: skull crawlers (Goomba), armoured
   Frankensteins (Koopa: stomp to stun, kick to slide), cursed urn flowers
   (Piranha), potion witches (Hammer Bros), cloud ghosts (Lakitu), bats,
   gargoyles (Thwomp) and candelabra fire bars. Also the things you ride:
   swinging chandeliers and moving platforms. And both bosses: the Gatekeeper
   at the manor door, and Plumbmonkey himself in the Music Room, who can only
   be finished by PLAYING the legendary guitar.

   `C` is the core's callback table: { hurt(s, ev), rnd(s), W } — this file
   never decides what a hit costs the player. */
(function (root) {
  "use strict";
  const W = typeof module !== "undefined" && module.exports ? require("./graveyard-world.js") : root.GraveyardWorld;
  const { TILE, boxSolid, solidity, overlap } = W;
  const GRAV = 0.55, MAXFALL = 12;

  const POINTS = { s: 100, k: 200, p: 200, w: 300, c: 400, b: 150, pumpkin: 50 };
  const SIZE = { s: [36, 30], k: [34, 56], p: [30, 44], w: [34, 52], c: [52, 40], b: [40, 26], pumpkin: [26, 24] };

  function makeFoe(type, room, x, y, extra) {
    const [w, h] = SIZE[type];
    return Object.assign({ type, room, w, h, x: x * TILE + (TILE - w) / 2, y: (y + 1) * TILE - h, vx: 0, vy: 0,
      hx: x * TILE + 24, hy: y * TILE + 24, hp: type === "w" ? 2 : 1, st: "walk", t: 0, anim: 0, face: -1, dead: 0 }, extra);
  }

  function spawnFoes(s) {
    s.foes = []; s.movers = []; s.bars = [];
    for (const sp of s.world.spawns) {
      const { type, room, x, y } = sp;
      if ("skwcb".includes(type)) {
        const f = makeFoe(type, room, x, y);
        if (type === "s") f.vx = -1.1;
        if (type === "k") f.vx = -0.9;
        if (type === "c") { f.y = 3 * TILE; f.drop = 120; }
        s.foes.push(f);
      } else if (type === "p") {
        s.foes.push(makeFoe("p", room, x, y, { y: y * TILE - 44, baseY: y * TILE, rise: 0, t: 60 + (x * 7) % 90, st: "hide" }));
      } else if (type === "t") {
        s.movers.push({ kind: "gargoyle", room, x: x * TILE - 6, y: y * TILE, w: 60, h: 56, homeY: y * TILE, dx: 0, dy: 0, st: "wait", t: 0 });
      } else if (type === "m") {
        s.movers.push({ kind: "chandelier", room, px: x * TILE + 24, py: y * TILE + 24, len: 120, amp: 0.6, ph: x * 0.7, w: 144, h: 14, x: 0, y: 0, dx: 0, dy: 0 });
      } else if (type === "h" || type === "v") {
        const r = s.world.rooms[room];
        let n = 0;
        if (type === "h") while (n < 14 && solidity(s, r, x + 3 + n, y) !== 1) n++;
        else while (n < 6 && solidity(s, r, x, y - 1 - n) !== 1 && solidity(s, r, x + 2, y - 1 - n) !== 1) n++;
        s.movers.push({ kind: type, room, x: x * TILE, y: y * TILE, w: 144, h: 16, x0: x * TILE, y0: y * TILE,
          range: n * TILE, dir: 1, dx: 0, dy: 0 });
      } else if (type === "f" || type === "F") {
        s.bars.push({ room, cx: x * TILE + 24, cy: y * TILE + 24, n: type === "F" ? 6 : 4, a: x * 0.4, spin: type === "F" ? -0.026 : 0.034 });
      }
    }
    placeMovers(s);
  }

  function placeMovers(s) {
    for (const m of s.movers) if (m.kind === "chandelier") {
      const a = Math.sin(s.t * 0.028 + m.ph) * m.amp;
      m.x = m.px + Math.sin(a) * m.len - m.w / 2; m.y = m.py + Math.cos(a) * m.len - m.h / 2;
    }
  }

  // ---------- movers ----------
  function stepMovers(s, ev, C) {
    const p = s.p;
    for (const m of s.movers) {
      const ox = m.x, oy = m.y;
      if (m.kind === "chandelier") {
        const a = Math.sin(s.t * 0.028 + m.ph) * m.amp;
        m.x = m.px + Math.sin(a) * m.len - m.w / 2; m.y = m.py + Math.cos(a) * m.len - m.h / 2;
      } else if (m.kind === "h") {
        m.x += 1.6 * m.dir; if (m.x > m.x0 + m.range || m.x < m.x0) m.dir = -m.dir;
      } else if (m.kind === "v") {
        m.y -= 1.2 * m.dir; if (m.y < m.y0 - m.range || m.y > m.y0) m.dir = -m.dir;
      } else if (m.kind === "gargoyle") {
        const room = s.world.rooms[m.room];
        if (m.st === "wait") {
          const dx = p.x + p.w / 2 - (m.x + m.w / 2);
          if (p.room === m.room && Math.abs(dx) < 70 && p.y > m.y) { m.st = "shake"; m.t = 22; ev.push({ type: "gargoyle" }); }
        } else if (m.st === "shake") { if (--m.t <= 0) { m.st = "drop"; m.vy = 2; } }
        else if (m.st === "drop") {
          m.vy = Math.min(15, m.vy + 1.1); m.y += m.vy;
          const hitTile = boxSolid(s, room, { x: m.x + 4, y: m.y, w: m.w - 8, h: m.h });
          if (hitTile) { m.y = hitTile.y * TILE - m.h; m.st = "land"; m.t = 60; ev.push({ type: "slam", x: m.x + m.w / 2, y: m.y + m.h }); }
          if (m.y > room.h * TILE) { m.st = "land"; m.t = 60; }
        } else if (m.st === "land") { if (--m.t <= 0) m.st = "rise"; }
        else if (m.st === "rise") { m.y -= 2; if (m.y <= m.homeY) { m.y = m.homeY; m.st = "wait"; } }
        // the underside and the sides hurt while it moves; the top is always a ledge
        if (p.room === m.room && s.phase === "play" && (m.st === "drop" || m.st === "rise" || m.st === "land") &&
            overlap(p, { x: m.x + 4, y: m.y + 14, w: m.w - 8, h: m.h - 14 })) C.hurt(s, ev);
      }
      m.dx = m.x - ox; m.dy = m.y - oy;
    }
  }

  // ---------- foes ----------
  function walker(s, f, edgeTurn) {
    const room = s.world.rooms[f.room];
    f.vy = Math.min(MAXFALL, f.vy + GRAV);
    f.x += f.vx;
    const side = boxSolid(s, room, f);
    if (side) { f.x -= f.vx; f.vx = -f.vx; }
    const prevBottom = f.y + f.h;
    f.y += f.vy;
    const floor = boxSolid(s, room, f, prevBottom);
    f.on = false;
    if (floor && f.vy >= 0) { f.y = floor.y * TILE - f.h; f.vy = 0; f.on = true; }
    else if (floor && f.vy < 0) { f.y = (floor.y + 1) * TILE; f.vy = 0; }
    if (edgeTurn && f.on) {
      const ahead = f.vx > 0 ? f.x + f.w + 2 : f.x - 2;
      if (!solidity(s, room, Math.floor(ahead / TILE), Math.floor((f.y + f.h + 4) / TILE))) f.vx = -f.vx;
    }
    if (f.vx) f.face = Math.sign(f.vx);
    f.anim += Math.abs(f.vx);
    if (f.y > room.h * TILE + 60) f.gone = true;
  }

  function stepFoes(s, ev, C) {
    const p = s.p;
    for (const f of s.foes) {
      if (f.gone) continue;
      if (f.dead) { if (--f.dead <= 0) f.gone = true; continue; }
      const near = f.room === p.room && Math.abs(f.x - p.x) < 1500;
      if (!near && f.type !== "p") continue;             // foes wake as the camera nears them
      f.t++;
      switch (f.type) {
        case "s": walker(s, f, false); break;
        case "pumpkin": walker(s, f, false); if (f.on && f.vx === 0) f.vx = p.x < f.x ? -1.8 : 1.8; break;
        case "k":
          if (f.st === "walk") walker(s, f, true);
          else if (f.st === "stun") { walker(s, f, false); if (--f.stun <= 0) { f.st = "walk"; f.h = 56; f.y -= 22; f.vx = p.x < f.x ? -0.9 : 0.9; } }
          else if (f.st === "slide") {
            walker(s, f, false);
            for (const o of s.foes) {
              if (o === f || o.gone || o.dead || o.room !== f.room || o.type === "p" && o.st === "hide") continue;
              if (overlap(f, o)) { kill(s, o, ev, 200); }
            }
          }
          break;
        case "p": {
          const room = s.world.rooms[f.room];
          const close = f.room === p.room && Math.abs(p.x + p.w / 2 - (f.x + f.w / 2)) < 72;
          if (f.st === "hide") { if (--f.t <= 0 && !close) { f.st = "rise"; f.t = 30; } }
          else if (f.st === "rise") { f.rise = 1 - f.t / 30; if (--f.t <= 0) { f.st = "up"; f.t = 90; f.rise = 1; } }
          else if (f.st === "up") { if (--f.t <= 0) { f.st = "sink"; f.t = 30; } }
          else if (f.st === "sink") { f.rise = f.t / 30; if (--f.t <= 0) { f.st = "hide"; f.t = 80; f.rise = 0; } }
          f.y = f.baseY - f.h * f.rise;
          f.face = p.x < f.x ? -1 : 1;
          void room;
          break;
        }
        case "w": {
          f.x = f.hx - f.w / 2 + Math.sin(f.t * 0.02) * 40;
          f.y = f.hy - f.h + 24 + Math.sin(f.t * 0.06) * 10;
          f.face = p.x < f.x ? -1 : 1;
          if (near && Math.abs(p.x - f.x) < 520 && f.t % 110 === 60) {
            const dx = p.x - f.x;
            s.bolts.push({ kind: "potion", room: f.room, x: f.x + f.w / 2, y: f.y + 10, w: 16, h: 16, vx: Math.max(-6, Math.min(6, dx / 45)), vy: -9, grav: 0.35 });
            ev.push({ type: "throw" });
          }
          break;
        }
        case "c": {
          const tx = p.x + (p.vx >= 0 ? 160 : -160);
          f.x += Math.max(-3, Math.min(3, (tx - f.x) * 0.02));
          f.y = 3 * TILE + Math.sin(f.t * 0.04) * 12;
          f.face = p.x < f.x ? -1 : 1;
          if (--f.drop <= 0) {
            f.drop = 170;
            if (s.foes.filter(o => o.type === "pumpkin" && !o.gone).length < 3)
              s.foes.push(Object.assign(makeFoe("pumpkin", f.room, 0, 0), { x: f.x + 12, y: f.y + 30, vx: 0 }));
          }
          break;
        }
        case "b": {
          const dx = p.x - f.x, dy = p.y - f.y;
          const swoop = near && Math.abs(dx) < 260 && Math.abs(dy) < 260;
          f.x += swoop ? Math.sign(dx) * 1.6 : Math.sin(f.t * 0.02) * 1.4;
          f.y += swoop ? Math.sign(dy) * 1.1 : Math.sin(f.t * 0.05) * 1.2;
          f.face = Math.sign(dx) || 1;
          break;
        }
      }
    }
    s.foes = s.foes.filter(f => !f.gone);

    // fire bars
    for (const b of s.bars) b.a += b.spin;

    // enemy projectiles
    for (const q of s.bolts) {
      const room = s.world.rooms[q.room];
      if (q.kind === "wave") { q.x += q.vx; if (--q.life <= 0) q.dead = true; }
      else if (q.kind === "barrel") {
        q.vy = Math.min(MAXFALL, q.vy + GRAV); q.x += q.vx;
        const pb = q.y + q.h; q.y += q.vy;
        const fl = boxSolid(s, room, q, pb);
        if (fl && q.vy >= 0) { q.y = fl.y * TILE - q.h; q.vy = q.bounce ? -5 : 0; q.bounce = false; }
        if (boxSolid(s, room, { x: q.x, y: q.y - 2, w: q.w, h: q.h - 4 })) q.dead = true;
        q.spin = (q.spin || 0) + q.vx * 0.05;
      } else {
        q.vy += q.grav || 0; q.x += q.vx; q.y += q.vy;
        if (boxSolid(s, room, q)) { q.dead = true; ev.push({ type: "splash", x: q.x, y: q.y, kind: q.kind }); }
      }
      if (q.y > room.h * TILE + 40 || q.x < -100 || q.x > room.w * TILE + 100) q.dead = true;
    }
    s.bolts = s.bolts.filter(q => !q.dead);
  }

  function kill(s, f, ev, n) {
    f.dead = 30; f.vx = 0;
    ev.push({ type: "kill", foe: f.type, x: f.x + f.w / 2, y: f.y + f.h / 2 });
    ev.push({ type: "score", n: n || POINTS[f.type] || 100, x: f.x + f.w / 2, y: f.y });
  }

  /* The player's body against everything hostile in the room. Stomps are
     resolved first (falling, and the feet were above the foe's top last frame). */
  function playerVsFoes(s, ev, C) {
    const p = s.p;
    if (s.phase !== "play" || p.state !== "play") return;
    const prevBottom = p.y + p.h - p.vy;
    for (const f of s.foes) {
      if (f.gone || f.dead || f.room !== p.room) continue;
      if (f.type === "p" && f.rise < 0.35) continue;
      if (!overlap(p, f)) continue;
      if (p.encore > 0) { kill(s, f, ev); continue; }
      const stomp = p.vy > 0 && prevBottom <= f.y + 10 && f.type !== "p" && f.type !== "pumpkin";
      if (f.type === "k" && f.st === "stun") {
        if (stomp) { C.bounce(s); continue; }
        f.st = "slide"; f.vx = p.x + p.w / 2 < f.x + f.w / 2 ? 8 : -8; f.kickT = 12;
        ev.push({ type: "kick", x: f.x, y: f.y }, { type: "score", n: 100, x: f.x, y: f.y });
        continue;
      }
      if (stomp) {
        C.bounce(s);
        if (f.type === "k") {
          if (f.st === "slide") { f.st = "stun"; f.vx = 0; f.stun = 420; }
          else { f.st = "stun"; f.vx = 0; f.stun = 420; f.y += 22; f.h = 34; }
          ev.push({ type: "stomp", x: f.x + f.w / 2, y: f.y }, { type: "score", n: 100, x: f.x, y: f.y });
        } else kill(s, f, ev);
        continue;
      }
      if (f.type === "k" && f.st === "slide" && f.kickT > 0) { f.kickT--; continue; }
      C.hurt(s, ev);
    }
    for (const m of s.movers) { /* gargoyles hurt in stepMovers */ }
    for (const b of s.bars) {
      if (b.room !== p.room) continue;
      for (let i = 0; i < b.n; i++) {
        const r = 14 + i * 22, fx = b.cx + Math.cos(b.a) * r, fy = b.cy + Math.sin(b.a) * r;
        if (fx > p.x - 8 && fx < p.x + p.w + 8 && fy > p.y - 8 && fy < p.y + p.h + 8) { if (p.encore <= 0) C.hurt(s, ev); break; }
      }
    }
    for (const q of s.bolts) {
      if (q.room !== p.room || q.dead) continue;
      if (q.kind === "wave") { if (p.on && overlap(p, q)) C.hurt(s, ev); continue; }
      if (overlap(p, q)) { if (q.kind !== "barrel") q.dead = true; if (p.encore <= 0) C.hurt(s, ev); }
    }
  }

  /* A note against foes. Returns true when the note is spent. */
  function noteVsFoes(s, n, ev) {
    for (const f of s.foes) {
      if (f.gone || f.dead || f.room !== n.room) continue;
      if (f.type === "p" && f.rise < 0.35) continue;
      if (!overlap(n, f)) continue;
      if (n.whistle) return true;                          // a whistle only blasts ghosts
      if (f.type === "w" && --f.hp > 0) { ev.push({ type: "impact", x: n.x, y: n.y }); return true; }
      kill(s, f, ev);
      return true;
    }
    for (const m of s.movers) if (m.kind === "gargoyle" && m.room === n.room && overlap(n, m)) { ev.push({ type: "clang", x: n.x, y: n.y }); return true; }
    for (const q of s.bolts) if (q.room === n.room && q.kind === "potion" && overlap(n, q)) { q.dead = true; ev.push({ type: "impact", x: n.x, y: n.y }); return true; }
    return false;
  }

  // ============================================================ BOSSES
  function createBoss(s) {
    const b = s.world.boss, def = s.level.boss;
    if (!b || !def) return null;
    const room = s.world.rooms[b.room];
    const arena = { room: b.room, left: (b.x - 22) * TILE, right: Math.min(room.w, b.x + 7) * TILE };
    if (def.type === "gatekeeper")
      return { type: "gatekeeper", name: def.name, room: b.room, arena, w: 70, h: 130, x: b.x * TILE, y: (b.y + 1) * TILE - 130,
        vx: 0, vy: 0, hp: 12, maxHp: 12, st: "sleep", t: 0, face: -1, flash: 0, anim: 0 };
    return { type: "plumbmonkey", name: def.name, room: b.room, arena, w: 76, h: 110, x: b.x * TILE, y: (b.y + 1) * TILE - 110,
      homeX: b.x * TILE, hp: 10, maxHp: 10, stage: 1, stages: 3, st: "sleep", t: 0, face: -1, flash: 0, anim: 0, pedestal: null, jam: null };
  }

  function bossActive(b) { return b && b.st !== "sleep" && b.st !== "gone"; }

  function stepBoss(s, ev, C, input) {
    const b = s.boss, p = s.p;
    if (!b || b.st === "gone") return;
    b.anim++;
    if (b.flash > 0) b.flash--;
    if (b.st === "sleep") {
      if (p.room === b.room && p.x > b.arena.left + 3 * TILE) { b.st = "wake"; b.t = 120; s.arena = b.arena; ev.push({ type: "bossWake" }); }
      return;
    }
    if (b.st === "dying") { if (b.t % 12 === 0) ev.push({ type: "boom", x: b.x + C.rnd(s) * b.w, y: b.y + C.rnd(s) * b.h }); if (--b.t <= 0) { b.st = "gone"; s.arena = null; ev.push({ type: "bossGone", boss: b.type }); } return; }
    if (b.type === "gatekeeper") gatekeeper(s, b, ev, C);
    else plumbmonkey(s, b, ev, C, input);
  }

  function landBoss(s, b) {
    const room = s.world.rooms[b.room];
    b.vy = Math.min(16, b.vy + GRAV);
    b.x += b.vx;
    if (b.x < b.arena.left + TILE) { b.x = b.arena.left + TILE; b.vx = 0; }
    if (b.x + b.w > b.arena.right - TILE) { b.x = b.arena.right - TILE - b.w; b.vx = 0; }
    const pb = b.y + b.h; b.y += b.vy;
    const fl = boxSolid(s, room, { x: b.x + 6, y: b.y, w: b.w - 12, h: b.h }, pb);
    if (fl && b.vy >= 0) { b.y = fl.y * TILE - b.h; b.vy = 0; return true; }
    return false;
  }

  function shockwaves(s, b, speed) {
    const y = b.y + b.h - 30;
    for (const d of [-1, 1]) s.bolts.push({ kind: "wave", room: b.room, x: b.x + b.w / 2 - 20 + d * 30, y, w: 40, h: 30, vx: d * speed, vy: 0, life: 150 });
  }

  function gatekeeper(s, b, ev, C) {
    const p = s.p, enraged = b.hp <= b.maxHp / 2;
    b.face = p.x < b.x ? -1 : 1;
    b.t--;
    switch (b.st) {
      case "wake": if (b.t <= 0) { b.st = "walk"; b.t = 90; } break;
      case "walk":
        b.vx = b.face * (enraged ? 2.0 : 1.4); b.anim += 1;
        landBoss(s, b);
        if (b.t <= 0) { b.st = "crouch"; b.t = enraged ? 30 : 42; b.vx = 0; ev.push({ type: "warning" }); }
        break;
      case "crouch":
        landBoss(s, b);
        if (b.t <= 0) {
          b.st = "leap"; const air = 44;
          b.vx = Math.max(-7, Math.min(7, (p.x - b.x) / air)); b.vy = -13; ev.push({ type: "leap" });
        }
        break;
      case "leap":
        if (landBoss(s, b) && b.vy === 0) {
          b.st = "dazed"; b.t = enraged ? 55 : 75; b.vx = 0;
          shockwaves(s, b, enraged ? 7 : 5.5); ev.push({ type: "slam", x: b.x + b.w / 2, y: b.y + b.h });
        }
        break;
      case "dazed":
        landBoss(s, b);
        if (b.t <= 0) { b.st = "walk"; b.t = enraged ? 70 : 100; }
        break;
    }
  }

  const JAM_BEATS = [4, 4, 6], JAM_NEED = [3, 3, 5], JAM_GAP = 42, JAM_WINDOW = 10;

  function plumbmonkey(s, b, ev, C, input) {
    const p = s.p;
    b.face = p.x < b.x ? -1 : 1;
    const minions = () => s.foes.filter(f => f.boss && !f.gone && !f.dead).length;
    b.t--;
    switch (b.st) {
      case "wake": if (b.t <= 0) { b.st = "idle"; b.t = 50; } break;
      case "idle":
        if (b.t <= 0) {
          const pick = (b.next = ((b.next || 0) + 1) % 3);
          if (pick === 0) { b.st = "throw"; b.t = 50; b.throws = b.stage >= 2 ? 2 : 1; }
          else if (pick === 1 && minions() < 3) { b.st = "command"; b.t = 40; }
          else { b.st = "stomp"; b.t = 34; }
          ev.push({ type: "warning" });
        }
        break;
      case "throw":
        if (b.t === 0) {
          s.bolts.push({ kind: "barrel", room: b.room, x: b.x + (b.face < 0 ? -10 : b.w - 20), y: b.y + 10, w: 34, h: 34,
            vx: b.face * (4 + b.stage * 0.6), vy: -6, bounce: true, grav: GRAV });
          ev.push({ type: "throw" });
          if (--b.throws > 0) { b.t = 34; break; }
          b.st = "taunt"; b.t = 80;
        }
        break;
      case "command":
        if (b.t === 0) {
          const kinds = b.stage === 1 ? ["s", "s"] : b.stage === 2 ? ["s", "b"] : ["k", "b"];
          kinds.forEach((k, i) => {
            const x = Math.max(b.arena.left + 2 * TILE, Math.min(b.arena.right - 3 * TILE, p.x + (i ? 180 : -180)));
            const f = makeFoe(k, b.room, Math.floor(x / TILE), 3, { boss: true });
            if (k === "s") f.vx = p.x < x ? -1.3 : 1.3;
            if (k === "k") f.vx = p.x < x ? -1 : 1;
            s.foes.push(f);
          });
          ev.push({ type: "command" });
          b.st = "taunt"; b.t = 70;
        }
        break;
      case "stomp":
        if (b.t === 0) { shockwaves(s, b, 5 + b.stage); ev.push({ type: "slam", x: b.x + b.w / 2, y: b.y + b.h }); b.st = "taunt"; b.t = 80; }
        break;
      case "taunt":
        if (b.t <= 0) { b.st = "idle"; b.t = Math.max(24, 60 - b.stage * 12); }
        break;
      case "dizzy":
        if (b.t <= 0 && !b.jam) { b.st = "recover"; b.t = 40; b.pedestal = null; b.hp = Math.ceil(b.maxHp / 2); ev.push({ type: "recover" }); }
        break;
      case "recover": if (b.t <= 0) { b.st = "idle"; b.t = 40; } break;
      case "chord":
        if (b.t === 30) { b.flash = 20; ev.push({ type: "powerChord", x: b.x + b.w / 2, y: b.y + b.h / 2 }); }
        if (b.t <= 0) {
          b.stage++; b.pedestal = null; b.jam = null; p.state = "play";
          if (b.stage > b.stages) { b.st = "defeat"; b.t = 180; ev.push({ type: "bossDefeat" }); }
          else { b.hp = b.maxHp; b.st = "hit"; b.t = 60; ev.push({ type: "stageDown", stage: b.stage }); }
        }
        break;
      case "hit": if (b.t <= 0) { b.st = "idle"; b.t = 40; } break;
      case "defeat":
        if (b.t <= 0) { b.st = "gone"; s.arena = null; ev.push({ type: "bossGone", boss: b.type }); }
        break;
    }
    // stepping onto the lit pedestal starts the jam
    if (b.st === "dizzy" && b.pedestal && !b.jam && p.state === "play" && overlap(p, b.pedestal)) {
      const i = b.stage - 1;
      b.jam = { beats: JAM_BEATS[i], need: JAM_NEED[i], hit: 0, done: 0, t: 0, marks: [] };
      p.state = "jam"; p.vx = 0; p.face = b.x > p.x ? 1 : -1;
      s.foes.forEach(f => { if (f.boss) f.gone = true; });
      s.bolts = [];
      ev.push({ type: "jamStart" });
    }
    if (b.jam) stepJam(s, b, ev, input);
  }

  /* THE JAM. Beats arrive every JAM_GAP frames; press FIRE within JAM_WINDOW
     frames of a beat to land it. Hit enough and the Spaceman throws the power
     chord; miss and Plumbmonkey shakes it off. */
  function stepJam(s, b, ev, input) {
    const j = b.jam;
    if (j.result) return;
    j.t++;
    const first = 60;
    const beatT = k => first + k * JAM_GAP;
    if (input.fire) {
      let k = -1;
      for (let i = j.done; i < j.beats; i++) if (Math.abs(j.t - beatT(i)) <= JAM_WINDOW) { k = i; break; }
      if (k >= 0 && !j.marks[k]) { j.marks[k] = "hit"; j.hit++; j.done = k + 1; ev.push({ type: "strum", good: true }); }
      else ev.push({ type: "strum", good: false });
    }
    for (let i = j.done; i < j.beats; i++) if (j.t > beatT(i) + JAM_WINDOW && !j.marks[i]) { j.marks[i] = "miss"; j.done = i + 1; ev.push({ type: "jamMiss" }); }
    if (j.t > beatT(j.beats - 1) + JAM_WINDOW + 20) {
      if (j.hit >= j.need) { j.result = "win"; b.st = "chord"; b.t = 70; s.p.state = "chord"; ev.push({ type: "jamWin" }); }
      else { b.jam = null; b.pedestal = null; s.p.state = "play"; b.st = "recover"; b.t = 50; b.hp = Math.ceil(b.maxHp / 2); ev.push({ type: "jamFail" }); }
    }
  }

  /* A note or a stomp reaching a boss. Returns true if the note is spent. */
  function damageBoss(s, n, ev, amount) {
    const b = s.boss;
    if (b.type === "gatekeeper") {
      if (b.st === "crouch" || b.st === "leap") { ev.push({ type: "clang", x: n.x, y: n.y }); return true; }
      b.hp -= amount; b.flash = 8; ev.push({ type: "bossHit", x: n.x, y: n.y });
      if (b.hp <= 0) { b.st = "dying"; b.t = 90; s.bolts = []; ev.push({ type: "bossDown" }, { type: "score", n: 5000, x: b.x + b.w / 2, y: b.y }); }
      return true;
    }
    if (b.st !== "taunt" && b.st !== "throw" && b.st !== "command") {
      if (b.st === "dizzy" || b.st === "chord" || b.st === "defeat") return false;
      ev.push({ type: "clang", x: n.x, y: n.y }); return true;
    }
    if (b.st !== "taunt") { ev.push({ type: "clang", x: n.x, y: n.y }); return true; }
    b.hp -= amount; b.flash = 8; ev.push({ type: "bossHit", x: n.x, y: n.y });
    if (b.hp <= 0) {
      b.hp = 0; b.st = "dizzy"; b.t = 600;
      b.pedestal = { x: b.arena.left + 4 * TILE, y: b.y + b.h - 60, w: 48, h: 60 };   // stands on the boss's own floor
      s.foes.forEach(f => { if (f.boss) { f.dead = 20; } });
      s.bolts = [];
      ev.push({ type: "dizzy" });
    }
    return true;
  }
  function noteVsBoss(s, n, ev) {
    const b = s.boss;
    if (!bossActive(b) || b.st === "dying" || b.st === "wake" || n.room !== b.room || !overlap(n, b)) return false;
    if (n.whistle) return true;
    return damageBoss(s, n, ev, 1);
  }
  function playerVsBoss(s, ev, C) {
    const b = s.boss, p = s.p;
    if (!bossActive(b) || b.st === "dying" || b.st === "defeat" || b.st === "gone" || p.room !== b.room || p.state !== "play") return;
    if (b.st === "dizzy" || b.st === "chord") return;
    if (!overlap(p, b)) return;
    const prevBottom = p.y + p.h - p.vy;
    if (p.vy > 0 && prevBottom <= b.y + 16) {
      C.bounce(s); p.vy = -11;
      damageBoss(s, { x: p.x + p.w / 2, y: p.y + p.h }, ev, 2);
      return;
    }
    C.hurt(s, ev);
    p.vx = b.x > p.x ? -6 : 6;
  }

  const exports = { spawnFoes, placeMovers, stepMovers, stepFoes, playerVsFoes, noteVsFoes, kill, makeFoe,
    createBoss, stepBoss, noteVsBoss, playerVsBoss, bossActive, POINTS, JAM_GAP, JAM_WINDOW, JAM_BEATS, JAM_NEED };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  else root.GraveyardFoes = exports;
})(typeof window !== "undefined" ? window : globalThis);
