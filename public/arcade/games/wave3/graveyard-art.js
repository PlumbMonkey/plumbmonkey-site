/* Graveyard Shift — RENDERING + HOST GLUE.

   Draws the rules state from graveyard.js with the painters in
   graveyard-paint.js, the Hero Kit (Spaceman, Plumbmonkey) and the shared
   monster kit, and turns rule events into sound, particles, toasts and score.
   The host (wave3.js) still owns score, lives, the HUD bar, music, pause and
   the leaderboard flow. Sets GraveyardGame.create. */
(function (root) {
  "use strict";
  const G = root.GraveyardGame, PT = root.GraveyardPaint;
  const WD = G.World, F = G.Foes, TILE = G.TILE;

  function create(api) {
    const c = api.ctx, { H, PAD, VIEW_W } = api;
    const K = root.HeroKit, SK = root.SpriteKit;
    let s = null, acc = 0, shake = 0, flash = 0, popups = [], strumT = 0;
    const cache = {};

    // ---------- caches ----------
    function canvas(key, w, h, paint) {
      if (cache[key]) return cache[key];
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      paint(cv.getContext("2d"));
      return (cache[key] = cv);
    }
    const themeName = room => room.other ? "other" : s.level.theme;
    const sky = n => canvas("sky:" + n, VIEW_W, H, g => PT.paintSky(g, PT.THEMES[n], VIEW_W, H, n));
    const far = n => canvas("far:" + n, VIEW_W, H, g => PT.paintFar(g, PT.THEMES[n], n, VIEW_W, H));
    const mid = n => canvas("mid:" + n, VIEW_W, H, g => PT.paintMid(g, PT.THEMES[n], n, VIEW_W, H));
    function tile(n, ch, v, edge, frame) {
      return canvas(`t:${n}:${ch}:${v}:${edge ? 1 : 0}:${frame}`, TILE + 12, TILE + 12, g => { g.translate(6, 6); g.lineJoin = "round"; g.lineCap = "round"; PT.paintTile(g, PT.THEMES[n], ch, v, edge, frame); });
    }
    function sprite(key, w, h, ox, oy, paint) {
      const cv = canvas(key, w, h, g => { g.translate(ox, oy); g.lineJoin = "round"; g.lineCap = "round"; paint(g); });
      cv.ox = ox; cv.oy = oy; return cv;
    }
    function blit(cv, x, y, face = 1) {
      if (face < 0) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(cv, -cv.ox, -cv.oy); c.restore(); }
      else c.drawImage(cv, x - cv.ox, y - cv.oy);
    }

    // ---------- glue ----------
    function reset() { s = G.createState(api.level()); acc = 0; popups = []; }
    function next() { s = G.createState(api.level(), { notes: s ? s.notes : 0, tier: s ? s.p.tier : 1 }); popups = []; }
    function respawn() { s = G.respawn(s); popups = []; }
    const scr = (x, y) => [x - s.cam.x, y - s.cam.y];
    function burst(x, y, color, n) { const [sx, sy] = scr(x, y); api.burst(sx, sy, color, n); }
    const SCALE = [523.25, 587.33, 659.25, 783.99, 880];

    function handle(events) {
      for (const e of events) {
        switch (e.type) {
          case "score": api.score(e.n); if (e.n >= 100) popups.push({ x: e.x, y: e.y, text: e.n.toLocaleString(), life: 45 }); break;
          case "note": api.beep(1318 + (s.notes % 3) * 120, 0.05, "triangle", 0.02); break;
          case "extraLife": api.addLife(); api.toast("100 SOUL NOTES — EXTRA LIFE"); api.chord([523, 659, 784, 1047]); break;
          case "jump": api.sweep(240, 520, 0.1, "triangle", 0.03); break;
          case "shoot": api.beep(SCALE[(s.t >> 1) % 5], 0.09, "triangle", 0.035); api.beep(SCALE[(s.t >> 1) % 5] * 1.5, 0.06, "sine", 0.015); break;
          case "whistle": api.sweep(1500, 1900, 0.06, "sine", 0.02); break;
          case "vapour": burst(e.x, e.y, "#e9d5ff", 12); api.sweep(900, 300, 0.18, "sine", 0.03); break;
          case "reform": api.sweep(200, 420, 0.12, "sine", 0.012); break;
          case "bonk": api.beep(140, 0.05, "square", 0.03); break;
          case "box": api.beep(660, 0.06, "square", 0.03); break;
          case "sprout": api.sweep(330, 990, 0.3, "triangle", 0.03); break;
          case "power":
            api.chord(e.kind === "encore" ? [784, 988, 1175, 1568] : [523, 659, 784]);
            api.toast({ amp: "AMP — YOU CAN TAKE A HIT", guitar: "GUITAR — SONIC FIRES NOTES", encore: "ENCORE! UNSTOPPABLE" }[e.kind]);
            break;
          case "shrink": api.sweep(600, 150, 0.35, "square", 0.05); api.toast(e.tier === 2 ? "GUITAR LOST" : "AMP LOST"); break;
          case "die": api.sweep(500, 60, 0.7, "sawtooth", 0.07); shake = 8; break;
          case "kill": burst(e.x, e.y, "#f0abfc", 14); api.sweep(300, 80, 0.15, "square", 0.045); break;
          case "stomp": burst(e.x, e.y, "#e2e8f0", 8); api.beep(220, 0.08, "square", 0.04); break;
          case "kick": api.sweep(180, 700, 0.12, "square", 0.04); break;
          case "impact": case "fizzle": burst(e.x, e.y, "#fde68a", 4); break;
          case "clang": burst(e.x, e.y, "#cbd5e1", 5); api.beep(1400, 0.04, "triangle", 0.025); break;
          case "checkpoint": api.chord([440, 554, 659]); api.toast("CHECKPOINT LANTERN LIT"); break;
          case "warp": api.sweep(e.kind === "portal" ? 300 : 700, e.kind === "portal" ? 1200 : 120, 0.4, "sine", 0.04); break;
          case "lantern": api.sweep(300, 900, 0.5, "triangle", 0.03); break;
          case "flare": flash = 12; shake = Math.max(shake, 5); burst(e.x, e.y, "#ffd27a", 36); burst(e.x, e.y, "#fff1c9", 18); api.chord([392, 523, 659, 784, 1047]); api.toast(`GREAT LANTERN LIT · ${e.n.toLocaleString()}`); break;
          case "hurry": api.toast("HURRY! THE LANTERNS ARE DIMMING"); api.sweep(880, 440, 0.3, "square", 0.04); break;
          case "door": api.chord([392, 494, 587, 784]); break;
          case "gargoyle": api.beep(90, 0.2, "sawtooth", 0.03); break;
          case "slam": shake = Math.max(shake, 9); api.sweep(120, 40, 0.3, "sawtooth", 0.07); break;
          case "throw": api.sweep(260, 520, 0.12, "triangle", 0.03); break;
          case "splash": burst(e.x, e.y, e.kind === "potion" ? "#86efac" : "#fdba74", 8); break;
          case "bossWake": api.toast(s.boss.name); api.sweep(80, 240, 0.6, "sawtooth", 0.06); break;
          case "warning": api.beep(210, 0.14, "triangle", 0.035); break;
          case "command": api.toast("PLUMBMONKEY CALLS HIS MONSTERS"); api.sweep(150, 90, 0.4, "square", 0.05); break;
          case "bossHit": burst(e.x, e.y, "#fde68a", 6); api.beep(260, 0.05, "square", 0.035); break;
          case "bossDown": api.toast(`${s.boss.name} DEFEATED — THE DOOR IS OPEN`); api.chord([392, 523, 659, 784]); shake = 14; break;
          case "boom": burst(e.x, e.y, "#fb923c", 16); api.beep(80, 0.18, "sawtooth", 0.05); break;
          case "dizzy": api.toast("HE'S DIZZY — GRAB THE LEGENDARY GUITAR!"); api.chord([659, 784, 988]); break;
          case "recover": api.toast("PLUMBMONKEY SHOOK IT OFF"); break;
          case "jamStart": api.toast("PLAY ON THE BEAT — PRESS SONIC"); strumT = 0; break;
          case "strum": if (e.good) { api.chord([196, 247, 294], 0.22, 0.05); strumT = 14; } else api.beep(110, 0.08, "square", 0.03); break;
          case "jamMiss": api.beep(98, 0.12, "sawtooth", 0.03); break;
          case "jamWin": api.toast("POWER CHORD!"); break;
          case "jamFail": api.toast("OUT OF TIME — STUN HIM AGAIN"); api.sweep(400, 90, 0.4, "sawtooth", 0.05); break;
          case "powerChord": flash = 18; shake = 16; burst(e.x, e.y, "#f0abfc", 40); burst(e.x, e.y, "#fde047", 24); [98, 147, 196].forEach(f => api.sweep(f * 2, f, 0.9, "sawtooth", 0.05)); break;
          case "stageDown": api.toast(e.stage === 3 ? "ONE MORE CHORD!" : "HE'S ROCKED — KEEP GOING"); break;
          case "bossDefeat": api.chord([392, 523, 659, 784, 1047]); break;
          case "victory": api.toast("THE MUSIC ROOM IS YOURS"); break;
          case "lose": case "gameover": api.lose(); return;
          case "next": api.next(); return;
          case "win": api.end(true); return;
        }
      }
    }

    function update(dt) {
      if (!s) reset();
      acc += Math.min(dt, 0.1);
      let jump = api.tap("Space", "ArrowUp", "KeyW"), fire = api.tap("KeyX", "ControlLeft", "ControlRight"), down = api.tap("ArrowDown", "KeyS");
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        const input = { move: (api.down("ArrowRight", "KeyD") ? 1 : 0) - (api.down("ArrowLeft", "KeyA") ? 1 : 0),
          jump, jumpHeld: api.down("Space", "ArrowUp", "KeyW"), fire, down, lives: api.lives() };
        if (api.attract) Object.assign(input, G.autopilot(s, { horizon: 40, every: 8 }), { lives: 3 });
        jump = fire = down = false;
        const st = s;
        handle(G.step(s, input));
        popups.forEach(q => { q.y -= 0.8; q.life--; });
        popups = popups.filter(q => q.life > 0);
        if (strumT > 0) strumT--;
        if (s !== st) break;
      }
      if (shake > 0) shake *= 0.86;
      if (flash > 0) flash--;
    }

    // ---------- world drawing ----------
    function drawBackdrop(room) {
      const n = themeName(room), cx = s.cam.x, cy = s.cam.y, tall = room.h > 15;
      c.drawImage(sky(n), -PAD, 0);
      [[far(n), 0.15], [mid(n), 0.4]].forEach(([cv, k]) => {
        const ox = -PAD - ((cx * k) % VIEW_W + VIEW_W) % VIEW_W;
        const oy = tall ? -(((cy * k) % H + H) % H) : 0;
        for (let dy = 0; dy <= (tall ? 1 : 0); dy++) { c.drawImage(cv, ox, oy + dy * H); c.drawImage(cv, ox + VIEW_W, oy + dy * H); }
      });
    }

    function drawTiles(room) {
      const n = themeName(room), cx = s.cam.x, cy = s.cam.y;
      const x0 = Math.max(0, Math.floor((cx - PAD) / TILE) - 1), x1 = Math.min(room.w - 1, Math.ceil((cx - PAD + VIEW_W) / TILE));
      const y0 = Math.max(0, Math.floor(cy / TILE) - 1), y1 = Math.min(room.h - 1, Math.ceil((cy + H) / TILE));
      const frame4 = (s.t >> 5) % 4, frame2 = (s.t >> 5) % 2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * room.w + x, ch = room.grid[i];
        if (ch === "." || ch === "C" || ch === "E" || ch === "D") continue;
        const px = x * TILE - 6, py = y * TILE - 6;
        if (ch === "o") {
          const bob = Math.sin(s.t * 0.08 + x) * 3;
          c.save(); c.shadowColor = "#fde68a"; c.shadowBlur = 10; PT.note(c, x * TILE + 24, y * TILE + 24 + bob, 1.3, "#fde047"); c.restore();
          continue;
        }
        if (ch === "G") {
          const gh = room.ghost[i];
          if (!gh) { c.drawImage(tile(n, "G", 0, false, frame2), px, py); continue; }
          const k = 1 - gh.t / WD.REFORM, cxp = x * TILE + 24, cyp = y * TILE + 24;
          const wg = c.createRadialGradient(cxp, cyp, 1, cxp, cyp, 6 + 18 * k);
          wg.addColorStop(0, `rgba(233,213,255,${0.25 + 0.35 * k})`); wg.addColorStop(1, "rgba(233,213,255,0)");
          c.fillStyle = wg; c.fillRect(cxp - 24, cyp - 24, 48, 48);
          if (gh.st === "flicker" && (s.t >> 2) % 2) { c.globalAlpha = 0.4; c.drawImage(tile(n, "G", 0, false, 0), px, py); c.globalAlpha = 1; }
          continue;
        }
        if (ch === "L") { c.drawImage(tile(n, "L", 0, false, WD.solidity(s, room, x, y) ? 1 : 0), px, py); continue; }
        if (ch === "=") {
          const cr = room.crumble[i];
          if (cr && cr.gone) continue;
          const j = cr ? (Math.sin(s.t * 1.7 + x) * 2) : 0;
          c.drawImage(tile(n, "=", 0, false, 0), px + j, py);
          continue;
        }
        const above = y > 0 ? room.grid[i - room.w] : ".";
        const edge = !(above === "#" || above === "g");
        const v = ch === "#" || ch === "B" ? (x * 7 + y * 13) % 8 : 0;
        c.drawImage(tile(n, ch, v, edge, "?!$*".includes(ch) ? frame4 : 0), px, py);
      }
    }

    function drawObjects(room) {
      const name = room.name;
      for (const lt of s.lanterns) if (lt.room === name) {
        const lit = s.checkpoint && s.checkpoint.room === name && s.checkpoint.x === lt.x && s.checkpoint.y === lt.y;
        blit(sprite("lantern" + (lit ? 1 : 0), 130, 130, 65, 95, g => PT.paintLantern(g, lit)), lt.x * TILE + 24, (lt.y + 1) * TILE - 6);
      }
      for (const d of s.doors) if (d.room === name) {
        const open = !s.boss || s.boss.st === "gone";
        blit(sprite("door" + (open ? 1 : 0), 80, 100, 40, 94, g => PT.paintDoor(g, open)), d.x * TILE + 24, (d.y + 1) * TILE);
      }
      for (const L of s.exitLanterns) if (L.room === name) {
        const f = s.finish && s.finish.kind === "lantern" && s.finish.lantern.x === L.x && s.finish.lantern.room === L.room ? s.finish : null;
        const lit = f && f.t >= G.LIGHT ? 1 + ((s.t >> 4) % 2) : 0;
        blit(sprite("great" + lit, 260, 300, 130, 290, g => PT.paintGreatLantern(g, lit)), L.x, L.bottom);
        if (f) {
          const lampY = L.bottom - 142, k = Math.min(1, f.t / G.LIGHT);
          if (k < 1) {   // a spark carried from the Spaceman's hand up into the wick
            const hx = s.p.x + s.p.w, hy = s.p.y + 26, x = hx + (L.x - hx) * k, y = hy + (lampY - hy) * k - Math.sin(k * Math.PI) * 50;
            const sg = c.createRadialGradient(x, y, 1, x, y, 22);
            sg.addColorStop(0, "rgba(255,241,201,1)"); sg.addColorStop(0.35, "rgba(255,179,71,0.7)"); sg.addColorStop(1, "rgba(255,179,71,0)");
            c.fillStyle = sg; c.fillRect(x - 22, y - 22, 44, 44);
          } else {       // the flare: a bloom that swells past the lantern, then settles into its halo
            const bloom = Math.max(0, 1 - (f.t - G.LIGHT) / 60), r = 90 + bloom * 220;
            const bg = c.createRadialGradient(L.x, lampY, 4, L.x, lampY, r);
            bg.addColorStop(0, `rgba(255,241,201,${0.25 + bloom * 0.6})`); bg.addColorStop(0.4, `rgba(255,190,90,${0.12 + bloom * 0.3})`); bg.addColorStop(1, "rgba(255,190,90,0)");
            c.fillStyle = bg; c.fillRect(L.x - r, lampY - r, r * 2, r * 2);
          }
        }
      }
      for (const n in s.world.links) for (const end of s.world.links[n]) {
        if (end.room !== name || end.solid) continue;
        const kind = (s.level.links[n] || {}).kind;
        c.save(); c.translate(end.x * TILE + 24, (end.y + 1) * TILE);
        if (kind === "portal") { c.translate(0, -24); PT.paintPortal(c, s.t, room.other); } else PT.paintTombDoor(c);
        c.restore();
      }
      for (const m of s.movers) {
        if (m.room !== name) continue;
        if (m.kind === "chandelier") {
          const cxm = m.x + m.w / 2;
          c.strokeStyle = "#1a1422"; c.lineWidth = 3; c.beginPath(); c.moveTo(m.px, m.py); c.lineTo(cxm, m.y); c.stroke();
          c.save(); c.translate(cxm, m.y + 6); PT.paintChandelier(c, s.t >> 4); c.restore();
        } else if (m.kind === "gargoyle") {
          c.save(); c.translate(m.x + m.w / 2 + (m.st === "shake" ? Math.sin(s.t * 2) * 2 : 0), m.y); PT.paintGargoyle(c, m.st !== "wait"); c.restore();
        } else blit(sprite("plat" + m.w, m.w + 8, 24, 4, 4, g => PT.paintPlatform(g, m.w)), m.x, m.y);
      }
      for (const b of s.bars) if (b.room === name) {
        for (let i = 0; i < b.n; i++) {
          const r = 14 + i * 22, fx = b.cx + Math.cos(b.a) * r, fy = b.cy + Math.sin(b.a) * r;
          const fg = c.createRadialGradient(fx, fy, 1, fx, fy, 14);
          fg.addColorStop(0, "#fff7d6"); fg.addColorStop(0.35, "#ffb347"); fg.addColorStop(1, "rgba(255,90,40,0)");
          c.fillStyle = fg; c.fillRect(fx - 14, fy - 14, 28, 28);
        }
      }
    }

    function drawFoes(room) {
      for (const f of s.foes) {
        if (f.room !== room.name) continue;
        const cx = f.x + f.w / 2, feet = f.y + f.h, fr = Math.floor(f.anim / 8) % 4;
        c.save();
        if (f.dead) { c.globalAlpha = Math.min(1, f.dead / 20); }
        switch (f.type) {
          case "s":
            if (f.dead) blit(sprite("skullSq", 50, 30, 25, 26, g => PT.paintSkull(g, 0, true)), cx, feet);
            else blit(sprite("skull" + fr, 50, 50, 25, 46, g => PT.paintSkull(g, fr)), cx, feet, -f.face);
            break;
          case "k":
            if (f.st === "walk" && !f.dead) {
              c.translate(cx, feet - 20); c.scale(f.face < 0 ? -1 : 1, 1);
              SK.draw(c, "frank", 0, 0, { t: s.t / 60, scale: 0.72, stomp: Math.sin(f.anim * 0.12) });
              c.fillStyle = "#6f7686"; c.strokeStyle = PT.INK; c.lineWidth = 2;
              c.beginPath(); c.roundRect ? c.roundRect(-19, -20, 38, 12, 4) : c.rect(-19, -20, 38, 12); c.fill(); c.stroke();
            } else { c.translate(cx, feet); if (f.st === "slide") c.rotate(Math.sin(s.t * 0.9) * 0.1); PT.paintArmourShell(c, s.t >> 5); }
            break;
          case "p":
            if (f.rise > 0.02) {
              c.beginPath(); c.rect(f.x - 30, f.baseY - 80, f.w + 60, 80); c.clip();
              c.translate(cx, f.baseY + (1 - f.rise) * 48); c.scale(f.face, 1);
              PT.paintFlower(c, (s.t >> 6) % 2);
            }
            break;
          case "w":
            c.translate(cx, f.y + f.h * 0.6); c.scale(f.face < 0 ? 1 : -1, 1);
            SK.draw(c, "witch", 0, 0, { t: s.t / 60, scale: 0.72 });
            break;
          case "c":
            c.translate(cx, f.y + 24);
            SK.draw(c, "ghost", 0, -18, { t: s.t / 60, scale: 0.5 });
            PT.paintCloud(c, s.t >> 6);
            break;
          case "b": blit(sprite("bat" + ((s.t >> 3) % 2), 60, 40, 30, 20, g => PT.paintBat(g, (s.t >> 3) % 2)), cx, f.y + f.h / 2, f.face); break;
          case "pumpkin": c.translate(cx, f.y + f.h / 2); PT.paintPumpkin(c, f.anim * 0.05); break;
        }
        c.restore();
      }
    }

    function drawBoss(room) {
      const b = s.boss;
      if (!b || b.room !== room.name || b.st === "gone") return;
      if (b.st === "dying" && (b.t >> 2) % 2) return;
      c.save();
      if (b.flash % 2) c.globalAlpha = 0.6;
      const cx = b.x + b.w / 2, feet = b.y + b.h;
      if (b.type === "gatekeeper") {
        if (b.st === "crouch" || b.st === "dazed") { const glowR = b.st === "crouch" ? 0.35 : 0.15, gg = c.createRadialGradient(cx, feet - 60, 10, cx, feet - 60, 120); gg.addColorStop(0, `rgba(251,146,60,${glowR})`); gg.addColorStop(1, "rgba(251,146,60,0)"); c.fillStyle = gg; c.fillRect(cx - 120, feet - 180, 240, 240); }
        c.translate(cx, feet - 47);
        c.scale(b.face < 0 ? -1.8 : 1.8, b.st === "crouch" ? 1.55 : b.st === "leap" ? 1.95 : 1.8);
        SK.draw(c, "frank", 0, 0, { t: s.t / 60, stomp: b.st === "walk" ? Math.sin(b.anim * 0.1) : 0 });
        c.fillStyle = "#2b2a36"; c.fillRect(-18, -60, 36, 12);                                    // doorman's cap
        c.fillStyle = "#c9a24a"; c.fillRect(-18, -50, 36, 3);
        c.restore();
        if (b.st === "dazed") for (let i = 0; i < 3; i++) { const a = s.t * 0.12 + i * 2.1; PT.note(c, cx + Math.cos(a) * 40, b.y - 10 + Math.sin(a) * 10, 0.9, "#fde047"); }
        return;
      }
      const pose = { idle: "idle", wake: "horns", throw: "throw", command: "command", stomp: "stomp", taunt: "taunt", dizzy: "dizzy", recover: "idle", hit: "hit", chord: "hit", defeat: "defeat" }[b.st] || "idle";
      let ph = b.anim * 0.12;
      if (b.st === "throw") ph = (1 - Math.max(0, b.t) / 50) * Math.PI * 2;
      if (b.st === "stomp") ph = (1 - Math.max(0, b.t) / 34) * Math.PI;
      if (b.st === "defeat") ph = Math.min(Math.PI, (180 - b.t) / 40);
      if (b.st === "taunt") { const tg = c.createRadialGradient(cx, feet - 60, 10, cx, feet - 60, 110); tg.addColorStop(0, "rgba(253,224,71,0.18)"); tg.addColorStop(1, "rgba(253,224,71,0)"); c.fillStyle = tg; c.fillRect(cx - 110, feet - 170, 220, 220); }
      K.plumbmonkey(c, cx, feet, { pose, phase: ph, face: b.face, rage: b.stage >= 3 });
      if (b.st === "throw" && b.t > 8) { c.save(); c.translate(cx + b.face * 10, b.y - 10); PT.paintBarrel(c, 0); c.restore(); }
      c.restore();
      if (b.st === "dizzy") for (let i = 0; i < 4; i++) { const a = s.t * 0.1 + i * 1.57; PT.note(c, cx + Math.cos(a) * 46, b.y - 6 + Math.sin(a) * 12, 0.9, i % 2 ? "#fde047" : "#f0abfc"); }
      if (b.pedestal) {
        const pd = b.pedestal;
        c.save(); c.translate(pd.x + 24, pd.y + 60); PT.paintPedestal(c, s.t);
        c.shadowColor = "#fde68a"; c.shadowBlur = 18 + Math.sin(s.t * 0.15) * 8;
        if (!b.jam) K.guitar(c, 0, -74 + Math.sin(s.t * 0.08) * 4, 0.2, 1.1);
        c.restore();
      }
    }

    function drawShotsAndBolts(room) {
      for (const q of s.shots) {
        if (q.room !== room.name) continue;
        const x = q.x + q.w / 2, y = q.y + q.h / 2 + Math.sin(q.age * 0.5) * 3;
        c.save(); c.shadowColor = q.whistle ? "#a5f3fc" : "#f0abfc"; c.shadowBlur = 14;
        if (q.whistle) { c.strokeStyle = "rgba(165,243,252,0.85)"; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 5 + q.age * 0.6, -1, 1); c.stroke(); }
        else PT.note(c, x, y, 1.1, ["#f0abfc", "#a5f3fc", "#fde047"][(q.age >> 3) % 3]);
        c.restore();
      }
      for (const q of s.bolts) {
        if (q.room !== room.name) continue;
        c.save();
        if (q.kind === "wave") {
          const wg = c.createRadialGradient(q.x + q.w / 2, q.y + q.h, 2, q.x + q.w / 2, q.y + q.h, 34);
          wg.addColorStop(0, "rgba(255,237,213,0.95)"); wg.addColorStop(0.4, "rgba(251,146,60,0.7)"); wg.addColorStop(1, "rgba(251,146,60,0)");
          c.fillStyle = wg; c.fillRect(q.x - 14, q.y - 6, q.w + 28, q.h + 6);
        } else if (q.kind === "barrel") { c.translate(q.x + q.w / 2, q.y + q.h / 2); PT.paintBarrel(c, q.spin || 0); }
        else { c.translate(q.x + q.w / 2, q.y + q.h / 2); PT.paintPotion(c, s.t); }
        c.restore();
      }
      for (const it of s.items) {
        if (it.room !== room.name) continue;
        c.save(); c.translate(it.x + it.w / 2, it.y + it.h);
        if (it.kind === "amp") PT.paintAmp(c, s.t);
        else if (it.kind === "guitar") { c.shadowColor = "#f0abfc"; c.shadowBlur = 12; K.guitar(c, 0, -10, 0.35, 0.8); }
        else { c.translate(0, -16); PT.paintEncore(c, s.t); }
        c.restore();
      }
    }

    function drawHero() {
      const p = s.p, b = s.boss;
      if (p.inv > 0 && p.state === "play" && (p.inv >> 2) % 2) return;
      let pose = "idle", phase = s.t * 0.05, alpha = 1;
      if (p.state === "dead") { pose = "death"; phase = (DYING_T() - s.phaseT) * 0.12; }
      else if (p.state === "jam") { pose = "strum"; phase = strumT > 0 ? (14 - strumT) * 0.45 : 0; }
      else if (p.state === "chord") pose = "chord";
      else if (p.state === "victory") { pose = "victory"; phase = s.t * 0.1; }
      else if (p.state === "light") {
        const t = s.finish ? s.finish.t : 0;
        if (!p.on && p.y + p.h < s.finish.lantern.bottom) pose = "fall";
        else if (t < G.LIGHT) pose = "shoot";
        else { pose = "victory"; phase = s.t * 0.1; }
      }
      else if (!p.on) pose = p.shootT > 0 ? "airShoot" : p.vy < 0 ? "jump" : "fall";
      else if (p.land > 4 && Math.abs(p.vx) < 1) pose = "land";
      else if (Math.abs(p.vx) > 0.4 || p.state === "walkoff") { pose = p.shootT > 0 ? "runShoot" : "run"; phase = p.dist * 0.075; }
      else if (p.shootT > 0) pose = "shoot";
      const cx = p.x + p.w / 2, feet = p.y + p.h;
      c.save();
      if (p.state === "warp" && s.warp) {
        const k = Math.abs(p.warpT - s.warp.half) / s.warp.half;          // 1 at the ends, 0 at the swap
        alpha = s.warp.kind === "portal" ? k : 1;
        if (s.warp.kind !== "portal") { c.beginPath(); c.rect(cx - 60, feet - 140, 120, 140); c.clip(); c.translate(0, (1 - k) * 64); }
      }
      if (p.encore > 0) { c.shadowColor = `hsl(${(s.t * 12) % 360},90%,65%)`; c.shadowBlur = 18; }
      K.spaceman(c, cx, feet, { pose, phase, face: p.face, alpha, amp: p.tier >= 2, guitar: p.tier >= 3 });
      c.restore();
      if (p.state === "chord" && b) {
        const k = 1 - Math.max(0, b.t - 30) / 40, x = cx + (b.x + b.w / 2 - cx) * k;
        const cg = c.createRadialGradient(x, feet - 40, 4, x, feet - 40, 70);
        cg.addColorStop(0, "rgba(255,255,255,0.9)"); cg.addColorStop(0.3, "rgba(240,171,252,0.6)"); cg.addColorStop(1, "rgba(240,171,252,0)");
        c.fillStyle = cg; c.fillRect(x - 70, feet - 110, 140, 140);
      }
    }
    const DYING_T = () => G.DYING;

    // ---------- HUD ----------
    function label(t, x, y, size, color, align = "center", font = "Segoe UI, sans-serif", weight = 800) { c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.fillStyle = color; c.fillText(t, x, y); }
    function banner(title, sub, a, color) {
      if (a <= 0) return;
      c.save(); c.globalAlpha = Math.min(1, a);
      const y = 320, band = c.createLinearGradient(0, y - 70, 0, y + 56);
      band.addColorStop(0, "rgba(7,4,15,0)"); band.addColorStop(0.3, "rgba(7,4,15,0.82)"); band.addColorStop(0.7, "rgba(7,4,15,0.82)"); band.addColorStop(1, "rgba(7,4,15,0)");
      c.fillStyle = band; c.fillRect(-PAD, y - 70, VIEW_W, 126);
      c.shadowColor = color; c.shadowBlur = 20; label(title, 480, y, 44, color, "center", "Georgia, serif"); c.shadowBlur = 0;
      if (sub) label(sub, 480, y + 34, 18, "#ede9fe", "center", "Segoe UI, sans-serif", 600);
      c.restore();
    }
    function hud() {
      const L = s.level, T = PT.THEMES[themeName(s.world.rooms[s.p.room])], p = s.p;
      c.fillStyle = "rgba(7,4,15,0.6)"; c.fillRect(-PAD + 12, 10, 360, 30);
      label(`${L.id}  ${L.name}`, -PAD + 24, 31, 15, T.accent, "left");
      c.fillStyle = "rgba(7,4,15,0.6)"; c.fillRect(960 + PAD - 262, 10, 250, 30);
      c.save(); c.shadowColor = "#fde047"; c.shadowBlur = 8; PT.note(c, 960 + PAD - 244, 26, 0.9, "#fde047"); c.restore();
      label(`× ${String(s.notes).padStart(2, "0")}`, 960 + PAD - 226, 32, 16, "#fef9c3", "left");
      const tiers = ["SPACEMAN", "AMP", "GUITAR"];
      label(p.encore > 0 ? "ENCORE!" : tiers[p.tier - 1], 960 + PAD - 24, 32, 14, p.encore > 0 ? "#fde047" : ["#cbd5e1", "#fdba74", "#f0abfc"][p.tier - 1], "right");
      const b = s.boss, fighting = b && b.st !== "sleep" && b.st !== "gone";
      if (!fighting && !s.arena) {
        const secs = Math.ceil(s.timeT / 60), low = secs <= 60 && s.phase === "play";
        c.fillStyle = "rgba(7,4,15,0.6)"; c.fillRect(480 - 70, 10, 140, 30);
        label(`TIME ${secs}`, 480, 32, 16, low && (s.t >> 4) % 2 ? "#fb7185" : "#fef9c3");
      }
      if (fighting) {
        const w = 380, x = 480 - w / 2, y = 14;
        c.fillStyle = "rgba(7,4,15,0.75)"; c.fillRect(x - 6, y - 4, w + 12, 32);
        c.fillStyle = "#2e1065"; c.fillRect(x, y + 16, w, 8);
        c.fillStyle = b.type === "plumbmonkey" ? "#c084fc" : "#fb923c"; c.fillRect(x, y + 16, w * Math.max(0, b.hp / b.maxHp), 8);
        const extra = b.type === "plumbmonkey" ? ` · CHORD ${Math.min(b.stage, b.stages)} OF ${b.stages}` : "";
        label(b.name + extra, 480, y + 11, 11, "#f5f3ff");
      }
      if (b && b.jam) drawJam(b.jam);
    }
    function drawJam(j) {
      const y = 170, hitX = 480;
      c.fillStyle = "rgba(7,4,15,0.7)"; c.fillRect(160, y - 40, 640, 80);
      c.strokeStyle = "#f0abfc"; c.lineWidth = 3; c.beginPath(); c.arc(hitX, y, 26, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < j.beats; i++) {
        const dt = 60 + i * F.JAM_GAP - j.t, x = hitX + dt * 6;
        if (x < 170 || x > 790) continue;
        const mark = j.marks[i];
        c.save(); c.shadowColor = mark === "hit" ? "#86efac" : mark === "miss" ? "#fb7185" : "#fde047"; c.shadowBlur = 12;
        PT.note(c, x, y, 1.6, mark === "hit" ? "#86efac" : mark === "miss" ? "#fb7185" : "#fde047");
        c.restore();
      }
      label(`ON THE BEAT · ${j.hit} / ${j.need}`, 480, y + 58, 14, "#fef9c3");
    }

    function draw() {
      if (!s) reset();
      const room = s.world.rooms[s.p.room];
      c.save();
      if (shake > 0.5 && !api.reduced) c.translate(Math.sin(s.t * 1.7) * shake * 0.6, Math.cos(s.t * 2.3) * shake * 0.5);
      drawBackdrop(room);
      c.save();
      c.translate(-Math.round(s.cam.x), -Math.round(s.cam.y));
      drawObjects(room);
      drawTiles(room);
      drawBoss(room);
      drawFoes(room);
      drawShotsAndBolts(room);
      drawHero();
      c.font = "800 16px Segoe UI, sans-serif"; c.textAlign = "center";
      popups.forEach(q => { c.globalAlpha = Math.min(1, q.life / 15); c.fillStyle = "#fef9c3"; c.fillText(q.text, q.x, q.y); });
      c.globalAlpha = 1;
      c.restore();
      if (s.p.state === "warp" && s.warp && s.warp.kind === "portal") {
        const k = 1 - Math.abs(s.p.warpT - s.warp.half) / s.warp.half;
        c.fillStyle = `rgba(20,10,40,${k * 0.85})`; c.fillRect(-PAD, 0, VIEW_W, H);
      }
      if (flash > 0) { c.fillStyle = `rgba(255,240,255,${flash * 0.03})`; c.fillRect(-PAD, 0, VIEW_W, H); }
      c.restore();

      hud();
      const L = s.level;
      if (s.phase === "intro") banner(`WORLD ${L.id}`, `${L.name} · ${L.sub}`, Math.min(s.phaseT / 20, (G.INTRO - s.phaseT) / 20 + 0.2), PT.THEMES[L.theme].accent);
      else if (s.phase === "clear") {
        const f = s.finish;
        if (f && f.kind === "lantern") {
          if (f.t >= G.LIGHT) banner("LANTERN LIT", `NOTES ${f.notes} × 50  ·  TIME ${f.secs} × 20  ·  GHOSTS ${f.ghosts} × 100  =  ${f.points.toLocaleString()}`, Math.min(1, (f.t - G.LIGHT) / 20, s.phaseT / 20), "#ffd27a");
        } else banner(f && f.kind === "door" ? "INTO THE MANSION" : "COURSE CLEAR", s.last ? "" : "On to the next floor", Math.min(1, (G.CLEAR - s.phaseT) / 20), "#fde68a");
      }
      else if (s.phase === "ending" || s.phase === "over") banner("GAME OVER", "", Math.min(1, (G.ENDING - s.phaseT) / 30), "#fb7185");
      else if (s.phase === "victory") banner("PLUMBMONKEY DEFEATED", "The Music Room is yours. Ghost Circuit plays on.", Math.min(1, (G.VICTORY - s.phaseT) / 40), "#f0abfc");
    }

    reset();
    // current + jump() are for inspection in the browser (visual checks), not gameplay
    const inst = { reset, next, respawn, update, draw, attract: null, state: () => s, jump: n => { s = G.createState(n, { tier: 3 }); s.phase = "play"; } };
    G.current = inst;
    return inst;
  }

  G.create = create;
})(typeof window !== "undefined" ? window : globalThis);
